import {
  CompleteOnboardingInputSchema,
  type CompleteOnboardingInput,
  type DeliveryPreferenceChannel,
  type DesiredDepth,
} from "@tempo/contracts";

export type SuggestedInterest = {
  name: string;
  description: string;
  keywords: string[];
};

export const SUGGESTED_INTERESTS: readonly SuggestedInterest[] = [
  {
    name: "World news",
    description: "Major international developments without daily noise",
    keywords: ["world", "international", "global"],
  },
  {
    name: "Climate science",
    description: "Meaningful research, policy, and environmental changes",
    keywords: ["climate", "environment", "emissions"],
  },
  {
    name: "College football",
    description: "Important team, season, and championship updates",
    keywords: ["college football", "ncaa"],
  },
  {
    name: "Personal finance",
    description: "Economic and financial changes that affect households",
    keywords: ["finance", "economy", "rates"],
  },
  {
    name: "Arts & culture",
    description: "Notable books, film, music, and cultural developments",
    keywords: ["arts", "culture", "film", "music", "books"],
  },
] as const;

export type BuildOnboardingInput = {
  timezone: string;
  locale: string;
  defaultBriefingMinutes: number;
  dailyBriefingTime: string;
  desiredDepth: DesiredDepth;
  deliveryChannels: DeliveryPreferenceChannel[];
  selectedSuggestions: string[];
  customInterests: string[];
};

export const buildOnboardingInput = (
  input: BuildOnboardingInput,
): CompleteOnboardingInput => {
  const suggestionsByName = new Map(
    SUGGESTED_INTERESTS.map((suggestion) => [suggestion.name, suggestion]),
  );
  const selected = input.selectedSuggestions.flatMap((name) => {
    const suggestion = suggestionsByName.get(name);
    return suggestion === undefined ? [] : [suggestion];
  });
  const custom = [
    ...new Set(
      input.customInterests
        .map((interest) => interest.trim())
        .filter((interest) => interest.length > 0),
    ),
  ];

  return CompleteOnboardingInputSchema.parse({
    preferences: {
      timezone: input.timezone,
      locale: input.locale,
      defaultBriefingMinutes: input.defaultBriefingMinutes,
      dailyBriefingTime: input.dailyBriefingTime,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      deliveryChannels: input.deliveryChannels,
      calendarSuggestionsEnabled: false,
      recommendationsEnabled: false,
    },
    interests: [
      ...selected.map((suggestion) => ({
        type: "topic" as const,
        name: suggestion.name,
        description: suggestion.description,
        importance: 4,
        expertiseLevel: "intermediate" as const,
        desiredDepth: input.desiredDepth,
        alertSensitivity: 1,
        preferredSources: [],
        blockedSources: [],
        keywords: suggestion.keywords,
        excludedKeywords: [],
      })),
      ...custom.map((name) => ({
        type: "instruction" as const,
        name,
        description: "Added during mobile onboarding",
        importance: 4,
        expertiseLevel: "intermediate" as const,
        desiredDepth: input.desiredDepth,
        alertSensitivity: 1,
        preferredSources: [],
        blockedSources: [],
        keywords: [],
        excludedKeywords: [],
      })),
    ],
  });
};
