import {
  EmailDeliveryPayloadSchema,
  PushDeliveryPayloadSchema,
  SmsDeliveryPayloadSchema,
  type Delivery,
  type DeliveryChannel,
} from "@tempo/contracts";

export class DeliveryProviderError extends Error {
  public constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "DeliveryProviderError";
  }
}

/**
 * Structural guard for DeliveryProviderError that stays correct even when a
 * bundler or test runner loads more than one copy of this module, where
 * instanceof would fail across copies.
 */
export const isDeliveryProviderError = (
  error: unknown,
): error is DeliveryProviderError =>
  error instanceof DeliveryProviderError ||
  (error instanceof Error &&
    error.name === "DeliveryProviderError" &&
    typeof (error as { retryable?: unknown }).retryable === "boolean");

export type DeliveryProviderResult = {
  providerMessageId: string;
};

export type DeliveryProvider = {
  readonly channel: DeliveryChannel;
  send(delivery: Delivery): Promise<DeliveryProviderResult>;
};

type Fetcher = typeof fetch;

const isRetryableStatus = (status: number): boolean =>
  status === 408 ||
  status === 409 ||
  status === 425 ||
  status === 429 ||
  status >= 500;

const responseJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const recordValue = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;

export type ExpoPushProviderOptions = {
  accessToken?: string;
  fetcher?: Fetcher;
};

export class ExpoPushProvider implements DeliveryProvider {
  public readonly channel = "push" as const;
  readonly #accessToken: string | undefined;
  readonly #fetcher: Fetcher;

  public constructor({
    accessToken,
    fetcher = fetch,
  }: ExpoPushProviderOptions = {}) {
    this.#accessToken = accessToken;
    this.#fetcher = fetcher;
  }

  public async send(delivery: Delivery): Promise<DeliveryProviderResult> {
    const payload = PushDeliveryPayloadSchema.parse(delivery.payload);
    let response: Response;
    try {
      const headers = new Headers({
        accept: "application/json",
        "content-type": "application/json",
      });
      if (this.#accessToken !== undefined) {
        headers.set("authorization", `Bearer ${this.#accessToken}`);
      }
      response = await this.#fetcher("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers,
        body: JSON.stringify({
          to: payload.to,
          title: payload.title,
          body: payload.body,
          data: payload.data,
          sound: "default",
          channelId: "daily-briefing",
        }),
      });
    } catch {
      throw new DeliveryProviderError(
        "The Expo Push service could not be reached.",
        true,
      );
    }
    if (!response.ok) {
      throw new DeliveryProviderError(
        `Expo Push rejected the request with status ${response.status}.`,
        isRetryableStatus(response.status),
      );
    }

    const body = await responseJson(response);
    const responseData = recordValue(body, "data");
    const ticket: unknown = Array.isArray(responseData)
      ? (responseData as unknown[])[0]
      : responseData;
    if (recordValue(ticket, "status") !== "ok") {
      const details = recordValue(ticket, "details");
      const deviceNotRegistered =
        recordValue(details, "error") === "DeviceNotRegistered";
      throw new DeliveryProviderError(
        deviceNotRegistered
          ? "The Expo push endpoint is no longer registered."
          : "Expo Push returned an unsuccessful ticket.",
        !deviceNotRegistered,
      );
    }
    const id = recordValue(ticket, "id");
    if (typeof id !== "string" || id.length === 0) {
      throw new DeliveryProviderError(
        "Expo Push returned no receipt identifier.",
        true,
      );
    }
    return { providerMessageId: id };
  }
}

export type ResendEmailProviderOptions = {
  apiKey: string;
  from: string;
  fetcher?: Fetcher;
};

export class ResendEmailProvider implements DeliveryProvider {
  public readonly channel = "email" as const;
  readonly #apiKey: string;
  readonly #from: string;
  readonly #fetcher: Fetcher;

  public constructor({
    apiKey,
    from,
    fetcher = fetch,
  }: ResendEmailProviderOptions) {
    this.#apiKey = apiKey;
    this.#from = from;
    this.#fetcher = fetcher;
  }

  public async send(delivery: Delivery): Promise<DeliveryProviderResult> {
    const payload = EmailDeliveryPayloadSchema.parse(delivery.payload);
    let response: Response;
    try {
      response = await this.#fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${this.#apiKey}`,
          "content-type": "application/json",
          "idempotency-key": delivery.idempotencyKey,
        },
        body: JSON.stringify({
          from: this.#from,
          to: [payload.to],
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        }),
      });
    } catch {
      throw new DeliveryProviderError(
        "The email provider could not be reached.",
        true,
      );
    }
    if (!response.ok) {
      throw new DeliveryProviderError(
        `The email provider rejected the request with status ${response.status}.`,
        isRetryableStatus(response.status),
      );
    }
    const id = recordValue(await responseJson(response), "id");
    if (typeof id !== "string" || id.length === 0) {
      throw new DeliveryProviderError(
        "The email provider returned no message identifier.",
        true,
      );
    }
    return { providerMessageId: id };
  }
}

export type TwilioSmsProviderOptions = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  fetcher?: Fetcher;
};

export class TwilioSmsProvider implements DeliveryProvider {
  public readonly channel = "sms" as const;
  readonly #accountSid: string;
  readonly #authorization: string;
  readonly #fromNumber: string;
  readonly #fetcher: Fetcher;

  public constructor({
    accountSid,
    authToken,
    fromNumber,
    fetcher = fetch,
  }: TwilioSmsProviderOptions) {
    this.#accountSid = accountSid;
    this.#authorization = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
    this.#fromNumber = fromNumber;
    this.#fetcher = fetcher;
  }

  public async send(delivery: Delivery): Promise<DeliveryProviderResult> {
    const payload = SmsDeliveryPayloadSchema.parse(delivery.payload);
    let response: Response;
    try {
      response = await this.#fetcher(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.#accountSid)}/Messages.json`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            authorization: this.#authorization,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            From: this.#fromNumber,
            To: payload.to,
            Body: payload.body,
          }).toString(),
        },
      );
    } catch {
      throw new DeliveryProviderError(
        "The SMS provider could not be reached.",
        true,
      );
    }
    if (!response.ok) {
      throw new DeliveryProviderError(
        `The SMS provider rejected the request with status ${response.status}.`,
        isRetryableStatus(response.status),
      );
    }
    const sid = recordValue(await responseJson(response), "sid");
    if (typeof sid !== "string" || sid.length === 0) {
      throw new DeliveryProviderError(
        "The SMS provider returned no message identifier.",
        true,
      );
    }
    return { providerMessageId: sid };
  }
}

export class DeliveryProviderRegistry {
  readonly #providers: Map<DeliveryChannel, DeliveryProvider>;

  public constructor(providers: readonly DeliveryProvider[]) {
    this.#providers = new Map();
    for (const provider of providers) {
      if (this.#providers.has(provider.channel)) {
        throw new Error(`Duplicate delivery provider: ${provider.channel}`);
      }
      this.#providers.set(provider.channel, provider);
    }
  }

  public providerFor(channel: DeliveryChannel): DeliveryProvider {
    const provider = this.#providers.get(channel);
    if (provider === undefined) {
      throw new DeliveryProviderError(
        `No ${channel} delivery provider is configured.`,
        false,
      );
    }
    return provider;
  }
}
