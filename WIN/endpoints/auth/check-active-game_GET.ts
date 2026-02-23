import { schema, OutputType } from "./check-active-game_GET.schema";
import superjson from 'superjson';
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { RoomStatus } from "../../helpers/schema";

export async function handle(request: Request) {
  try {
    // 1. Authenticate user
    const { user } = await getServerUserSession(request);

    // 2. Check if user has an active room ID
    // We need to fetch the fresh user data from DB to ensure activeRoomId is up to date,
    // although getServerUserSession does a join, it might be cached or slightly stale depending on implementation details of the session.
    // However, looking at getServerUserSession implementation, it joins sessions with users, so the user object returned *should* have the latest data if we query for it.
    // But getServerUserSession returns a simplified User object which might NOT include activeRoomId.
    // Let's check the User type in helpers/getServerUserSession.tsx...
    // The User type returned by getServerUserSession only has id, username, displayName, avatarUrl, role.
    // It does NOT have activeRoomId.
    // So we must query the database for the user's activeRoomId.

    const userRecord = await db
      .selectFrom("users")
      .select("activeRoomId")
      .where("id", "=", user.id)
      .executeTakeFirst();

    if (!userRecord || !userRecord.activeRoomId) {
      return new Response(
        superjson.stringify({ hasActiveGame: false } satisfies OutputType)
      );
    }

    // 3. Check room status
    const room = await db
      .selectFrom("rooms")
      .select(["status", "code"])
      .where("id", "=", userRecord.activeRoomId)
      .executeTakeFirst();

    if (!room) {
      // Data inconsistency: User has activeRoomId but room doesn't exist.
      // We should probably treat this as no active game.
      return new Response(
        superjson.stringify({ hasActiveGame: false } satisfies OutputType)
      );
    }

    const activeStatuses: RoomStatus[] = ["playing", "waiting", "tutorial"];
    const isActive = activeStatuses.includes(room.status);

    if (isActive) {
      return new Response(
        superjson.stringify({
          hasActiveGame: true,
          roomCode: room.code,
        } satisfies OutputType)
      );
    } else {
      return new Response(
        superjson.stringify({ hasActiveGame: false } satisfies OutputType)
      );
    }
  } catch (error) {
    // If not authenticated, we can just return false instead of erroring, 
    // or we can return 401. The requirement implies checking for "authenticated user".
    // If getServerUserSession throws, it means not authenticated.
    if (error instanceof Error && error.name === "NotAuthenticatedError") {
       return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }

    console.error("Error checking active game:", error);
    return new Response(superjson.stringify({ error: "Internal server error" }), { status: 500 });
  }
}