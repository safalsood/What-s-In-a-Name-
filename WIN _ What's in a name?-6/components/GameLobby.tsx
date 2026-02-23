import { Copy, Users, Crown, LogOut } from "lucide-react";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { toast } from "sonner";
import { Selectable } from "kysely";
import { Rooms, RoomPlayers } from "../helpers/schema";
import { useLeaveRoom } from "../helpers/roomQueries";
import { useNavigate } from "react-router-dom";
import styles from "./GameLobby.module.css";

interface GameLobbyProps {
  room: Selectable<Rooms>;
  players: Selectable<RoomPlayers>[];
  playerId: string;
  userId?: number;
  onStartGame: () => void;
  isStarting?: boolean;
  className?: string;
}

export const GameLobby = ({
  room,
  players,
  playerId,
  userId,
  onStartGame,
  isStarting,
  className,
}: GameLobbyProps) => {
  const isHost = room.hostId === playerId;
  const canStart = players.length >= room.minPlayers;
  const navigate = useNavigate();
  const leaveRoomMutation = useLeaveRoom();

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.code);
    toast.success("Room code copied!");
  };

  const handleLeaveRoom = async () => {
    try {
      await leaveRoomMutation.mutateAsync({
        roomCode: room.code,
        playerId,
        userId,
      });
      navigate("/");
      toast.info("Left room");
    } catch (error) {
      toast.error("Failed to leave room");
    }
  };

  return (
    <div className={`${styles.container} ${className || ""}`}>
      <div className={styles.header}>
        <div className={styles.roomInfo}>
          <h1 className={styles.title}>Game Lobby</h1>
          <div className={styles.codeSection}>
            <span className={styles.codeLabel}>Room Code</span>
            <div className={styles.codeDisplay}>
              <span className={styles.code}>{room.code}</span>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={handleCopyCode}
                className={styles.copyBtn}
              >
                <Copy size={16} />
              </Button>
            </div>
          </div>
        </div>

        <div className={styles.playerCount}>
          <Users size={20} />
          <span>
            {players.length} / {room.maxPlayers}
          </span>
        </div>
      </div>

      <div className={styles.playersSection}>
        <h2 className={styles.sectionTitle}>Players</h2>
        <div className={styles.playersList}>
          {players.map((player) => (
            <div key={player.id} className={styles.playerCard}>
              <div className={styles.playerName}>
                {player.playerName}
                {player.playerId === room.hostId && (
                  <Badge variant="secondary" className={styles.hostBadge}>
                    <Crown size={12} />
                    Host
                  </Badge>
                )}
                {player.playerId === playerId && (
                  <Badge variant="outline" className={styles.youBadge}>
                    You
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>

        {players.length < room.minPlayers && (
          <div className={styles.waitingMessage}>
            <span>
              Waiting for {room.minPlayers - players.length} more player
              {room.minPlayers - players.length > 1 ? "s" : ""} to start...
            </span>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        {isHost ? (
          <Button
            size="lg"
            onClick={onStartGame}
            disabled={!canStart || isStarting}
            className={styles.startBtn}
          >
            {isStarting ? "Starting..." : "Start Game"}
          </Button>
        ) : (
          <div className={styles.waitingForHost}>
            <Skeleton style={{ width: "12rem", height: "1rem" }} />
            <span>Waiting for host to start...</span>
          </div>
        )}
      </div>

      <div className={styles.footerActions}>
        <Button
          variant="ghost"
          onClick={handleLeaveRoom}
          className={styles.leaveBtn}
          disabled={leaveRoomMutation.isPending}
        >
          <LogOut size={16} />
          Leave Room
        </Button>
      </div>
    </div>
  );
};