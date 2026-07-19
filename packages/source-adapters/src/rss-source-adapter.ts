import { createHash } from "node:crypto";

import {
  NormalizedSourceItemSchema,
  SourceRegistrationSchema,
  type NormalizedSourceItem,
  type SourceRegistration,
} from "@tempo/contracts";
import { XMLParser } from "fast-xml-parser";

import type {
  HttpFetcher,
  HttpFetchRequest,
  SourceAdapter,
  SourceFetchOptions,
  SourceFetchResult,
  SourceParseResult,
} from "./types.js";

type UnknownRecord = Record<string, unknown>;

const parser = new XMLParser({
  attributeNamePrefix: "@_",
  ignoreAttributes: false,
  parseTagValue: false,
  processEntities: false,
  trimValues: true,
});

const asRecord = (value: unknown): UnknownRecord | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;

const asArray = (value: unknown): unknown[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

const textValue = (value: unknown): string | undefined => {
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text.length === 0 ? undefined : text;
  }
  if (Array.isArray(value)) {
    return value.map(textValue).find((text) => text !== undefined);
  }
  const record = asRecord(value);
  if (record === undefined) {
    return undefined;
  }
  return textValue(record["#text"]) ?? textValue(record.name);
};

const firstText = (
  record: UnknownRecord,
  keys: readonly string[],
): string | undefined => {
  for (const key of keys) {
    const value = textValue(record[key]);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
};

const decodeCommonEntities = (value: string): string =>
  value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&#39;", "'");

const cleanText = (value: string | undefined): string | null => {
  if (value === undefined) {
    return null;
  }
  const cleaned = decodeCommonEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length === 0 ? null : cleaned.slice(0, 10_000);
};

const normalizeDate = (value: string | undefined): string | null => {
  if (value === undefined) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
};

const normalizeUrl = (value: string): string => {
  const url = new URL(decodeCommonEntities(value));
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Source item URLs must use HTTP or HTTPS.");
  }
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (
      key.toLowerCase().startsWith("utm_") ||
      ["fbclid", "gclid"].includes(key.toLowerCase())
    ) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  return url.toString();
};

const readLink = (entry: UnknownRecord): string | undefined => {
  const linkValue = entry.link;
  const directLink = textValue(linkValue);
  if (directLink !== undefined) {
    return directLink;
  }

  for (const candidate of asArray(linkValue)) {
    const link = asRecord(candidate);
    if (
      link !== undefined &&
      typeof link["@_href"] === "string" &&
      (link["@_rel"] === undefined || link["@_rel"] === "alternate")
    ) {
      return link["@_href"];
    }
  }
  return undefined;
};

const readCategories = (entry: UnknownRecord): string[] =>
  asArray(entry.category)
    .map((category) => {
      const record = asRecord(category);
      return (
        textValue(category) ??
        (record === undefined ? undefined : textValue(record["@_term"]))
      );
    })
    .filter((category): category is string => category !== undefined);

const extractEntries = (
  document: unknown,
): { entries: unknown[]; feedKind: "rss" | "rdf" | "atom" } => {
  const root = asRecord(document);
  const rss = asRecord(root?.rss);
  const channel = asRecord(rss?.channel);
  if (channel !== undefined) {
    return { entries: asArray(channel.item), feedKind: "rss" };
  }

  const rdf = asRecord(root?.["rdf:RDF"]);
  if (rdf !== undefined) {
    return { entries: asArray(rdf.item), feedKind: "rdf" };
  }

  const atom = asRecord(root?.feed);
  if (atom !== undefined) {
    return { entries: asArray(atom.entry), feedKind: "atom" };
  }

  throw new Error("Unsupported RSS or Atom document shape.");
};

const contentHash = (item: {
  canonicalUrl: string;
  title: string;
  author: string | null;
  publishedAt: string | null;
  excerpt: string | null;
}): string =>
  createHash("sha256")
    .update(
      JSON.stringify([
        item.canonicalUrl,
        item.title,
        item.author,
        item.publishedAt,
        item.excerpt,
      ]),
    )
    .digest("hex");

export class RssSourceAdapter implements SourceAdapter {
  public readonly source: SourceRegistration;

  public constructor(registration: SourceRegistration) {
    this.source = SourceRegistrationSchema.parse(registration);
  }

  public parse(xml: string, discoveredAt: string): SourceParseResult {
    const { entries, feedKind } = extractEntries(parser.parse(xml));
    const items: NormalizedSourceItem[] = [];
    const rejected: SourceParseResult["rejected"] = [];

    entries.forEach((value, index) => {
      try {
        const entry = asRecord(value);
        if (entry === undefined) {
          throw new Error("Feed entry is not an object.");
        }
        const title = cleanText(firstText(entry, ["title"]));
        const link = readLink(entry);
        if (title === null || link === undefined) {
          throw new Error("Feed entry requires a title and link.");
        }

        const canonicalUrl = normalizeUrl(link);
        const author =
          cleanText(firstText(entry, ["dc:creator", "creator", "author"])) ??
          null;
        const publishedAt = normalizeDate(
          firstText(entry, ["pubDate", "published", "updated", "dc:date"]),
        );
        const excerpt = cleanText(
          firstText(entry, [
            "description",
            "summary",
            "content:encoded",
            "content",
          ]),
        );
        const normalized = {
          sourceKey: this.source.key,
          externalId:
            firstText(entry, ["guid", "id"])?.slice(0, 1_000) ?? canonicalUrl,
          canonicalUrl,
          title,
          author,
          publishedAt,
          discoveredAt,
          language: this.source.defaultLanguage,
          excerpt,
          contentHash: "",
          metadata: {
            categories: readCategories(entry),
            feedKind,
          },
        };
        normalized.contentHash = contentHash(normalized);
        items.push(NormalizedSourceItemSchema.parse(normalized));
      } catch (error) {
        rejected.push({
          index,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    return { items, rejected };
  }

  public async fetch(
    fetcher: HttpFetcher,
    options: SourceFetchOptions,
  ): Promise<SourceFetchResult> {
    const request: HttpFetchRequest = {
      url: this.source.feedUrl,
      ...(options.etag === undefined ? {} : { etag: options.etag }),
      ...(options.lastModified === undefined
        ? {}
        : { lastModified: options.lastModified }),
    };
    const response = await fetcher.get(request);
    if (response.status === 304) {
      return {
        items: [],
        rejected: [],
        notModified: true,
        etag: response.etag,
        lastModified: response.lastModified,
      };
    }
    if (response.body === null) {
      throw new Error("A successful source response must include a body.");
    }

    return {
      ...this.parse(response.body, options.discoveredAt),
      notModified: false,
      etag: response.etag,
      lastModified: response.lastModified,
    };
  }
}
