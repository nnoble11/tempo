import type { DeliveryEndpoint } from "@tempo/contracts";

import { DeliveryProviderError } from "./providers.js";

type Fetcher = typeof fetch;

export type DestinationVerificationSender = {
  sendCode(endpoint: DeliveryEndpoint, code: string): Promise<void>;
};

export type ProviderVerificationSenderOptions = {
  resend?: { apiKey: string; from: string };
  twilio?: { accountSid: string; authToken: string; fromNumber: string };
  fetcher?: Fetcher;
};

export class ProviderVerificationSender implements DestinationVerificationSender {
  readonly #options: ProviderVerificationSenderOptions;
  readonly #fetcher: Fetcher;

  public constructor(options: ProviderVerificationSenderOptions) {
    this.#options = options;
    this.#fetcher = options.fetcher ?? fetch;
  }

  public async sendCode(
    endpoint: DeliveryEndpoint,
    code: string,
  ): Promise<void> {
    if (endpoint.channel === "push") {
      throw new DeliveryProviderError(
        "Push endpoints prove possession during registration.",
        false,
      );
    }
    if (endpoint.channel === "email") {
      const resend = this.#options.resend;
      if (resend === undefined) {
        throw new DeliveryProviderError(
          "Email verification is not configured.",
          false,
        );
      }
      const response = await this.#fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${resend.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: resend.from,
          to: [endpoint.destination],
          subject: "Verify your Tempo email",
          text: `Your Tempo verification code is ${code}. It expires in 10 minutes.`,
        }),
      });
      if (!response.ok) {
        throw new DeliveryProviderError(
          `Email verification failed with status ${response.status}.`,
          response.status === 429 || response.status >= 500,
        );
      }
      return;
    }

    const twilio = this.#options.twilio;
    if (twilio === undefined) {
      throw new DeliveryProviderError(
        "SMS verification is not configured.",
        false,
      );
    }
    const authorization = Buffer.from(
      `${twilio.accountSid}:${twilio.authToken}`,
    ).toString("base64");
    const response = await this.#fetcher(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilio.accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          authorization: `Basic ${authorization}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: twilio.fromNumber,
          To: endpoint.destination,
          Body: `Your Tempo verification code is ${code}. It expires in 10 minutes.`,
        }).toString(),
      },
    );
    if (!response.ok) {
      throw new DeliveryProviderError(
        `SMS verification failed with status ${response.status}.`,
        response.status === 429 || response.status >= 500,
      );
    }
  }
}
