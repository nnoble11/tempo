import type { ClaimedPushReceipt, DeliveryRepository } from "@tempo/database";

import { DeliveryProviderError } from "./providers.js";

type Fetcher = typeof fetch;

export type PushReceiptResult =
  | { status: "accepted" }
  | { status: "failed"; error: string; deviceNotRegistered: boolean };

export class ExpoPushReceiptClient {
  readonly #accessToken: string | undefined;
  readonly #fetcher: Fetcher;

  public constructor(
    options: { accessToken?: string; fetcher?: Fetcher } = {},
  ) {
    this.#accessToken = options.accessToken;
    this.#fetcher = options.fetcher ?? fetch;
  }

  public async getReceipts(
    ids: readonly string[],
  ): Promise<Map<string, PushReceiptResult>> {
    if (ids.length === 0) {
      return new Map();
    }
    const headers = new Headers({
      accept: "application/json",
      "content-type": "application/json",
    });
    if (this.#accessToken !== undefined) {
      headers.set("authorization", `Bearer ${this.#accessToken}`);
    }
    let response: Response;
    try {
      response = await this.#fetcher(
        "https://exp.host/--/api/v2/push/getReceipts",
        {
          method: "POST",
          headers,
          body: JSON.stringify({ ids }),
        },
      );
    } catch {
      throw new DeliveryProviderError(
        "The Expo receipt service could not be reached.",
        true,
      );
    }
    if (!response.ok) {
      throw new DeliveryProviderError(
        `Expo receipt lookup failed with status ${response.status}.`,
        response.status === 429 || response.status >= 500,
      );
    }
    const body = (await response.json()) as { data?: unknown };
    if (
      typeof body.data !== "object" ||
      body.data === null ||
      Array.isArray(body.data)
    ) {
      throw new DeliveryProviderError(
        "Expo receipt lookup returned an invalid payload.",
        true,
      );
    }
    const results = new Map<string, PushReceiptResult>();
    for (const id of ids) {
      const receipt = (body.data as Record<string, unknown>)[id];
      if (typeof receipt !== "object" || receipt === null) {
        continue;
      }
      const record = receipt as Record<string, unknown>;
      if (record.status === "ok") {
        results.set(id, { status: "accepted" });
        continue;
      }
      const details =
        typeof record.details === "object" && record.details !== null
          ? (record.details as Record<string, unknown>)
          : {};
      results.set(id, {
        status: "failed",
        error:
          typeof record.message === "string"
            ? record.message
            : "Expo reported an unsuccessful push receipt.",
        deviceNotRegistered: details.error === "DeviceNotRegistered",
      });
    }
    return results;
  }
}

export type PushReceiptCycleSummary = {
  claimed: number;
  accepted: number;
  failed: number;
};

const retryAt = (receipt: ClaimedPushReceipt, now: Date): string | null =>
  receipt.attemptCount >= 5
    ? null
    : new Date(
        now.valueOf() +
          Math.min(6 * 60 * 60_000, 60_000 * 2 ** receipt.attemptCount),
      ).toISOString();

export const runPushReceiptCycle = async (options: {
  repository: DeliveryRepository;
  client: ExpoPushReceiptClient;
  workerId: string;
  now?: Date;
  limit?: number;
}): Promise<PushReceiptCycleSummary> => {
  const now = options.now ?? new Date();
  const receipts = await options.repository.claimPushReceipts({
    workerId: options.workerId,
    now: now.toISOString(),
    leaseUntil: new Date(now.valueOf() + 5 * 60_000).toISOString(),
    limit: options.limit ?? 100,
  });
  if (receipts.length === 0) {
    return { claimed: 0, accepted: 0, failed: 0 };
  }
  let results: Map<string, PushReceiptResult>;
  try {
    results = await options.client.getReceipts(
      receipts.map(({ providerMessageId }) => providerMessageId),
    );
  } catch (error) {
    const description =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : "Unknown receipt error";
    await Promise.all(
      receipts.map((receipt) =>
        options.repository.markPushReceiptFailed(
          receipt.deliveryId,
          options.workerId,
          description,
          now.toISOString(),
          retryAt(receipt, now),
          false,
        ),
      ),
    );
    return { claimed: receipts.length, accepted: 0, failed: receipts.length };
  }

  let accepted = 0;
  let failed = 0;
  await Promise.all(
    receipts.map(async (receipt) => {
      const result = results.get(receipt.providerMessageId);
      if (result?.status === "accepted") {
        accepted += 1;
        await options.repository.markPushReceiptAccepted(
          receipt.deliveryId,
          options.workerId,
          now.toISOString(),
        );
        return;
      }
      failed += 1;
      await options.repository.markPushReceiptFailed(
        receipt.deliveryId,
        options.workerId,
        result?.error ?? "Expo has not returned this receipt yet.",
        now.toISOString(),
        result?.deviceNotRegistered ? null : retryAt(receipt, now),
        result?.deviceNotRegistered ?? false,
      );
    }),
  );
  return { claimed: receipts.length, accepted, failed };
};
