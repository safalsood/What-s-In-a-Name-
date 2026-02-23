import { useQuery } from "@tanstack/react-query";
import { getCheckActiveGame } from "../endpoints/auth/check-active-game_GET.schema";

export const CHECK_ACTIVE_GAME_QUERY_KEY = ["auth", "checkActiveGame"] as const;

export function useCheckActiveGame(enabled: boolean = true) {
  return useQuery({
    queryKey: CHECK_ACTIVE_GAME_QUERY_KEY,
    queryFn: () => getCheckActiveGame(),
    enabled,
    retry: false,
    // Don't refetch too aggressively, but ensure we check when window focuses if the user might have joined a game in another tab
    refetchOnWindowFocus: true, 
  });
}