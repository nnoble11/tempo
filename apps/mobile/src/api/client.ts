import { getAccessToken } from "../auth/supabase";

export class MobileApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number | null = null,
  ) {
    super(message);
    this.name = "MobileApiError";
  }
}

const getApiUrl = (): string => {
  const value = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "");
  if (value === undefined || value.length === 0) {
    throw new MobileApiError(
      "EXPO_PUBLIC_API_URL is required to connect to Tempo.",
    );
  }
  return value;
};

const responseMessage = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  try {
    const body = (await response.json()) as {
      error?: {
        message?: unknown;
      };
    };
    return typeof body.error?.message === "string"
      ? body.error.message
      : fallback;
  } catch {
    return fallback;
  }
};

export const authenticatedRequest = async (
  path: string,
  init: RequestInit = {},
): Promise<Response> => {
  const token = await getAccessToken();
  if (token === null) {
    throw new MobileApiError("Sign in is required to connect to Tempo.", 401);
  }

  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  headers.set("authorization", `Bearer ${token}`);
  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${getApiUrl()}${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    throw new MobileApiError(
      await responseMessage(
        response,
        response.status === 401
          ? "Your session expired. Please sign in again."
          : "Tempo could not complete that request.",
      ),
      response.status,
    );
  }
  return response;
};
