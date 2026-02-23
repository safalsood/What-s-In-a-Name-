import { useMutation, useQuery, UseMutationOptions, UseQueryOptions } from "@tanstack/react-query";
import { postValidateWord, InputType as ValidateInput, OutputType as ValidateOutput } from "../endpoints/validate-word_POST.schema";
import { getCategories, OutputType as CategoriesOutput } from "../endpoints/categories_GET.schema";

/**
 * Hook to validate a word against the dictionary API.
 * Use this when a user submits a word in the game.
 */
export const useValidateWord = (
  options?: UseMutationOptions<ValidateOutput, Error, ValidateInput>
) => {
  return useMutation({
    mutationFn: postValidateWord,
    ...options,
  });
};

/**
 * Hook to fetch all available game categories.
 * Use this during game setup or lobby creation.
 */
export const useCategories = (
  playerId?: string,
  options?: Partial<UseQueryOptions<CategoriesOutput, Error>>
) => {
  return useQuery({
    queryKey: ["game", "categories", playerId],
    queryFn: () => getCategories({ playerId }),
    staleTime: Infinity, 
    ...options,
  });
};