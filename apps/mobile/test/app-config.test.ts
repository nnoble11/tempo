import type { ConfigContext } from "expo/config";
import { afterEach, describe, expect, it } from "vitest";

import { buildAppConfig } from "../app.config.js";

const context = {
  config: {
    name: "Tempo",
    slug: "tempo",
    plugins: ["expo-router"],
  },
} as ConfigContext;

afterEach(() => {
  delete process.env.TEMPO_ANDROID_USES_CLEARTEXT;
});

describe("mobile app config", () => {
  it("enables cleartext traffic only when the preview profile opts in", () => {
    process.env.TEMPO_ANDROID_USES_CLEARTEXT = "true";

    expect(buildAppConfig(context).plugins).toContainEqual([
      "expo-build-properties",
      {
        android: {
          usesCleartextTraffic: true,
        },
      },
    ]);
  });

  it("keeps the Android platform default for other profiles", () => {
    expect(buildAppConfig(context).plugins).toEqual(["expo-router"]);
  });
});
