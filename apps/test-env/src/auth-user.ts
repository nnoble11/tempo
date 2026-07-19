import { createClient } from "@supabase/supabase-js";

import type { TestEnvironment } from "./config.js";

export const ensureTestAuthUser = async (
  environment: TestEnvironment,
): Promise<string> => {
  if (
    environment.SUPABASE_URL === undefined ||
    environment.SUPABASE_SERVICE_ROLE_KEY === undefined ||
    environment.TEST_USER_PASSWORD === undefined
  ) {
    return environment.TEST_USER_ID;
  }
  const supabase = createClient(
    environment.SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const existing = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });
  if (existing.error !== null) throw existing.error;
  const user = existing.data.users.find(
    ({ email }) => email?.toLocaleLowerCase() === environment.TEST_USER_EMAIL,
  );
  if (user !== undefined) {
    await supabase.auth.admin.updateUserById(user.id, {
      password: environment.TEST_USER_PASSWORD,
      email_confirm: true,
    });
    return user.id;
  }
  const created = await supabase.auth.admin.createUser({
    email: environment.TEST_USER_EMAIL,
    password: environment.TEST_USER_PASSWORD,
    email_confirm: true,
  });
  if (created.error !== null) throw created.error;
  return created.data.user.id;
};
