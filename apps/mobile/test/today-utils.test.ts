import type { CanonicalBriefingItem } from "@tempo/contracts";
import { describe, expect, it } from "vitest";

import {
  describeItemEvidenceSupport,
  formatBriefingDuration,
  formatItemEvidenceSupport,
  getItemEvidenceSupport,
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
    expect(formatBriefingDuration(15)).toBe("<1 min");
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

  it("summarizes source support by the weakest grounded claim", () => {
    const item = {
      claims: [{ confidence: 0.92 }, { confidence: 0.61 }],
    } as CanonicalBriefingItem;

    expect(getItemEvidenceSupport(item)).toEqual({
      value: 0.61,
      label: "Mixed",
    });
    expect(
      getItemEvidenceSupport({
        claims: [],
      } as unknown as CanonicalBriefingItem),
    ).toBeNull();
  });

  it("labels evidence bands without presenting an opaque percentage", () => {
    expect(
      getItemEvidenceSupport({
        claims: [{ confidence: 0.8 }],
      } as CanonicalBriefingItem),
    ).toEqual({ value: 0.8, label: "Strong" });
    expect(
      getItemEvidenceSupport({
        claims: [{ confidence: 0.31 }],
      } as CanonicalBriefingItem),
    ).toEqual({ value: 0.31, label: "Limited" });
    expect(formatItemEvidenceSupport({ value: 0.61, label: "Mixed" })).toBe(
      "Mixed source support",
    );
    expect(describeItemEvidenceSupport({ value: 0.61, label: "Mixed" })).toBe(
      "At least one factual claim has only moderate support from the cited sources. This is an evidence check, not a prediction or guarantee.",
    );
  });
});
