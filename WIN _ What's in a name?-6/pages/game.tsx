import React from "react";
import { useSearchParams } from "react-router-dom";
import { GameSoloMode } from "../components/GameSoloMode";
import { GameMultiplayerMode } from "../components/GameMultiplayerMode";
import { getPlayerInfo } from "../helpers/playerInfo";

export default function GamePage() {
  const [searchParams] = useSearchParams();
  const roomCode = searchParams.get("roomCode");
  const urlPlayerId = searchParams.get("playerId");
  
  const isMultiplayer = !!(roomCode && urlPlayerId);
  const { playerId: localPlayerId } = getPlayerInfo();
  const playerId = isMultiplayer ? urlPlayerId : localPlayerId;

  if (isMultiplayer && roomCode && playerId) {
    return <GameMultiplayerMode roomCode={roomCode} playerId={playerId} />;
  }

  return <GameSoloMode />;
}