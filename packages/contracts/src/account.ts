import { z } from "zod";

export const TimeOfDaySchema = z
  .string()
  .regex(
    /^(?:[01]\d|2[0-3]):[0-5]\d$/,
    "Expected a 24-hour time in HH:MM format",
  );

const TimezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(
    (timezone) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Expected a valid IANA time zone" },
  );

const LocaleSchema = z
  .string()
  .trim()
  .min(2)
  .max(35)
  .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/);

const SourceListSchema = z.array(z.string().trim().min(1).max(200)).max(50);
const KeywordListSchema = z.array(z.string().trim().min(1).max(100)).max(50);

export const UserSchema = z
  .object({
    id: z.uuid(),
    email: z.email().nullable(),
    onboardingCompletedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const DeliveryPreferenceChannelSchema = z.enum([
  "in_app",
  "push",
  "email",
  "sms",
]);

const DeliveryPreferenceChannelsSchema = z
  .array(DeliveryPreferenceChannelSchema)
  .min(1)
  .max(4)
  .superRefine((channels, context) => {
    if (!channels.includes("in_app")) {
      context.addIssue({
        code: "custom",
        message: "The canonical in-app briefing must remain enabled",
      });
    }
    if (new Set(channels).size !== channels.length) {
      context.addIssue({
        code: "custom",
        message: "Delivery preference channels must be unique",
      });
    }
  });

export const UserPreferencesInputSchema = z
  .object({
    timezone: TimezoneSchema,
    locale: LocaleSchema,
    defaultBriefingMinutes: z.number().int().min(1).max(60),
    dailyBriefingTime: TimeOfDaySchema,
    quietHoursStart: TimeOfDaySchema.nullable(),
    quietHoursEnd: TimeOfDaySchema.nullable(),
    deliveryChannels: DeliveryPreferenceChannelsSchema,
    calendarSuggestionsEnabled: z.boolean(),
    recommendationsEnabled: z.boolean(),
  })
  .strict()
  .superRefine((preferences, context) => {
    if (
      (preferences.quietHoursStart === null) !==
      (preferences.quietHoursEnd === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Quiet-hour start and end must both be set or both be null",
        path: ["quietHoursStart"],
      });
    }
    if (
      preferences.quietHoursStart !== null &&
      preferences.quietHoursStart === preferences.quietHoursEnd
    ) {
      context.addIssue({
        code: "custom",
        message: "Quiet-hour start and end must differ",
        path: ["quietHoursEnd"],
      });
    }
  });

export const UserPreferencesSchema = UserPreferencesInputSchema.extend({
  userId: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).strict();

export const UserProfileSchema = z
  .object({
    user: UserSchema,
    preferences: UserPreferencesSchema,
  })
  .strict();

export const InterestTypeSchema = z.enum(["topic", "entity", "instruction"]);
export const ExpertiseLevelSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
  "expert",
]);
export const DesiredDepthSchema = z.enum(["brief", "standard", "deep"]);

export const CreateInterestSchema = z
  .object({
    type: InterestTypeSchema,
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(2_000).nullable().optional(),
    importance: z.number().int().min(1).max(5),
    expertiseLevel: ExpertiseLevelSchema,
    desiredDepth: DesiredDepthSchema,
    alertSensitivity: z.number().int().min(0).max(3),
    preferredSources: SourceListSchema.default([]),
    blockedSources: SourceListSchema.default([]),
    keywords: KeywordListSchema.default([]),
    excludedKeywords: KeywordListSchema.default([]),
  })
  .strict();

export const UpdateUserInterestSchema = z
  .object({
    importance: z.number().int().min(1).max(5).optional(),
    expertiseLevel: ExpertiseLevelSchema.optional(),
    desiredDepth: DesiredDepthSchema.optional(),
    alertSensitivity: z.number().int().min(0).max(3).optional(),
    preferredSources: SourceListSchema.optional(),
    blockedSources: SourceListSchema.optional(),
    keywords: KeywordListSchema.optional(),
    excludedKeywords: KeywordListSchema.optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one interest setting must be provided",
  });

export const UserInterestSchema = z
  .object({
    id: z.uuid(),
    interestId: z.uuid(),
    type: InterestTypeSchema,
    name: z.string().min(1),
    description: z.string().nullable(),
    importance: z.number().int().min(1).max(5),
    expertiseLevel: ExpertiseLevelSchema,
    desiredDepth: DesiredDepthSchema,
    alertSensitivity: z.number().int().min(0).max(3),
    preferredSources: SourceListSchema,
    blockedSources: SourceListSchema,
    keywords: KeywordListSchema,
    excludedKeywords: KeywordListSchema,
    active: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    lastInteractedAt: z.iso.datetime().nullable(),
  })
  .strict();

export const ListInterestsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.uuid().optional(),
  })
  .strict();

export const InterestPageSchema = z
  .object({
    items: z.array(UserInterestSchema),
    nextCursor: z.uuid().nullable(),
  })
  .strict();

export const CompleteOnboardingInputSchema = z
  .object({
    preferences: UserPreferencesInputSchema,
    interests: z.array(CreateInterestSchema).min(1).max(25),
  })
  .strict()
  .superRefine((input, context) => {
    const interestNames = input.interests.map(({ name }) =>
      name.trim().toLocaleLowerCase(),
    );
    if (new Set(interestNames).size !== interestNames.length) {
      context.addIssue({
        code: "custom",
        message: "Onboarding interests must have unique names",
        path: ["interests"],
      });
    }
  });

export const CompleteOnboardingResultSchema = z
  .object({
    profile: UserProfileSchema,
    interests: z.array(UserInterestSchema).min(1),
  })
  .strict();

export type User = z.infer<typeof UserSchema>;
export type UserPreferencesInput = z.infer<typeof UserPreferencesInputSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type CreateInterest = z.infer<typeof CreateInterestSchema>;
export type UpdateUserInterest = z.infer<typeof UpdateUserInterestSchema>;
export type UserInterest = z.infer<typeof UserInterestSchema>;
export type ListInterestsQuery = z.infer<typeof ListInterestsQuerySchema>;
export type InterestPage = z.infer<typeof InterestPageSchema>;
export type DesiredDepth = z.infer<typeof DesiredDepthSchema>;
export type ExpertiseLevel = z.infer<typeof ExpertiseLevelSchema>;
export type DeliveryPreferenceChannel = z.infer<
  typeof DeliveryPreferenceChannelSchema
>;
export type CompleteOnboardingInput = z.infer<
  typeof CompleteOnboardingInputSchema
>;
export type CompleteOnboardingResult = z.infer<
  typeof CompleteOnboardingResultSchema
>;
