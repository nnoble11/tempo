"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export const getSupabase = (): SupabaseClient => {
  if (client !== undefined) {
    return client;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url === undefined || key === undefined) {
    throw new Error("Tempo web authentication is not configured.");
  }
  client = createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });
  return client;
};

export const getWebAccessToken = async (): Promise<string> => {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (session === null) {
    throw new Error("Please sign in to continue.");
  }
  return session.access_token;
};
