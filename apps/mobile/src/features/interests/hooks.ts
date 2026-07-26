import { type CreateInterest, type UpdateUserInterest } from "@tempo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createInterest,
  deleteInterest,
  fetchInterests,
  updateInterest,
} from "./api";

export const interestsQueryKey = ["interests"] as const;

export const useInterests = () =>
  useQuery({
    queryKey: interestsQueryKey,
    queryFn: fetchInterests,
  });

export const useCreateInterest = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInterest) => createInterest(input),
    onSuccess: () => client.invalidateQueries({ queryKey: interestsQueryKey }),
  });
};

export const useUpdateInterest = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInterest }) =>
      updateInterest(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: interestsQueryKey }),
  });
};

export const useDeleteInterest = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteInterest,
    onSuccess: () => client.invalidateQueries({ queryKey: interestsQueryKey }),
  });
};
