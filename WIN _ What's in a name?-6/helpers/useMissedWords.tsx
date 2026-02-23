import { useQuery } from "@tanstack/react-query";
import { getMissedWords, InputType, OutputType } from "../endpoints/room/missed-words_GET.schema";

export const useMissedWords = (input: InputType, enabled: boolean = true) => {
  return useQuery<OutputType, Error>({
    queryKey: ["missedWords", input.roomCode, input.playerId],
    queryFn: () => getMissedWords(input),
    enabled: enabled && !!input.roomCode && !!input.playerId,
    staleTime: Infinity, // The result for a finished game never changes
    retry: false,
  });
};