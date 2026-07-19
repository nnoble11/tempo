import { z } from "zod";

const optional = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

export const TestEnvironmentSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    DATABASE_SSL: z.enum(["true", "false"]).default("false"),
    TEST_USER_ID: z.uuid().default("00000000-0000-4000-8000-000000000111"),
    TEST_USER_EMAIL: z.email().default("tempo.tester@example.com"),
    TEST_USER_PASSWORD: optional,
    SUPABASE_URL: optional,
    SUPABASE_SERVICE_ROLE_KEY: optional,
    TEST_API_URL: z.url().default("http://127.0.0.1:3001"),
  })
  .loose()
  .superRefine((value, context) => {
    const supabaseValues = [
      value.SUPABASE_URL,
      value.SUPABASE_SERVICE_ROLE_KEY,
      value.TEST_USER_PASSWORD,
    ].filter((item) => item !== undefined);
    if (supabaseValues.length !== 0 && supabaseValues.length !== 3) {
      context.addIssue({
        code: "custom",
        message:
          "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and TEST_USER_PASSWORD must be configured together",
      });
    }
  });

export type TestEnvironment = z.infer<typeof TestEnvironmentSchema>;
