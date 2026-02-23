import { nanoid } from "nanoid";
import { User } from "./User";

const PLAYER_ID_KEY = "win_playerId";
const PLAYER_NAME_KEY = "win_playerName";

export function getPlayerId(): string {
  let playerId = localStorage.getItem(PLAYER_ID_KEY);
  if (!playerId) {
    playerId = nanoid();
    localStorage.setItem(PLAYER_ID_KEY, playerId);
  }
  return playerId;
}

export function getPlayerName(): string | null {
  return localStorage.getItem(PLAYER_NAME_KEY);
}

export function setPlayerName(name: string): void {
  localStorage.setItem(PLAYER_NAME_KEY, name);
}

export function getPlayerInfo(): { playerId: string; playerName: string | null } {
  return {
    playerId: getPlayerId(),
    playerName: getPlayerName(),
  };
}

export function getAuthenticatedPlayerInfo(user: User | null): {
  playerId: string;
  playerName: string | null;
  userId?: number;
} {
  const localPlayerId = getPlayerId();
  const localPlayerName = getPlayerName();

  if (user) {
    return {
      playerId: localPlayerId,
      playerName: user.username,
      userId: user.id,
    };
  }

  return {
    playerId: localPlayerId,
    playerName: localPlayerName,
  };
}