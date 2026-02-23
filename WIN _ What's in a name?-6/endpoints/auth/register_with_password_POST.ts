// adapt this to the database schema and helpers if necessary
import { db } from "../../helpers/db";
import { schema } from "./register_with_password_POST.schema";
import { randomBytes } from "crypto";
import {
  setServerSession,
  SessionExpirationSeconds,
} from "../../helpers/getSetServerSession";
import { generatePasswordHash } from "../../helpers/generatePasswordHash";

export async function handle(request: Request) {
  try {
    const json = await request.json();
    const { username, password } = schema.parse(json);

    const usernameLower = username.toLowerCase();

    // Check if username already exists
    const existingUser = await db
      .selectFrom("users")
      .select("id")
      .where("usernameLower", "=", usernameLower)
      .limit(1)
      .execute();

    if (existingUser.length > 0) {
      return Response.json(
        { message: "Username already taken. Please choose another." },
        { status: 409 }
      );
    }

    const passwordHash = await generatePasswordHash(password);

    // Create new user
    const newUser = await db.transaction().execute(async (trx) => {
      // Insert the user
      const [user] = await trx
        .insertInto("users")
        .values({
          username,
          usernameLower,
          displayName: username,
          role: "user", // Default role
        })
        .returning(["id", "username", "displayName", "createdAt"])
        .execute();

      // Store the password hash in another table
      await trx
        .insertInto("userPasswords")
        .values({
          userId: user.id,
          passwordHash,
        })
        .execute();

      return user;
    });

    // Create a new session
    const sessionId = randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SessionExpirationSeconds * 1000);

    await db
      .insertInto("sessions")
      .values({
        id: sessionId,
        userId: newUser.id,
        createdAt: now,
        lastAccessed: now,
        expiresAt,
      })
      .execute();

    // Create response with user data
    const response = Response.json({
      user: {
        id: newUser.id,
        username: newUser.username,
        displayName: newUser.displayName ?? newUser.username,
        avatarUrl: null,
        role: "user" as const,
      },
    });

    // Set session cookie
    await setServerSession(response, {
      id: sessionId,
      createdAt: now.getTime(),
      lastAccessed: now.getTime(),
    });

    return response;
  } catch (error: unknown) {
    console.error("Registration error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Registration failed";
    return Response.json({ message: errorMessage }, { status: 400 });
  }
}