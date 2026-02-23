// adapt this to your database schema
import { db } from "../../helpers/db";
import { sql } from "kysely";
import { schema } from "./login_with_password_POST.schema";
import { compare } from "bcryptjs";
import { randomBytes } from "crypto";
import {
  setServerSession,
  SessionExpirationSeconds,
} from "../../helpers/getSetServerSession";
import { User } from "../../helpers/User";

// Configuration constants
const RATE_LIMIT_CONFIG = {
  maxFailedAttempts: 5,
  lockoutWindowMinutes: 15,
  lockoutDurationMinutes: 15,
  cleanupProbability: 0.1,
} as const;

// Helper function to safely convert union type to Date
function safeToDate(
  value: string | number | bigint | null | undefined
): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "bigint") {
    // Convert bigint to number (assuming it's a timestamp in milliseconds)
    return new Date(Number(value));
  }

  return new Date(value);
}

export async function handle(request: Request) {
  try {
    const json = await request.json();
    const { username, password } = schema.parse(json);

    // Normalize username to lowercase for consistent handling
    const usernameLower = username.toLowerCase();
    const now = new Date();
    const windowStart = new Date(
      now.getTime() - RATE_LIMIT_CONFIG.lockoutWindowMinutes * 60 * 1000
    );

    // Start transaction for atomic rate limiting and session creation
    const result = await db.transaction().execute(async (trx) => {
      // Use PostgreSQL advisory lock to serialize access per username
      // This prevents concurrent processing of the same username
      // The lock is automatically released when the transaction ends
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${usernameLower},0))`.execute(
        trx
      );

      // Get rate limiting info efficiently - use COUNT and MAX instead of SELECT *
      const rateLimitQuery = await trx
        .selectFrom("loginAttempts")
        .select([
          trx.fn.countAll<number>().as("failedCount"),
          trx.fn.max(trx.dynamic.ref("attemptedAt")).as("lastFailedAt"),
        ])
        .where("usernameLower", "=", usernameLower)
        .where("success", "=", false)
        .where("attemptedAt", ">=", windowStart)
        .where("attemptedAt", "is not", null) // Ensure null safety
        .executeTakeFirst();

      const { failedCount = 0, lastFailedAt = null } = rateLimitQuery || {};
      const safeLastFailedAt = safeToDate(lastFailedAt);

      // Check if user is locked out
      if (
        rateLimitQuery &&
        failedCount >= RATE_LIMIT_CONFIG.maxFailedAttempts &&
        safeLastFailedAt
      ) {
        const lockoutEnd = new Date(
          safeLastFailedAt.getTime() +
            RATE_LIMIT_CONFIG.lockoutDurationMinutes * 60 * 1000
        );

        if (now < lockoutEnd) {
          const remainingMinutes = Math.ceil(
            (lockoutEnd.getTime() - now.getTime()) / (60 * 1000)
          );
          // DO NOT log blocked attempts to prevent extending lockout indefinitely
          return {
            type: "rate_limited" as const,
            remainingMinutes,
          };
        }
      }

      // Find user by username (normalized)
      const userResults = await trx
        .selectFrom("users")
        .innerJoin("userPasswords", "users.id", "userPasswords.userId")
        .select([
          "users.id",
          "users.username",
          "users.displayName",
          "users.avatarUrl",
          "users.role",
          "userPasswords.passwordHash",
        ])
        .where("users.usernameLower", "=", usernameLower)
        .limit(1)
        .execute();

      if (userResults.length === 0) {
        // Log failed attempt for non-existent user
        await trx
          .insertInto("loginAttempts")
          .values({
            usernameLower: usernameLower,
            attemptedAt: now,
            success: false,
          })
          .execute();

        return {
          type: "auth_failed" as const,
        };
      }

      const user = userResults[0];

      // Verify password
      const passwordValid = await compare(password, user.passwordHash);
      if (!passwordValid) {
        // Log failed attempt for invalid password
        await trx
          .insertInto("loginAttempts")
          .values({
            usernameLower: usernameLower,
            attemptedAt: now,
            success: false,
          })
          .execute();

        return {
          type: "auth_failed" as const,
        };
      }

      // Password is valid - log successful attempt
      await trx
        .insertInto("loginAttempts")
        .values({
          usernameLower: usernameLower,
          attemptedAt: now,
          success: true,
        })
        .execute();

      // Invalidate all existing sessions for this user (single active session per user)
      console.log(`Invalidating existing sessions for user ${user.id}`);
      await trx.deleteFrom("sessions").where("userId", "=", user.id).execute();

      // Also clear the user's active room (they can no longer interact with it from old device)
      await trx
        .updateTable("users")
        .set({ activeRoomId: null })
        .where("id", "=", user.id)
        .execute();

      // Create session inside the same transaction to ensure atomicity
      const sessionId = randomBytes(32).toString("hex");
      const expiresAt = new Date(
        now.getTime() + SessionExpirationSeconds * 1000
      );

      await trx
        .insertInto("sessions")
        .values({
          id: sessionId,
          userId: user.id,
          createdAt: now,
          lastAccessed: now,
          expiresAt: expiresAt,
        })
        .execute();

      // Reset failed attempts counter by deleting previous failed attempts
      // This preserves audit trail of successful logins
      await trx
        .deleteFrom("loginAttempts")
        .where("usernameLower", "=", usernameLower)
        .where("success", "=", false)
        .execute();

      return {
        type: "success" as const,
        user,
        sessionId,
        sessionCreatedAt: now,
      };
    });

    // Clean up old login attempts periodically
    // Run cleanup outside transaction to prevent extending transaction time and potential deadlocks
    if (Math.random() < RATE_LIMIT_CONFIG.cleanupProbability) {
      const cleanupBefore = new Date(
        now.getTime() - RATE_LIMIT_CONFIG.lockoutWindowMinutes * 60 * 1000
      );
      try {
        await db
          .deleteFrom("loginAttempts")
          .where("attemptedAt", "<", cleanupBefore)
          .where("attemptedAt", "is not", null)
          .executeTakeFirst();
      } catch {
        // Don't fail the login if cleanup fails
      }
    }

    // Handle different transaction results
    if (result.type === "rate_limited") {
      return Response.json(
        {
          message: `Too many failed login attempts. Account locked for ${result.remainingMinutes} more minutes.`,
        },
        { status: 429 }
      );
    }

    if (result.type === "auth_failed") {
      return Response.json(
        { message: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Success case - session was already created in transaction
    const user = result.user;

    // Create response with user data (excluding sensitive information)
    const userData: User = {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      displayName: user.displayName ?? user.username,
      role: user.role as "admin" | "user",
    };

    const response = Response.json({
      user: userData,
    });

    // Set session cookie
    await setServerSession(response, {
      id: result.sessionId,
      createdAt: result.sessionCreatedAt.getTime(),
      lastAccessed: result.sessionCreatedAt.getTime(),
    });

    return response;
  } catch (error) {
    console.error("Authentication error:", error);
    return Response.json({ message: "Authentication failed" }, { status: 400 });
  }
}