import {
  BriefingItemStateListSchema,
  BriefingItemStateSchema,
  LibraryItemPageSchema,
  LibraryPageQuerySchema,
  UpdateBriefingItemStateSchema,
} from "@tempo/contracts";
import type {
  AccountRepository,
  LibraryKind,
  LibraryRepository,
} from "@tempo/database";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticateBearer, type AccessTokenVerifier } from "./auth.js";

export type LibraryRouteDependencies = {
  accountRepository: AccountRepository;
  libraryRepository: LibraryRepository;
  accessTokenVerifier: AccessTokenVerifier;
};

const ItemParametersSchema = z
  .object({
    briefingItemId: z.uuid(),
  })
  .strict();

const BriefingParametersSchema = z
  .object({
    briefingId: z.uuid(),
  })
  .strict();

const authenticate = async (
  request: FastifyRequest,
  dependencies: LibraryRouteDependencies,
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

export const registerLibraryRoutes = (
  app: FastifyInstance,
  dependencies: LibraryRouteDependencies,
): void => {
  app.put(
    "/v1/briefing-items/:briefingItemId/state",
    async (request, reply) => {
      const userId = await authenticate(request, dependencies);
      const { briefingItemId } = ItemParametersSchema.parse(request.params);
      const input = UpdateBriefingItemStateSchema.parse(request.body);
      const result = await dependencies.libraryRepository.updateItemState(
        userId,
        briefingItemId,
        input,
      );
      if (!result.found) {
        return reply.status(404).send({
          error: {
            code: "NOT_FOUND",
            message: "The briefing item was not found.",
          },
        });
      }
      return result.state === null
        ? reply.status(204).send()
        : BriefingItemStateSchema.parse(result.state);
    },
  );

  app.get("/v1/briefings/:briefingId/item-states", async (request) => {
    const userId = await authenticate(request, dependencies);
    const { briefingId } = BriefingParametersSchema.parse(request.params);
    const items = await dependencies.libraryRepository.listBriefingItemStates(
      userId,
      briefingId,
    );
    return BriefingItemStateListSchema.parse({ items });
  });

  const registerCollection = (path: string, kind: LibraryKind): void => {
    app.get(path, async (request) => {
      const userId = await authenticate(request, dependencies);
      const query = LibraryPageQuerySchema.parse(request.query);
      return LibraryItemPageSchema.parse(
        await dependencies.libraryRepository.listItems(userId, kind, query),
      );
    });
  };

  registerCollection("/v1/library/saved", "saved");
  registerCollection("/v1/library/later", "deferred");
};
