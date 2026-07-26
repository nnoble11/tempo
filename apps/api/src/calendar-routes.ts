import {
  CalendarAvailabilityQuerySchema,
  CalendarAvailabilitySchema,
  CalendarConnectionSchema,
  ConnectDeviceCalendarSchema,
  SyncCalendarAvailabilitySchema,
} from "@tempo/contracts";
import type { AccountRepository, CalendarRepository } from "@tempo/database";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticateBearer, type AccessTokenVerifier } from "./auth.js";

export type CalendarRouteDependencies = {
  accountRepository: AccountRepository;
  calendarRepository: CalendarRepository;
  accessTokenVerifier: AccessTokenVerifier;
};

const ConnectionParametersSchema = z
  .object({
    connectionId: z.uuid(),
  })
  .strict();

const authenticate = async (
  request: FastifyRequest,
  dependencies: CalendarRouteDependencies,
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

export const registerCalendarRoutes = (
  app: FastifyInstance,
  dependencies: CalendarRouteDependencies,
): void => {
  app.put("/v1/calendar/connections/device", async (request) => {
    const userId = await authenticate(request, dependencies);
    const input = ConnectDeviceCalendarSchema.parse(request.body ?? {});
    return CalendarConnectionSchema.parse(
      await dependencies.calendarRepository.connectDeviceCalendar(
        userId,
        input,
      ),
    );
  });

  app.post(
    "/v1/calendar/connections/:connectionId/availability",
    async (request, reply) => {
      const userId = await authenticate(request, dependencies);
      const { connectionId } = ConnectionParametersSchema.parse(request.params);
      const input = SyncCalendarAvailabilitySchema.parse(request.body);
      const connection = await dependencies.calendarRepository.syncAvailability(
        userId,
        connectionId,
        input,
      );
      if (connection === null) {
        return reply.status(404).send({
          error: {
            code: "NOT_FOUND",
            message: "The calendar connection was not found.",
          },
        });
      }
      return CalendarConnectionSchema.parse(connection);
    },
  );

  app.get("/v1/calendar/availability", async (request) => {
    const userId = await authenticate(request, dependencies);
    const query = CalendarAvailabilityQuerySchema.parse(request.query);
    return CalendarAvailabilitySchema.parse(
      await dependencies.calendarRepository.getAvailability(
        userId,
        query.minimumMinutes,
        query.now ?? new Date().toISOString(),
      ),
    );
  });

  app.delete(
    "/v1/calendar/connections/:connectionId",
    async (request, reply) => {
      const userId = await authenticate(request, dependencies);
      const { connectionId } = ConnectionParametersSchema.parse(request.params);
      const disconnected = await dependencies.calendarRepository.disconnect(
        userId,
        connectionId,
      );
      if (!disconnected) {
        return reply.status(404).send({
          error: {
            code: "NOT_FOUND",
            message: "The calendar connection was not found.",
          },
        });
      }
      return reply.status(204).send();
    },
  );
};
