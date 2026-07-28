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
  if (seconds < 60) return "<1 min";
  const minutes = Math.ceil(seconds / 60);
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

export type ItemEvidenceSupport = {
  /** The item's weakest grounded claim confidence, in [0, 1]. */
  value: number;
  label: "Strong" | "Mixed" | "Limited";
};

/**
 * Summarizes how well the cited evidence supports an item's factual claims.
 * Uses the minimum so a single weakly-supported claim cannot hide behind
 * stronger ones. Returns null for items without grounded claims.
 */
export const getItemEvidenceSupport = (
  item: CanonicalBriefingItem,
): ItemEvidenceSupport | null => {
  if (item.claims.length === 0) {
    return null;
  }
  const value = Math.min(...item.claims.map((claim) => claim.confidence));
  const label = value >= 0.75 ? "Strong" : value >= 0.5 ? "Mixed" : "Limited";
  return { value, label };
};

export const formatItemEvidenceSupport = (
  support: ItemEvidenceSupport,
): string => `${support.label} source support`;

export const describeItemEvidenceSupport = (
  support: ItemEvidenceSupport,
): string => {
  const claimSummary =
    support.label === "Strong"
      ? "Every factual claim is strongly supported by the cited sources."
      : support.label === "Mixed"
        ? "At least one factual claim has only moderate support from the cited sources."
        : "At least one factual claim has limited support from the cited sources.";
  return `${claimSummary} This is an evidence check, not a prediction or guarantee.`;
};
