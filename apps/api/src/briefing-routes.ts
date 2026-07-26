import {
  BriefingInteractionSchema,
  BriefingHistoryPageSchema,
  CanonicalBriefingSchema,
  CreateBriefingInteractionSchema,
  LibraryPageQuerySchema,
  TodayBriefingResponseSchema,
} from "@tempo/contracts";
import type { AccountRepository, BriefingRepository } from "@tempo/database";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticateBearer, type AccessTokenVerifier } from "./auth.js";

export type BriefingRouteDependencies = {
  accountRepository: AccountRepository;
  briefingRepository: BriefingRepository;
  accessTokenVerifier: AccessTokenVerifier;
};

const BriefingParametersSchema = z
  .object({
    briefingId: z.uuid(),
  })
  .strict();

const BriefingItemParametersSchema = z
  .object({
    briefingId: z.uuid(),
    briefingItemId: z.uuid(),
  })
  .strict();

const authenticate = async (
  request: FastifyRequest,
  dependencies: BriefingRouteDependencies,
): Promise<string> => {
  const principal = await authenticateBearer(
    request.headers.authorization,
    dependencies.accessTokenVerifier,
  );
  await dependencies.accountRepository.ensureUser({
    id: principal.userId,
    email: principal.email,
  });
  return principal.userId;
};

export const registerBriefingRoutes = (
  app: FastifyInstance,
  dependencies: BriefingRouteDependencies,
): void => {
  app.get("/v1/briefings/today", async (request) => {
    const userId = await authenticate(request, dependencies);
    const briefing = await dependencies.briefingRepository.getLatestBriefing(
      userId,
      new Date().toISOString(),
    );
    return TodayBriefingResponseSchema.parse({ briefing });
  });

  app.get("/v1/briefings", async (request) => {
    const userId = await authenticate(request, dependencies);
    const query = LibraryPageQuerySchema.parse(request.query);
    return BriefingHistoryPageSchema.parse(
      await dependencies.briefingRepository.listBriefings(userId, query),
    );
  });

  app.get("/v1/briefings/:briefingId", async (request, reply) => {
    const userId = await authenticate(request, dependencies);
    const { briefingId } = BriefingParametersSchema.parse(request.params);
    const briefing = await dependencies.briefingRepository.getBriefing(
      userId,
      briefingId,
    );
    if (briefing === null) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "The briefing was not found.",
        },
      });
    }
    return CanonicalBriefingSchema.parse(briefing);
  });

  app.post(
    "/v1/briefings/:briefingId/items/:briefingItemId/interactions",
    async (request, reply) => {
      const userId = await authenticate(request, dependencies);
      const { briefingId, briefingItemId } = BriefingItemParametersSchema.parse(
        request.params,
      );
      const input = CreateBriefingInteractionSchema.parse(request.body);
      const interaction =
        await dependencies.briefingRepository.recordInteraction(
          userId,
          briefingId,
          briefingItemId,
          input,
        );
      if (interaction === null) {
        return reply.status(404).send({
          error: {
            code: "NOT_FOUND",
            message: "The briefing item was not found.",
          },
        });
      }
      return reply
        .status(201)
        .send(BriefingInteractionSchema.parse(interaction));
    },
  );
};
