import type {
  NormalizedSourceItem,
  SourceRegistration,
} from "@tempo/contracts";

export type HttpFetchRequest = {
  url: string;
  etag?: string;
  lastModified?: string;
};

export type HttpFetchResponse = {
  status: 200 | 304;
  body: string | null;
  etag: string | null;
  lastModified: string | null;
};

export type HttpFetcher = {
  get(request: HttpFetchRequest): Promise<HttpFetchResponse>;
};

export type RejectedSourceItem = {
  index: number;
  reason: string;
};

export type SourceParseResult = {
  items: NormalizedSourceItem[];
  rejected: RejectedSourceItem[];
};

export type SourceFetchOptions = {
  discoveredAt: string;
  etag?: string;
  lastModified?: string;
};

export type SourceFetchResult = SourceParseResult & {
  notModified: boolean;
  etag: string | null;
  lastModified: string | null;
};

export type SourceAdapter = {
  readonly source: SourceRegistration;
  fetch(
    fetcher: HttpFetcher,
    options: SourceFetchOptions,
  ): Promise<SourceFetchResult>;
};
