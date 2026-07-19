import {
  createDatabasePool,
  PostgresDeliveryRepository,
} from "@tempo/database";
import {
  DeliveryProviderRegistry,
  ExpoPushProvider,
  ExpoPushReceiptClient,
  ResendEmailProvider,
  runDeliveryCycle,
  runPushReceiptCycle,
  TwilioSmsProvider,
  type DeliveryProvider,
} from "@tempo/delivery";

import { loadDeliveryConfig } from "./config.js";

const config = loadDeliveryConfig(process.env);
const pool = createDatabasePool({
  connectionString: config.databaseUrl,
  useSsl: config.databaseSsl,
});
const providers: DeliveryProvider[] = [
  new ExpoPushProvider({
    ...(config.expoAccessToken === undefined
      ? {}
      : { accessToken: config.expoAccessToken }),
  }),
];
if (config.resend !== undefined) {
  providers.push(new ResendEmailProvider(config.resend));
}
if (config.twilio !== undefined) {
  providers.push(new TwilioSmsProvider(config.twilio));
}
const deliveryRepository = new PostgresDeliveryRepository(pool);

try {
  const summary = await runDeliveryCycle({
    repository: deliveryRepository,
    providers: new DeliveryProviderRegistry(providers),
    workerId: config.workerId,
    maxDeliveries: config.maxDeliveries,
    leaseDurationMilliseconds: config.leaseDurationMilliseconds,
    maxAttempts: config.maxAttempts,
  });
  const receipts = await runPushReceiptCycle({
    repository: deliveryRepository,
    client: new ExpoPushReceiptClient({
      ...(config.expoAccessToken === undefined
        ? {}
        : { accessToken: config.expoAccessToken }),
    }),
    workerId: `${config.workerId}:receipts`,
    limit: config.maxDeliveries,
  });
  process.stdout.write(
    `${JSON.stringify({
      event: "briefing_delivery_cycle_completed",
      ...summary,
      receipts,
    })}\n`,
  );
  if (summary.outcomes.some(({ status }) => status === "failed")) {
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      event: "briefing_delivery_cycle_failed",
      error:
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : "Unknown delivery runner error",
    })}\n`,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
