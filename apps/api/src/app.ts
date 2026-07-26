import { planBriefing } from "@tempo/domain";
import { IdempotencyConflictError } from "@tempo/database";
import { isDeliveryProviderError } from "@tempo/delivery";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";

import {
  registerAccountRoutes,
  type AccountRouteDependencies,
} from "./account-routes.js";
import { AuthenticationError } from "./auth.js";
import {
  registerBriefingRoutes,
  type BriefingRouteDependencies,
} from "./briefing-routes.js";
import {
  registerCalendarRoutes,
  type CalendarRouteDependencies,
} from "./calendar-routes.js";
import {
  registerDeliveryRoutes,
  type DeliveryRouteDependencies,
} from "./delivery-routes.js";
import {
  registerLibraryRoutes,
  type LibraryRouteDependencies,
} from "./library-routes.js";

export type AppDependencies = AccountRouteDependencies &
  BriefingRouteDependencies &
  CalendarRouteDependencies &
  DeliveryRouteDependencies & {
    libraryRepository: LibraryRouteDependencies["libraryRepository"];
    allowedOrigins?: readonly string[];
  };

export const buildApp = (dependencies: AppDependencies): FastifyInstance => {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
  });

  void app.register(cors, {
    origin: [...(dependencies.allowedOrigins ?? ["http://localhost:3000"])],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  app.get("/health", () => ({
    status: "ok",
  }));

  app.post("/v1/briefings/plan", (request) => planBriefing(request.body));

  registerAccountRoutes(app, dependencies);
  registerBriefingRoutes(app, dependencies);
  registerLibraryRoutes(app, dependencies);
  registerCalendarRoutes(app, dependencies);
  registerDeliveryRoutes(app, dependencies);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AuthenticationError) {
      return reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: error.message,
        },
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "INVALID_REQUEST",
          message: "The request did not match the API contract.",
          details: error.issues,
        },
      });
    }

    if (error instanceof IdempotencyConflictError) {
      return reply.status(409).send({
        error: {
          code: "IDEMPOTENCY_CONFLICT",
          message: error.message,
        },
      });
    }

    if (isDeliveryProviderError(error)) {
      return reply.status(503).send({
        error: {
          code: "DELIVERY_PROVIDER_UNAVAILABLE",
          message: error.message,
          details: {
            retryable: error.retryable,
          },
        },
      });
    }

    request.log.error({ error }, "Unhandled API error");
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  });

  return app;
};
