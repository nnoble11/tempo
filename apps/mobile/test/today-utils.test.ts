import type { CanonicalBriefingItem } from "@tempo/contracts";
import { describe, expect, it } from "vitest";

import {
  formatBriefingDuration,
  formatItemConfidence,
  getItemConfidence,
  getTodayViewState,
  uniqueItemCitations,
} from "../src/features/today/today-utils";

describe("Today presentation state", () => {
  it("keeps loading, error, empty, and ready states explicit", () => {
    expect(
      getTodayViewState({
        isPending: true,
        isError: false,
        briefing: undefined,
      }),
    ).toBe("loading");
    expect(
      getTodayViewState({
        isPending: false,
        isError: true,
        briefing: undefined,
      }),
    ).toBe("error");
    expect(
      getTodayViewState({
        isPending: false,
        isError: false,
        briefing: null,
      }),
    ).toBe("empty");
  });

  it("formats conservative minute estimates", () => {
    expect(formatBriefingDuration(15)).toBe("1 min");
    expect(formatBriefingDuration(61)).toBe("2 min");
  });

  it("deduplicates citations repeated across grounded claims", () => {
    const citation = {
      citationId: "00000000-0000-4000-8000-000000000001",
      sourceItemId: "00000000-0000-4000-8000-000000000002",
      canonicalUrl: "https://example.com/source",
      sourceTitle: "Primary source",
      publisher: "Example",
      publishedAt: null,
      supportType: "direct" as const,
      supportingText: "Supporting text.",
    };
    const item = {
      claims: [{ citations: [citation] }, { citations: [citation] }],
    } as CanonicalBriefingItem;

    expect(uniqueItemCitations(item)).toEqual([citation]);
  });

  it("summarizes item confidence by the weakest grounded claim", () => {
    const item = {
      claims: [{ confidence: 0.92 }, { confidence: 0.61 }],
    } as CanonicalBriefingItem;

    expect(getItemConfidence(item)).toEqual({ value: 0.61, label: "Moderate" });
    expect(
      getItemConfidence({ claims: [] } as unknown as CanonicalBriefingItem),
    ).toBeNull();
  });

  it("labels confidence bands and formats a readable value", () => {
    expect(
      getItemConfidence({
        claims: [{ confidence: 0.8 }],
      } as CanonicalBriefingItem),
    ).toEqual({ value: 0.8, label: "High" });
    expect(
      getItemConfidence({
        claims: [{ confidence: 0.31 }],
      } as CanonicalBriefingItem),
    ).toEqual({ value: 0.31, label: "Low" });
    expect(formatItemConfidence({ value: 0.61, label: "Moderate" })).toBe(
      "Moderate · 61%",
    );
  });
});
