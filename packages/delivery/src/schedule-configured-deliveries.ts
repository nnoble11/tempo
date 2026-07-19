import { createHash } from "node:crypto";

import {
  SaveDeliveryCommandSchema,
  type CanonicalBriefing,
  type Delivery,
  type DeliveryChannel,
} from "@tempo/contracts";
import type { DeliveryRepository } from "@tempo/database";

import { renderCanonicalDelivery } from "./render-delivery.js";
import { nextAllowedDeliveryTime } from "./delivery-window.js";

export type ConfiguredDeliverySchedulerOptions = {
  repository: DeliveryRepository;
  briefingBaseUrl: string;
};

type Target = {
  channel: DeliveryChannel;
  destination: string;
  endpointId: string | null;
};

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const deduplicateTargets = (targets: readonly Target[]): Target[] => [
  ...new Map(
    targets.map((target) => [
      `${target.channel}:${target.destination}`,
      target,
    ]),
  ).values(),
];

export class ConfiguredDeliveryScheduler {
  readonly #repository: DeliveryRepository;
  readonly #briefingBaseUrl: URL;

  public constructor({
    repository,
    briefingBaseUrl,
  }: ConfiguredDeliverySchedulerOptions) {
    this.#repository = repository;
    this.#briefingBaseUrl = new URL(briefingBaseUrl);
  }

  public async scheduleForBriefing(
    userId: string,
    briefing: CanonicalBriefing,
  ): Promise<Delivery[]> {
    if (briefing.userId !== userId) {
      throw new Error("Cannot schedule another user's briefing.");
    }
    const configuration = await this.#repository.getConfiguration(userId);
    const preferred = new Set(configuration.preferredChannels);
    const targets: Target[] = configuration.endpoints
      .filter(({ channel, enabled }) => enabled && preferred.has(channel))
      .map(({ id, channel, destination }) => ({
        endpointId: id,
        channel,
        destination,
      }));
    const briefingUrl = new URL(
      `/briefings/${briefing.id}`,
      this.#briefingBaseUrl,
    ).toString();
    const scheduledFor = nextAllowedDeliveryTime(
      briefing.scheduledFor,
      configuration.timezone,
      configuration.quietHoursStart,
      configuration.quietHoursEnd,
    );

    return Promise.all(
      deduplicateTargets(targets).map(async (target) => {
        const targetHash = sha256(target.destination);
        const payload = renderCanonicalDelivery({
          briefing,
          channel: target.channel,
          destination: target.destination,
          briefingUrl,
        });
        const commandDraft = {
          briefingId: briefing.id,
          endpointId: target.endpointId,
          channel: target.channel,
          destination: target.destination,
          destinationHash: targetHash,
          payload,
          scheduledFor,
          idempotencyKey: `briefing:${briefing.id}:${target.channel}:${targetHash.slice(0, 32)}`,
        };
        const command = SaveDeliveryCommandSchema.parse({
          ...commandDraft,
          requestHash: sha256(JSON.stringify(commandDraft)),
        });
        return this.#repository.saveDelivery(userId, command);
      }),
    );
  }
}
