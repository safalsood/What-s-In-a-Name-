import { useMutation } from "@tanstack/react-query";
import { postSoloAnalytics, InputType, OutputType } from "../endpoints/solo/analytics_POST.schema";

/**
 * React Query hook to interact with the solo analytics endpoint.
 * 
 * Usage:
 * const { mutate: logAnalytics } = useSoloAnalytics();
 * 
 * logAnalytics({
 *   action: "init",
 *   soloSessionId: "...",
 *   playerId: "...",
 *   gameStartTime: new Date()
 * });
 */
export const useSoloAnalytics = () => {
  return useMutation<OutputType, Error, InputType>({
    mutationFn: async (variables) => {
      return await postSoloAnalytics(variables);
    },
    onError: (error) => {
      console.error("[useSoloAnalytics] Error logging analytics:", error);
      // We generally don't want to show UI errors for background analytics failures,
      // so we just log to console.
    },
  });
};