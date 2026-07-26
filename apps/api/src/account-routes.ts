import {
  CompleteOnboardingInputSchema,
  CompleteOnboardingResultSchema,
  CreateInterestSchema,
  InterestPageSchema,
  ListInterestsQuerySchema,
  UpdateUserInterestSchema,
  UserInterestSchema,
  UserPreferencesInputSchema,
  UserPreferencesSchema,
  UserProfileSchema,
  type UserProfile,
} from "@tempo/contracts";
import type { AccountRepository } from "@tempo/database";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  authenticateBearer,
  type AccessTokenVerifier,
  type AuthPrincipal,
} from "./auth.js";

export type AccountRouteDependencies = {
  accountRepository: AccountRepository;
  accessTokenVerifier: AccessTokenVerifier;
};

const InterestParametersSchema = z
  .object({
    userInterestId: z.uuid(),
  })
  .strict();

const authenticate = async (
  request: FastifyRequest,
  dependencies: AccountRouteDependencies,
): Promise<{ principal: AuthPrincipal; profile: UserProfile }> => {
  const principal = await authenticateBearer(
    request.headers.authorization,
    dependencies.accessTokenVerifier,
  );
  const profile = await dependencies.accountRepository.ensureUser({
    id: principal.userId,
    email: principal.email,
  });
  return { principal, profile };
};

export const registerAccountRoutes = (
  app: FastifyInstance,
  dependencies: AccountRouteDependencies,
): void => {
  app.get("/v1/users/me", async (request) => {
    const { profile } = await authenticate(request, dependencies);
    return UserProfileSchema.parse(profile);
  });

  app.post("/v1/onboarding", async (request) => {
    const { principal } = await authenticate(request, dependencies);
    const input = CompleteOnboardingInputSchema.parse(request.body);
    const result = await dependencies.accountRepository.completeOnboarding(
      principal.userId,
      input,
    );
    return CompleteOnboardingResultSchema.parse(result);
  });

  app.get("/v1/preferences", async (request) => {
    const { principal } = await authenticate(request, dependencies);
    const preferences = await dependencies.accountRepository.getPreferences(
      principal.userId,
    );
    if (preferences === null) {
      throw new Error("The authenticated user has no preference record.");
    }
    return UserPreferencesSchema.parse(preferences);
  });

  app.put("/v1/preferences", async (request) => {
    const { principal } = await authenticate(request, dependencies);
    const input = UserPreferencesInputSchema.parse(request.body);
    const preferences = await dependencies.accountRepository.updatePreferences(
      principal.userId,
      input,
    );
    return UserPreferencesSchema.parse(preferences);
  });

  app.get("/v1/interests", async (request) => {
    const { principal } = await authenticate(request, dependencies);
    const query = ListInterestsQuerySchema.parse(request.query);
    const page = await dependencies.accountRepository.listInterests(
      principal.userId,
      query,
    );
    return InterestPageSchema.parse(page);
  });

  app.post("/v1/interests", async (request, reply) => {
    const { principal } = await authenticate(request, dependencies);
    const input = CreateInterestSchema.parse(request.body);
    const interest = await dependencies.accountRepository.createInterest(
      principal.userId,
      input,
    );
    return reply.status(201).send(UserInterestSchema.parse(interest));
  });

  app.patch("/v1/interests/:userInterestId", async (request, reply) => {
    const { principal } = await authenticate(request, dependencies);
    const { userInterestId } = InterestParametersSchema.parse(request.params);
    const input = UpdateUserInterestSchema.parse(request.body);
    const interest = await dependencies.accountRepository.updateInterest(
      principal.userId,
      userInterestId,
      input,
    );
    if (interest === null) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "The interest was not found.",
        },
      });
    }
    return UserInterestSchema.parse(interest);
  });

  app.delete("/v1/interests/:userInterestId", async (request, reply) => {
    const { principal } = await authenticate(request, dependencies);
    const { userInterestId } = InterestParametersSchema.parse(request.params);
    const deleted = await dependencies.accountRepository.deleteInterest(
      principal.userId,
      userInterestId,
    );
    if (!deleted) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "The interest was not found.",
        },
      });
    }
    return reply.status(204).send();
  });
};
