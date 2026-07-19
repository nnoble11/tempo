import {
  DeliveryEndpointListSchema,
  DeliveryEndpointSchema,
  DeliveryListQuerySchema,
  DeliveryListSchema,
  RequestEndpointVerificationResultSchema,
  UpsertDeliveryEndpointSchema,
  VerifyDeliveryEndpointInputSchema,
} from "@tempo/contracts";
import type { AccountRepository, DeliveryRepository } from "@tempo/database";
import type { DestinationVerificationSender } from "@tempo/delivery";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticateBearer, type AccessTokenVerifier } from "./auth.js";
import {
  createVerificationCode,
  hashVerificationCode,
} from "./endpoint-verification.js";

export type DeliveryRouteDependencies = {
  accountRepository: AccountRepository;
  deliveryRepository: DeliveryRepository;
  accessTokenVerifier: AccessTokenVerifier;
  deliveryVerificationSecret: string;
  verificationSender: DestinationVerificationSender;
};

const EndpointParametersSchema = z
  .object({
    endpointId: z.uuid(),
  })
  .strict();

const authenticate = async (
  request: FastifyRequest,
  dependencies: DeliveryRouteDependencies,
): Promise<{ userId: string; email: string | null }> => {
  const principal = await authenticateBearer(
    request.headers.authorization,
    dependencies.accessTokenVerifier,
  );
  await dependencies.accountRepository.ensureUser({
    id: principal.userId,
    email: principal.email,
  });
  return { userId: principal.userId, email: principal.email };
};

export const registerDeliveryRoutes = (
  app: FastifyInstance,
  dependencies: DeliveryRouteDependencies,
): void => {
  app.get("/v1/delivery-endpoints", async (request) => {
    const { userId } = await authenticate(request, dependencies);
    const items = await dependencies.deliveryRepository.listEndpoints(userId);
    return DeliveryEndpointListSchema.parse({ items });
  });

  app.put("/v1/delivery-endpoints", async (request) => {
    const { userId, email } = await authenticate(request, dependencies);
    const input = UpsertDeliveryEndpointSchema.parse(request.body);
    const endpoint = await dependencies.deliveryRepository.upsertEndpoint(
      userId,
      input,
      email,
    );
    return DeliveryEndpointSchema.parse(endpoint);
  });

  app.delete("/v1/delivery-endpoints/:endpointId", async (request, reply) => {
    const { userId } = await authenticate(request, dependencies);
    const { endpointId } = EndpointParametersSchema.parse(request.params);
    const disabled = await dependencies.deliveryRepository.disableEndpoint(
      userId,
      endpointId,
    );
    if (!disabled) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "The delivery endpoint was not found.",
        },
      });
    }
    return reply.status(204).send();
  });

  app.get("/v1/deliveries", async (request) => {
    const { userId } = await authenticate(request, dependencies);
    const query = DeliveryListQuerySchema.parse(request.query);
    const items = await dependencies.deliveryRepository.listDeliveries(
      userId,
      query.limit,
    );
    return DeliveryListSchema.parse({ items });
  });

  app.post(
    "/v1/delivery-endpoints/:endpointId/verification",
    async (request, reply) => {
      const { userId } = await authenticate(request, dependencies);
      const { endpointId } = EndpointParametersSchema.parse(request.params);
      const code = createVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
      const endpoint =
        await dependencies.deliveryRepository.requestEndpointVerification(
          userId,
          endpointId,
          hashVerificationCode(dependencies.deliveryVerificationSecret, code),
          expiresAt,
        );
      if (endpoint === null) {
        return reply.status(404).send({
          error: {
            code: "NOT_FOUND",
            message: "The delivery endpoint cannot be verified.",
          },
        });
      }
      await dependencies.verificationSender.sendCode(endpoint, code);
      return reply.status(202).send(
        RequestEndpointVerificationResultSchema.parse({
          endpoint,
          expiresAt,
        }),
      );
    },
  );

  app.post(
    "/v1/delivery-endpoints/:endpointId/verification/confirm",
    async (request, reply) => {
      const { userId } = await authenticate(request, dependencies);
      const { endpointId } = EndpointParametersSchema.parse(request.params);
      const { code } = VerifyDeliveryEndpointInputSchema.parse(request.body);
      const result = await dependencies.deliveryRepository.verifyEndpoint(
        userId,
        endpointId,
        hashVerificationCode(dependencies.deliveryVerificationSecret, code),
        new Date().toISOString(),
      );
      if (result.status === "not_found") {
        return reply.status(404).send({
          error: {
            code: "NOT_FOUND",
            message: "The delivery endpoint was not found.",
          },
        });
      }
      if (result.status === "invalid") {
        return reply.status(400).send({
          error: {
            code: "INVALID_VERIFICATION_CODE",
            message: "The verification code is invalid or expired.",
          },
        });
      }
      return DeliveryEndpointSchema.parse(result.endpoint);
    },
  );
};
