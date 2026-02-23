import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { postCreateRoom, InputType as CreateInput } from "../endpoints/room/create_POST.schema";
import { postJoinRoom, InputType as JoinInput } from "../endpoints/room/join_POST.schema";
import { postLeaveRoom, InputType as LeaveInput } from "../endpoints/room/leave_POST.schema";
import { getRoomState } from "../endpoints/room/state_GET.schema";
import { postSubmitWord, InputType as SubmitInput } from "../endpoints/room/submit-word_POST.schema";
import { postStartGame, InputType as StartInput } from "../endpoints/room/start_POST.schema";
import { postMatchmaking, InputType as MatchmakingInput } from "../endpoints/room/matchmaking_POST.schema";
import { postShuffleVote, InputType as ShuffleInput } from "../endpoints/room/shuffle-vote_POST.schema";
import { postTutorialComplete, InputType as TutorialInput } from "../endpoints/room/tutorial-complete_POST.schema";
import { postFlushLogs, InputType as FlushLogsInput } from "../endpoints/room/flush-logs_POST.schema";
import { postPlayAgain, InputType as PlayAgainInput } from "../endpoints/room/play-again_POST.schema";

export const useCreateRoom = () => {
  return useMutation({
    mutationFn: (data: CreateInput) => postCreateRoom(data),
  });
};

export const useJoinRoom = () => {
  return useMutation({
    mutationFn: (data: JoinInput) => postJoinRoom(data),
  });
};

export const useLeaveRoom = () => {
  return useMutation({
    mutationFn: (data: LeaveInput) => postLeaveRoom(data),
  });
};

export const useRoomState = (roomCode: string | null, playerId: string | null) => {
  return useQuery({
    queryKey: ["roomState", roomCode],
    queryFn: () => {
      if (!roomCode || !playerId) throw new Error("Missing params");
      return getRoomState(roomCode, playerId);
    },
    enabled: !!roomCode && !!playerId,
    refetchInterval: 1000, // Poll every second
  });
};

export const useSubmitWord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: SubmitInput) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

      try {
        return await postSubmitWord(data, { signal: controller.signal });
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error("Request timed out. Please try again.");
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate room state to show new winner/letters immediately
      // Use partial key to invalidate for all players in the room
      queryClient.invalidateQueries({ queryKey: ["roomState", variables.roomCode] });
    },
  });
};

export const useStartGame = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: StartInput) => postStartGame(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["roomState", variables.roomCode] });
    },
  });
};

export const useMatchmaking = () => {
  return useMutation({
    mutationFn: (data: MatchmakingInput) => postMatchmaking(data),
  });
};

export const useShuffleVote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ShuffleInput) => postShuffleVote(data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["roomState", variables.roomCode] });
    },
  });
};

export const useTutorialComplete = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TutorialInput) => postTutorialComplete(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["roomState", variables.roomCode] });
    },
  });
};

export const useFlushLogs = () => {
  return useMutation({
    mutationFn: (data: FlushLogsInput) => postFlushLogs(data),
  });
};

export const usePlayAgain = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PlayAgainInput) => postPlayAgain(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["roomState", variables.roomCode] });
    },
  });
};