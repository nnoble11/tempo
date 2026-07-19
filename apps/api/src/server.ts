import {
  createDatabasePool,
  PostgresAccountRepository,
  PostgresBriefingRepository,
  PostgresDeliveryRepository,
  runMigrations,
} from "@tempo/database";
import { ProviderVerificationSender } from "@tempo/delivery";

import { buildApp } from "./app.js";
import { SupabaseAccessTokenVerifier } from "./auth.js";
import { loadApiConfig } from "./config.js";

const config = loadApiConfig(process.env);
const pool = createDatabasePool({
  connectionString: config.databaseUrl,
  useSsl: config.databaseSsl,
});

if (config.migrateOnStart) {
  await runMigrations(pool);
}

const app = buildApp({
  accountRepository: new PostgresAccountRepository(pool),
  briefingRepository: new PostgresBriefingRepository(pool),
  deliveryRepository: new PostgresDeliveryRepository(pool),
  allowedOrigins: config.allowedOrigins,
  deliveryVerificationSecret: config.deliveryVerificationSecret,
  verificationSender: new ProviderVerificationSender({
    ...(config.resend === undefined ? {} : { resend: config.resend }),
    ...(config.twilio === undefined ? {} : { twilio: config.twilio }),
  }),
  accessTokenVerifier: new SupabaseAccessTokenVerifier({
    supabaseUrl: config.supabaseUrl,
    audience: config.supabaseJwtAudience,
  }),
});
app.addHook("onClose", async () => pool.end());

try {
  await app.listen({
    host: config.host,
    port: config.port,
  });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
