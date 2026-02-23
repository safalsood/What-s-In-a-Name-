import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./Dialog";
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  useForm,
} from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import { useCreateRoom, useJoinRoom } from "../helpers/roomQueries";
import { getPlayerId, setPlayerName, getPlayerName } from "../helpers/playerInfo";
import { useAuth } from "../helpers/useAuth";
import { toast } from "sonner";
import { Copy, Check, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import styles from "./PrivateRoomDialog.module.css";

interface PrivateRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const nameSchema = z.object({
  playerName: z.string().min(1, "Please enter your name"),
});

const joinSchema = z.object({
  roomCode: z.string().min(6, "Room code must be 6 characters").max(6, "Room code must be 6 characters"),
});

type PrivateRoomStep = "choose" | "create-name" | "join-name" | "join-code" | "created";

export function PrivateRoomDialog({ open, onOpenChange }: PrivateRoomDialogProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<PrivateRoomStep>("choose");
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [joinRoomCode, setJoinRoomCode] = useState("");

  const { authState } = useAuth();
  const createRoom = useCreateRoom();
  const joinRoom = useJoinRoom();

  const nameForm = useForm({
    defaultValues: {
      playerName: getPlayerName() || "",
    },
    schema: nameSchema,
  });

  // Auto-fill name when authenticated
  React.useEffect(() => {
    if (authState.type === "authenticated" && authState.user.username) {
      nameForm.setValues((prev) => ({
        ...prev,
        playerName: authState.user.username,
      }));
    }
  }, [authState, nameForm.setValues]);

  const joinCodeForm = useForm({
    defaultValues: {
      roomCode: "",
    },
    schema: joinSchema,
  });

  const handleReset = () => {
    setStep("choose");
    setCreatedRoomCode(null);
    setCopiedCode(false);
    setJoinRoomCode("");
    nameForm.setValues({ playerName: getPlayerName() || "" });
    joinCodeForm.setValues({ roomCode: "" });
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      handleReset();
    }
    onOpenChange(open);
  };

  const handleCreateRoom = () => {
    setStep("create-name");
  };

  const handleJoinRoom = () => {
    setStep("join-name");
  };

  const handleCreateSubmit = (values: z.infer<typeof nameSchema>) => {
    const playerId = getPlayerId();
    setPlayerName(values.playerName);

    const userId = authState.type === "authenticated" ? authState.user.id : undefined;

    createRoom.mutate(
      {
        playerName: values.playerName,
        playerId,
        roomType: "private",
        maxPlayers: 12,
        userId,
      },
      {
        onSuccess: (data) => {
          setCreatedRoomCode(data.roomCode);
          setStep("created");
        },
        onError: (error) => {
          toast.error("Failed to create room", {
            description: error.message,
          });
        },
      }
    );
  };

  const handleJoinNameSubmit = (values: z.infer<typeof nameSchema>) => {
    setPlayerName(values.playerName);
    setStep("join-code");
  };

  const handleJoinCodeSubmit = (values: z.infer<typeof joinSchema>) => {
    const playerId = getPlayerId();
    const playerName = nameForm.values.playerName;
    const userId = authState.type === "authenticated" ? authState.user.id : undefined;

    setJoinRoomCode(values.roomCode.toUpperCase());

    joinRoom.mutate(
      {
        roomCode: values.roomCode.toUpperCase(),
        playerName,
        playerId,
        userId,
      },
      {
        onSuccess: () => {
          navigate(`/game?roomCode=${values.roomCode.toUpperCase()}&playerId=${playerId}`);
        },
        onError: (error) => {
          toast.error("Failed to join room", {
            description: error.message,
          });
        },
      }
    );
  };

  const handleCopyCode = async () => {
    if (createdRoomCode) {
      await navigator.clipboard.writeText(createdRoomCode);
      setCopiedCode(true);
      toast.success("Room code copied!");
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleEnterRoom = () => {
    if (createdRoomCode) {
      const playerId = getPlayerId();
      navigate(`/game?roomCode=${createdRoomCode}&playerId=${playerId}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={styles.dialogContent}>
        {step === "choose" && (
          <>
            <DialogHeader>
              <DialogTitle>Private Room</DialogTitle>
              <DialogDescription>
                Create a private room to play with friends, or join an existing room.
              </DialogDescription>
            </DialogHeader>
            <div className={styles.chooseButtons}>
              <Button onClick={handleCreateRoom} size="lg" className={styles.choiceButton}>
                Create Room
              </Button>
              <Button onClick={handleJoinRoom} variant="secondary" size="lg" className={styles.choiceButton}>
                Join Room
              </Button>
            </div>
          </>
        )}

        {step === "create-name" && (
          <>
            <DialogHeader>
              <DialogTitle>Enter Your Name</DialogTitle>
              <DialogDescription>
                Choose a name to display to other players.
              </DialogDescription>
            </DialogHeader>

            {authState.type === "unauthenticated" && (
              <div className={styles.authNotice}>
                <LogIn size={16} />
                <span>
                  <Button variant="link" asChild className={styles.inlineLink}>
                    <Link to="/login">Log in</Link>
                  </Button>{" "}
                  to save your stats and use your username.
                </span>
              </div>
            )}

            <Form {...nameForm}>
              <form onSubmit={nameForm.handleSubmit(handleCreateSubmit)} className={styles.form}>
                <FormItem name="playerName">
                  <FormLabel>Player Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your name"
                      value={nameForm.values.playerName}
                      onChange={(e) =>
                        nameForm.setValues((prev) => ({ ...prev, playerName: e.target.value }))
                      }
                      disabled={authState.type === "authenticated"}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
                <div className={styles.formActions}>
                  <Button type="button" variant="ghost" onClick={() => setStep("choose")}>
                    Back
                  </Button>
                  <Button type="submit" disabled={createRoom.isPending}>
                    {createRoom.isPending ? "Creating..." : "Create Room"}
                  </Button>
                </div>
              </form>
            </Form>
          </>
        )}

        {step === "join-name" && (
          <>
            <DialogHeader>
              <DialogTitle>Enter Your Name</DialogTitle>
              <DialogDescription>
                Choose a name to display to other players.
              </DialogDescription>
            </DialogHeader>

            {authState.type === "unauthenticated" && (
              <div className={styles.authNotice}>
                <LogIn size={16} />
                <span>
                  <Button variant="link" asChild className={styles.inlineLink}>
                    <Link to="/login">Log in</Link>
                  </Button>{" "}
                  to save your stats and use your username.
                </span>
              </div>
            )}

            <Form {...nameForm}>
              <form onSubmit={nameForm.handleSubmit(handleJoinNameSubmit)} className={styles.form}>
                <FormItem name="playerName">
                  <FormLabel>Player Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your name"
                      value={nameForm.values.playerName}
                      onChange={(e) =>
                        nameForm.setValues((prev) => ({ ...prev, playerName: e.target.value }))
                      }
                      disabled={authState.type === "authenticated"}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
                <div className={styles.formActions}>
                  <Button type="button" variant="ghost" onClick={() => setStep("choose")}>
                    Back
                  </Button>
                  <Button type="submit">Continue</Button>
                </div>
              </form>
            </Form>
          </>
        )}

        {step === "join-code" && (
          <>
            <DialogHeader>
              <DialogTitle>Enter Room Code</DialogTitle>
              <DialogDescription>
                Enter the 6-character room code shared by your friend.
              </DialogDescription>
            </DialogHeader>
            <Form {...joinCodeForm}>
              <form onSubmit={joinCodeForm.handleSubmit(handleJoinCodeSubmit)} className={styles.form}>
                <FormItem name="roomCode">
                  <FormLabel>Room Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="XXXXXX"
                      value={joinCodeForm.values.roomCode}
                      onChange={(e) =>
                        joinCodeForm.setValues((prev) => ({
                          ...prev,
                          roomCode: e.target.value.toUpperCase(),
                        }))
                      }
                      maxLength={6}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
                <div className={styles.formActions}>
                  <Button type="button" variant="ghost" onClick={() => setStep("join-name")}>
                    Back
                  </Button>
                  <Button type="submit" disabled={joinRoom.isPending}>
                    {joinRoom.isPending ? "Joining..." : "Join Room"}
                  </Button>
                </div>
              </form>
            </Form>
          </>
        )}

        {step === "created" && createdRoomCode && (
          <>
            <DialogHeader>
              <DialogTitle>Room Created!</DialogTitle>
              <DialogDescription>
                Share this code with your friends to let them join.
              </DialogDescription>
            </DialogHeader>
            <div className={styles.roomCodeDisplay}>
              <div className={styles.roomCodeLabel}>Room Code</div>
              <div className={styles.roomCode}>{createdRoomCode}</div>
              <Button
                onClick={handleCopyCode}
                variant="outline"
                size="sm"
                className={styles.copyButton}
              >
                {copiedCode ? (
                  <>
                    <Check size={16} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copy Code
                  </>
                )}
              </Button>
            </div>
            <div className={styles.formActions}>
              <Button onClick={handleEnterRoom} size="lg" className={styles.enterRoomButton}>
                Enter Room
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}