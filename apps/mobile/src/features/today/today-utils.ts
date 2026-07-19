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
