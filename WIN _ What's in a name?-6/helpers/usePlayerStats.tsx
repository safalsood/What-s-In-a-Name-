import { useQuery } from "@tanstack/react-query";
import { getPlayerStats, OutputType } from "../endpoints/player/stats_GET.schema";

export function usePlayerStats(playerId: string | null | undefined) {
  return useQuery<OutputType, Error>({
    queryKey: ["playerStats", playerId],
    queryFn: () => {
      if (!playerId) throw new Error("Player ID is required");
      return getPlayerStats(playerId);
    },
    enabled: !!playerId,
    staleTime: 1000 * 60 * 5, // Cache stats for 5 minutes as they don't change rapidly outside of games
  });
}