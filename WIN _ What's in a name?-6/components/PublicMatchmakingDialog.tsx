import React from "react";
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
import { useMatchmaking } from "../helpers/roomQueries";
import { getPlayerId, setPlayerName, getPlayerName } from "../helpers/playerInfo";
import { useAuth } from "../helpers/useAuth";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import styles from "./PublicMatchmakingDialog.module.css";

interface PublicMatchmakingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const schema = z.object({
  playerName: z.string().min(1, "Please enter your name"),
});

export function PublicMatchmakingDialog({ open, onOpenChange }: PublicMatchmakingDialogProps) {
  const navigate = useNavigate();
  const matchmaking = useMatchmaking();
  const { authState } = useAuth();

  const form = useForm({
    defaultValues: {
      playerName: getPlayerName() || "",
    },
    schema,
  });

  React.useEffect(() => {
    if (authState.type === "authenticated" && authState.user.username) {
      form.setValues((prev) => ({
        ...prev,
        playerName: authState.user.username,
      }));
    }
  }, [authState, form.setValues]);

  const handleSubmit = (values: z.infer<typeof schema>) => {
    const playerId = getPlayerId();
    setPlayerName(values.playerName);
    const userId = authState.type === "authenticated" ? authState.user.id : undefined;

    matchmaking.mutate(
      {
        playerName: values.playerName,
        playerId,
        userId,
      },
      {
        onSuccess: (data) => {
          if (data.joined) {
            toast.success("Joined a room!");
          } else {
            toast.success("Created a new room!");
          }
          navigate(`/game?roomCode=${data.roomCode}&playerId=${playerId}`);
        },
        onError: (error) => {
          toast.error("Matchmaking failed", {
            description: error.message,
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>Play Online</DialogTitle>
          <DialogDescription>
            Enter your name to find or create a public game room.
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

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className={styles.form}>
            <FormItem name="playerName">
              <FormLabel>Player Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your name"
                  value={form.values.playerName}
                  onChange={(e) =>
                    form.setValues((prev) => ({ ...prev, playerName: e.target.value }))
                  }
                  disabled={authState.type === "authenticated"}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            <div className={styles.formActions}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={matchmaking.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={matchmaking.isPending}>
                {matchmaking.isPending ? "Finding Room..." : "Find Game"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}