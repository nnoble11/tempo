import { createRemoteJWKSet, jwtVerify } from "jose";

export type AuthPrincipal = {
  userId: string;
  email: string | null;
};

export type AccessTokenVerifier = {
  verify(accessToken: string): Promise<AuthPrincipal>;
};

export class AuthenticationError extends Error {
  public constructor(message = "Authentication is required.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export type SupabaseAccessTokenVerifierOptions = {
  supabaseUrl: string;
  audience: string;
};

export class SupabaseAccessTokenVerifier implements AccessTokenVerifier {
  readonly #audience: string;
  readonly #issuer: string;
  readonly #jwks: ReturnType<typeof createRemoteJWKSet>;

  public constructor({
    supabaseUrl,
    audience,
  }: SupabaseAccessTokenVerifierOptions) {
    const rootUrl = supabaseUrl.replace(/\/+$/, "");
    this.#audience = audience;
    this.#issuer = `${rootUrl}/auth/v1`;
    this.#jwks = createRemoteJWKSet(
      new URL(`${rootUrl}/auth/v1/.well-known/jwks.json`),
    );
  }

  public async verify(accessToken: string): Promise<AuthPrincipal> {
    try {
      const { payload } = await jwtVerify(accessToken, this.#jwks, {
        audience: this.#audience,
        issuer: this.#issuer,
      });
      if (payload.sub === undefined) {
        throw new AuthenticationError("The access token has no subject.");
      }

      return {
        userId: payload.sub,
        email: typeof payload.email === "string" ? payload.email : null,
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError("The access token is invalid or expired.");
    }
  }
}

export const authenticateBearer = async (
  authorizationHeader: string | undefined,
  verifier: AccessTokenVerifier,
): Promise<AuthPrincipal> => {
  if (authorizationHeader === undefined) {
    throw new AuthenticationError();
  }

  const match = /^Bearer ([^\s]+)$/i.exec(authorizationHeader);
  const accessToken = match?.[1];
  if (accessToken === undefined) {
    throw new AuthenticationError(
      "Expected an Authorization header using the Bearer scheme.",
    );
  }

  return verifier.verify(accessToken);
};
