import { z } from "zod";
import superjson from 'superjson';

export const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("init"),
    soloSessionId: z.string(),
    playerId: z.string(),
    playerUsername: z.string().optional().nullable(),
    gameStartTime: z.date(),
  }),
  z.object({
    action: z.literal("trackFirstGrand"),
    soloSessionId: z.string(),
    playerId: z.string(),
    currentLetterCount: z.number(),
    roundsBeforeFirstGrandAttempt: z.number(),
  }),
  z.object({
    action: z.literal("incrementGrand"),
    soloSessionId: z.string(),
    playerId: z.string(),
  }),
  z.object({
    action: z.literal("updateMiniSeen"),
    soloSessionId: z.string(),
    playerId: z.string(),
    count: z.number(),
  }),
  z.object({
    action: z.literal("finalize"),
    soloSessionId: z.string(),
    playerId: z.string(),
    finalLetterCount: z.number(),
    result: z.enum(["Win", "Loss", "Quit"]),
    totalRounds: z.number(),
    finalGrandWord: z.string().optional(),
    possibleGrandWord: z.string().optional(),
  }),
]);

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  error?: string;
};

export const postSoloAnalytics = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  
  const result = await fetch(`/_api/solo/analytics`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  
  return superjson.parse<OutputType>(await result.text());
};