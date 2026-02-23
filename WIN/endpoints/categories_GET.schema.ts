import { z } from "zod";
import superjson from 'superjson';

export const schema = z.object({
  playerId: z.string().optional()
});

export type InputType = z.infer<typeof schema>;

export type Category = {
  id: string;
  name: string;
  description: string;
};

export type OutputType = {
  categories: Category[];
};

export const getCategories = async (input?: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input?.playerId) {
    params.set("playerId", input.playerId);
  }
  const queryString = params.toString();
  const url = queryString ? `/_api/categories?${queryString}` : `/_api/categories`;

  const result = await fetch(url, {
    method: "GET",
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