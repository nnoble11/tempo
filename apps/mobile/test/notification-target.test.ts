import { describe, expect, it } from "vitest";

import { briefingIdFromNotificationData } from "../src/features/delivery/notification-target";

describe("notification targets", () => {
  it("accepts only a valid briefing UUID", () => {
    expect(
      briefingIdFromNotificationData({
        briefingId: "00000000-0000-4000-8000-000000000003",
      }),
    ).toBe("00000000-0000-4000-8000-000000000003");
    expect(
      briefingIdFromNotificationData({ briefingId: "../settings" }),
    ).toBeNull();
    expect(briefingIdFromNotificationData(undefined)).toBeNull();
  });
});
