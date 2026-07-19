import { describe, expect, it } from "vitest";

import {
  isQuietTime,
  nextAllowedDeliveryTime,
} from "../src/delivery-window.js";

describe("delivery windows", () => {
  it("moves a delivery to the end of overnight quiet hours", () => {
    expect(
      nextAllowedDeliveryTime(
        "2026-07-18T12:30:00.000Z",
        "America/Los_Angeles",
        "22:00",
        "07:00",
      ),
    ).toBe("2026-07-18T14:00:00.000Z");
  });

  it("respects daylight-saving transitions in the user's timezone", () => {
    expect(
      nextAllowedDeliveryTime(
        "2026-11-01T08:30:00.000Z",
        "America/Los_Angeles",
        "22:00",
        "07:00",
      ),
    ).toBe("2026-11-01T15:00:00.000Z");
  });

  it("leaves an allowed instant unchanged", () => {
    const instant = new Date("2026-07-18T19:00:00.000Z");
    expect(isQuietTime(instant, "America/Los_Angeles", "22:00", "07:00")).toBe(
      false,
    );
    expect(
      nextAllowedDeliveryTime(instant.toISOString(), "UTC", null, null),
    ).toBe(instant.toISOString());
  });
});
