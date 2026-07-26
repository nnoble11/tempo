import {
  InterestPageSchema,
  UserInterestSchema,
  type CreateInterest,
  type InterestPage,
  type UpdateUserInterest,
  type UserInterest,
} from "@tempo/contracts";

import { authenticatedRequest } from "../../api/client";

export const fetchInterests = async (): Promise<InterestPage> => {
  const response = await authenticatedRequest("/v1/interests?limit=100");
  return InterestPageSchema.parse(await response.json());
};

export const createInterest = async (
  input: CreateInterest,
): Promise<UserInterest> => {
  const response = await authenticatedRequest("/v1/interests", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return UserInterestSchema.parse(await response.json());
};

export const updateInterest = async (
  userInterestId: string,
  input: UpdateUserInterest,
): Promise<UserInterest> => {
  const response = await authenticatedRequest(
    `/v1/interests/${userInterestId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
  return UserInterestSchema.parse(await response.json());
};

export const deleteInterest = async (userInterestId: string): Promise<void> => {
  await authenticatedRequest(`/v1/interests/${userInterestId}`, {
    method: "DELETE",
  });
};
