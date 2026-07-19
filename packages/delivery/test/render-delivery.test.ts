import { describe, expect, it } from "vitest";

import { renderCanonicalDelivery } from "../src/index.js";
import { fixtureCanonicalBriefing } from "../../../test/fixtures/briefing.js";

describe("canonical delivery rendering", () => {
  it("renders push, email, and SMS from the same stored briefing", () => {
    const briefing = fixtureCanonicalBriefing();
    const briefingUrl = `https://tempo.example/briefings/${briefing.id}`;
    const push = renderCanonicalDelivery({
      briefing,
      channel: "push",
      destination: "ExpoPushToken[fixture-token]",
      briefingUrl,
    });
    const email = renderCanonicalDelivery({
      briefing,
      channel: "email",
      destination: "reader@example.com",
      briefingUrl,
    });
    const sms = renderCanonicalDelivery({
      briefing,
      channel: "sms",
      destination: "+14155550123",
      briefingUrl,
    });

    expect(push).toMatchObject({
      channel: "push",
      data: {
        briefingId: briefing.id,
        url: briefingUrl,
      },
    });
    expect(email).toMatchObject({
      channel: "email",
      to: "reader@example.com",
    });
    if (email.channel !== "email") {
      throw new Error("Expected the email rendering.");
    }
    expect(email.text).toContain(briefing.items[0]?.headline);
    expect(email.text).toContain("https://example.com/mission");
    expect(email.html).toContain("Open your briefing");
    expect(sms).toEqual({
      channel: "sms",
      to: "+14155550123",
      body: `Tempo: your 5-minute briefing is ready. ${briefingUrl}`,
      url: briefingUrl,
    });
  });

  it("escapes source-controlled text in the HTML rendering", () => {
    const briefing = fixtureCanonicalBriefing();
    const firstItem = briefing.items[0];
    if (firstItem === undefined) {
      throw new Error("Expected a briefing item.");
    }
    firstItem.headline = "<script>alert('x')</script>";
    const payload = renderCanonicalDelivery({
      briefing,
      channel: "email",
      destination: "reader@example.com",
      briefingUrl: `https://tempo.example/briefings/${briefing.id}`,
    });
    if (payload.channel !== "email") {
      throw new Error("Expected the email rendering.");
    }
    expect(payload.html).not.toContain("<script>");
    expect(payload.html).toContain("&lt;script&gt;");
  });
});
