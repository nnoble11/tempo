import type {
  BriefingCitationSnapshot,
  CanonicalBriefing,
  CanonicalBriefingItem,
} from "@tempo/contracts";

export type TodayViewState = "loading" | "error" | "empty" | "ready";

export const getTodayViewState = (input: {
  isPending: boolean;
  isError: boolean;
  briefing: CanonicalBriefing | null | undefined;
}): TodayViewState => {
  if (input.isPending) {
    return "loading";
  }
  if (input.isError) {
    return "error";
  }
  return input.briefing === null || input.briefing === undefined
    ? "empty"
    : "ready";
};

export const formatBriefingDuration = (seconds: number): string => {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `${minutes} min`;
};

export const uniqueItemCitations = (
  item: CanonicalBriefingItem,
): BriefingCitationSnapshot[] => [
  ...new Map(
    item.claims
      .flatMap(({ citations }) => citations)
      .map((citation) => [citation.citationId, citation]),
  ).values(),
];

export type ItemConfidence = {
  /** The item's weakest grounded claim confidence, in [0, 1]. */
  value: number;
  label: "High" | "Moderate" | "Low";
};

/**
 * Summarizes an item's claim confidences for display. Uses the minimum so a
 * single weakly-supported claim cannot hide behind stronger ones. Returns null
 * for items without grounded claims.
 */
export const getItemConfidence = (
  item: CanonicalBriefingItem,
): ItemConfidence | null => {
  if (item.claims.length === 0) {
    return null;
  }
  const value = Math.min(...item.claims.map((claim) => claim.confidence));
  const label = value >= 0.75 ? "High" : value >= 0.5 ? "Moderate" : "Low";
  return { value, label };
};

export const formatItemConfidence = (confidence: ItemConfidence): string =>
  `${confidence.label} · ${Math.round(confidence.value * 100)}%`;
