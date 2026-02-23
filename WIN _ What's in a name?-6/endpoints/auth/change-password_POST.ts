import { schema, OutputType } from "./change-password_POST.schema";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { generatePasswordHash } from "../../helpers/generatePasswordHash";
import { compare } from "bcryptjs";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    // 1. Get current authenticated user session
    const { user } = await getServerUserSession(request);

    const json = superjson.parse(await request.text());
    const { currentPassword, newPassword } = schema.parse(json);

    // 2. Fetch the user's current password hash
    const userPasswordEntry = await db
      .selectFrom("userPasswords")
      .select("passwordHash")
      .where("userId", "=", user.id)
      .executeTakeFirst();

    if (!userPasswordEntry) {
      // This shouldn't happen for a valid logged-in user unless data is corrupted
      return new Response(
        superjson.stringify({ error: "User password record not found" }),
        { status: 500 }
      );
    }

    // 3. Verify currentPassword matches
    const isMatch = await compare(currentPassword, userPasswordEntry.passwordHash);

    if (!isMatch) {
      // 4. If doesn't match, return 401
      return new Response(
        superjson.stringify({ error: "Current password is incorrect" }),
        { status: 401 }
      );
    }

    // 5. Hash the new password
    const newPasswordHash = await generatePasswordHash(newPassword);

    // 6. Update user_passwords table
    await db
      .updateTable("userPasswords")
      .set({
        passwordHash: newPasswordHash,
        // We don't have an updatedAt column in the schema provided, so we just update the hash
      })
      .where("userId", "=", user.id)
      .execute();

    // 7. Return success message
    return new Response(
      superjson.stringify({
        success: true,
        message: "Password changed successfully",
      } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof Error) {
      // Handle specific known errors if any, otherwise generic 400/500
      // For validation errors from Zod or other known issues
      return new Response(superjson.stringify({ error: error.message }), {
        status: 400,
      });
    }
    return new Response(
      superjson.stringify({ error: "An unexpected error occurred" }),
      { status: 500 }
    );
  }
}