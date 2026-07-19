import type { CanonicalBriefingItem } from "@tempo/contracts";
import { describe, expect, it } from "vitest";

import {
  formatBriefingDuration,
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
});
