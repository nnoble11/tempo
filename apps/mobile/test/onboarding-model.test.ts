import { describe, expect, it } from "vitest";

import { buildOnboardingInput } from "../src/features/onboarding/onboarding-model.js";

describe("mobile onboarding model", () => {
  it("builds explicit preferences and normalized interests", () => {
    const input = buildOnboardingInput({
      timezone: "America/Los_Angeles",
      locale: "en-US",
      defaultBriefingMinutes: 5,
      dailyBriefingTime: "08:00",
      desiredDepth: "standard",
      deliveryChannels: ["in_app", "push", "email"],
      selectedSuggestions: ["Climate science"],
      customInterests: [" Japanese cooking ", "Japanese cooking"],
    });

    expect(input.preferences).toMatchObject({
      timezone: "America/Los_Angeles",
      deliveryChannels: ["in_app", "push", "email"],
      recommendationsEnabled: false,
    });
    expect(input.interests).toHaveLength(2);
    expect(input.interests.map(({ name }) => name)).toEqual([
      "Climate science",
      "Japanese cooking",
    ]);
  });

  it("requires at least one interest", () => {
    expect(() =>
      buildOnboardingInput({
        timezone: "UTC",
        locale: "en-US",
        defaultBriefingMinutes: 5,
        dailyBriefingTime: "08:00",
        desiredDepth: "brief",
        deliveryChannels: ["in_app"],
        selectedSuggestions: [],
        customInterests: [],
      }),
    ).toThrow();
  });
});
