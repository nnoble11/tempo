import {
  DeliveryPayloadSchema,
  type CanonicalBriefing,
  type DeliveryChannel,
  type DeliveryPayload,
} from "@tempo/contracts";

export type RenderCanonicalDeliveryInput = {
  briefing: CanonicalBriefing;
  channel: DeliveryChannel;
  destination: string;
  briefingUrl: string;
};

const truncate = (value: string, maximumLength: number): string => {
  if (value.length <= maximumLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maximumLength - 1)).trimEnd()}…`;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const uniqueCitations = (briefing: CanonicalBriefing) => [
  ...new Map(
    briefing.items
      .flatMap(({ claims }) => claims)
      .flatMap(({ citations }) => citations)
      .map((citation) => [citation.citationId, citation]),
  ).values(),
];

const emailText = (
  briefing: CanonicalBriefing,
  briefingUrl: string,
): string => {
  const items = briefing.items
    .map(
      (item) =>
        `${item.position}. ${item.headline}\n${item.takeaway}\nWhy it matters: ${item.whyItMatters}\nWhat changed: ${item.whatChanged}`,
    )
    .join("\n\n");
  const citations = uniqueCitations(briefing)
    .map(
      (citation, index) =>
        `[${index + 1}] ${citation.publisher}: ${citation.sourceTitle}\n${citation.canonicalUrl}`,
    )
    .join("\n\n");
  return `${briefing.overview}\n\n${items}\n\nSources\n${citations}\n\nOpen the canonical briefing: ${briefingUrl}`;
};

const emailHtml = (
  briefing: CanonicalBriefing,
  briefingUrl: string,
): string => {
  const items = briefing.items
    .map(
      (item) => `
        <section style="margin:0 0 28px">
          <p style="color:#176B5B;font-size:12px;font-weight:700;margin:0 0 8px">UPDATE ${item.position}</p>
          <h2 style="color:#17211E;font-size:22px;margin:0 0 10px">${escapeHtml(item.headline)}</h2>
          <p style="color:#3F4B46;line-height:1.55">${escapeHtml(item.takeaway)}</p>
          <p style="color:#64706A;line-height:1.55"><strong>Why it matters:</strong> ${escapeHtml(item.whyItMatters)}</p>
          <p style="color:#64706A;line-height:1.55"><strong>What changed:</strong> ${escapeHtml(item.whatChanged)}</p>
        </section>
      `,
    )
    .join("");
  const citations = uniqueCitations(briefing)
    .map(
      (citation) =>
        `<li style="margin:0 0 8px"><a href="${escapeHtml(citation.canonicalUrl)}">${escapeHtml(citation.publisher)} — ${escapeHtml(citation.sourceTitle)}</a></li>`,
    )
    .join("");
  return `
    <!doctype html>
    <html>
      <body style="background:#F3F0E8;font-family:Arial,sans-serif;margin:0;padding:24px">
        <main style="background:#FFFDF8;border-radius:20px;margin:0 auto;max-width:640px;padding:32px">
          <p style="color:#176B5B;font-size:13px;font-weight:700;letter-spacing:1px">TEMPO · ${briefing.estimatedSeconds < 60 ? "<1" : Math.ceil(briefing.estimatedSeconds / 60)} MIN</p>
          <h1 style="color:#17211E;font-size:30px;line-height:1.2">${escapeHtml(briefing.overview)}</h1>
          ${items}
          <h2 style="color:#17211E;font-size:18px">Sources</h2>
          <ol>${citations}</ol>
          <p style="margin-top:28px"><a href="${escapeHtml(briefingUrl)}" style="background:#176B5B;border-radius:12px;color:#fff;display:inline-block;font-weight:700;padding:13px 18px;text-decoration:none">Open your briefing</a></p>
          <p style="color:#64706A;font-size:12px;margin-top:28px">This email is a rendering of your canonical Tempo briefing.</p>
        </main>
      </body>
    </html>
  `.trim();
};

export const renderCanonicalDelivery = ({
  briefing,
  channel,
  destination,
  briefingUrl,
}: RenderCanonicalDeliveryInput): DeliveryPayload => {
  let payload: DeliveryPayload;
  switch (channel) {
    case "push":
      payload = {
        channel,
        to: destination,
        title: `Your ${briefing.targetMinutes}-minute Tempo briefing`,
        body: truncate(briefing.overview, 200),
        url: briefingUrl,
        data: {
          briefingId: briefing.id,
          url: briefingUrl,
        },
      };
      break;
    case "email":
      payload = {
        channel,
        to: destination,
        subject: `Your ${briefing.targetMinutes}-minute Tempo briefing`,
        text: emailText(briefing, briefingUrl),
        html: emailHtml(briefing, briefingUrl),
      };
      break;
    case "sms": {
      const body = `Tempo: your ${briefing.targetMinutes}-minute briefing is ready. ${briefingUrl}`;
      if (body.length > 320) {
        throw new Error("The briefing URL is too long for an SMS delivery.");
      }
      payload = {
        channel,
        to: destination,
        body,
        url: briefingUrl,
      };
      break;
    }
  }
  return DeliveryPayloadSchema.parse(payload);
};
