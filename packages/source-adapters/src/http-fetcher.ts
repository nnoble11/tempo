import type {
  HttpFetcher,
  HttpFetchRequest,
  HttpFetchResponse,
} from "./types.js";

export type FetchHttpClientOptions = {
  timeoutMilliseconds?: number;
  userAgent?: string;
};

export class SourceHttpError extends Error {
  public readonly retryable: boolean;

  public constructor(
    public readonly status: number,
    public readonly url: string,
  ) {
    super(`Source request failed with HTTP ${status} for ${url}`);
    this.name = "SourceHttpError";
    this.retryable =
      status === 408 || status === 425 || status === 429 || status >= 500;
  }
}

export const isRetryableSourceError = (error: unknown): boolean => {
  if (error instanceof SourceHttpError) {
    return error.retryable;
  }
  if (error instanceof TypeError) {
    return true;
  }
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
};

export class FetchHttpClient implements HttpFetcher {
  readonly #timeoutMilliseconds: number;
  readonly #userAgent: string;

  public constructor({
    timeoutMilliseconds = 15_000,
    userAgent = "Tempo-source-ingestion/0.1",
  }: FetchHttpClientOptions = {}) {
    this.#timeoutMilliseconds = timeoutMilliseconds;
    this.#userAgent = userAgent;
  }

  public async get(request: HttpFetchRequest): Promise<HttpFetchResponse> {
    const headers = new Headers({
      accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9",
      "user-agent": this.#userAgent,
    });
    if (request.etag !== undefined) {
      headers.set("if-none-match", request.etag);
    }
    if (request.lastModified !== undefined) {
      headers.set("if-modified-since", request.lastModified);
    }

    const response = await fetch(request.url, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(this.#timeoutMilliseconds),
    });

    if (response.status === 304) {
      return {
        status: 304,
        body: null,
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
      };
    }
    if (!response.ok) {
      throw new SourceHttpError(response.status, request.url);
    }

    return {
      status: 200,
      body: await response.text(),
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
    };
  }
}
