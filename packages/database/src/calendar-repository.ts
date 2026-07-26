import {
  CalendarAvailabilitySchema,
  CalendarConnectionSchema,
  ConnectDeviceCalendarSchema,
  SyncCalendarAvailabilitySchema,
  type CalendarAvailability,
  type CalendarBusyWindow,
  type CalendarConnection,
  type ConnectDeviceCalendar,
  type SyncCalendarAvailability,
} from "@tempo/contracts";
import type { Pool, QueryResultRow } from "pg";

import {
  findCalendarSuggestion,
  mergeBusyWindows,
} from "./calendar-availability.js";

export type CalendarRepository = {
  connectDeviceCalendar(
    userId: string,
    input: ConnectDeviceCalendar,
  ): Promise<CalendarConnection>;
  syncAvailability(
    userId: string,
    connectionId: string,
    input: SyncCalendarAvailability,
  ): Promise<CalendarConnection | null>;
  getAvailability(
    userId: string,
    minimumMinutes: number,
    now: string,
  ): Promise<CalendarAvailability>;
  disconnect(userId: string, connectionId: string): Promise<boolean>;
};

type ConnectionRow = QueryResultRow & {
  id: string;
  provider: "device";
  display_name: string;
  scope: "free_busy";
  active: boolean;
  timezone: string | null;
  range_starts_at: Date | string | null;
  range_ends_at: Date | string | null;
  last_synced_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type BusyWindowRow = QueryResultRow & {
  starts_at: Date | string;
  ends_at: Date | string;
};

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toNullableIsoString = (value: Date | string | null): string | null =>
  value === null ? null : toIsoString(value);

const mapConnection = (row: ConnectionRow): CalendarConnection =>
  CalendarConnectionSchema.parse({
    id: row.id,
    provider: row.provider,
    displayName: row.display_name,
    scope: row.scope,
    active: row.active,
    lastSyncedAt: toNullableIsoString(row.last_synced_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  });

export class PostgresCalendarRepository implements CalendarRepository {
  public constructor(private readonly pool: Pool) {}

  public async connectDeviceCalendar(
    userId: string,
    rawInput: ConnectDeviceCalendar,
  ): Promise<CalendarConnection> {
    const input = ConnectDeviceCalendarSchema.parse(rawInput);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<ConnectionRow>(
        `
          INSERT INTO calendar_connections (
            user_id,
            provider,
            display_name,
            scope,
            active
          )
          VALUES ($1, 'device', $2, 'free_busy', TRUE)
          ON CONFLICT (user_id, provider) DO UPDATE
          SET
            display_name = EXCLUDED.display_name,
            active = TRUE,
            updated_at = NOW()
          RETURNING
            id,
            provider,
            display_name,
            scope,
            active,
            timezone,
            range_starts_at,
            range_ends_at,
            last_synced_at,
            created_at,
            updated_at
        `,
        [userId, input.displayName],
      );
      await client.query(
        `
          UPDATE user_preferences
          SET calendar_suggestions_enabled = TRUE, updated_at = NOW()
          WHERE user_id = $1
        `,
        [userId],
      );
      const row = result.rows[0];
      if (row === undefined) {
        throw new Error("Failed to connect the device calendar.");
      }
      await client.query("COMMIT");
      return mapConnection(row);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async syncAvailability(
    userId: string,
    connectionId: string,
    rawInput: SyncCalendarAvailability,
  ): Promise<CalendarConnection | null> {
    const input = SyncCalendarAvailabilitySchema.parse(rawInput);
    const windows = mergeBusyWindows(input.busyWindows);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const connection = await client.query<ConnectionRow>(
        `
          UPDATE calendar_connections
          SET
            timezone = $3,
            range_starts_at = $4,
            range_ends_at = $5,
            last_synced_at = NOW(),
            active = TRUE,
            updated_at = NOW()
          WHERE id = $1 AND user_id = $2 AND provider = 'device'
          RETURNING
            id,
            provider,
            display_name,
            scope,
            active,
            timezone,
            range_starts_at,
            range_ends_at,
            last_synced_at,
            created_at,
            updated_at
        `,
        [
          connectionId,
          userId,
          input.timezone,
          input.rangeStartsAt,
          input.rangeEndsAt,
        ],
      );
      const row = connection.rows[0];
      if (row === undefined) {
        await client.query("COMMIT");
        return null;
      }
      await client.query(
        `
          DELETE FROM calendar_busy_windows
          WHERE connection_id = $1 AND user_id = $2
        `,
        [connectionId, userId],
      );
      for (const window of windows) {
        await client.query(
          `
            INSERT INTO calendar_busy_windows (
              connection_id,
              user_id,
              starts_at,
              ends_at
            )
            VALUES ($1, $2, $3, $4)
          `,
          [connectionId, userId, window.startsAt, window.endsAt],
        );
      }
      await client.query("COMMIT");
      return mapConnection(row);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async getAvailability(
    userId: string,
    minimumMinutes: number,
    now: string,
  ): Promise<CalendarAvailability> {
    const connectionResult = await this.pool.query<
      ConnectionRow & {
        default_briefing_minutes: number;
        suggestions_enabled: boolean;
      }
    >(
      `
        SELECT
          connection.id,
          connection.provider,
          connection.display_name,
          connection.scope,
          connection.active,
          connection.timezone,
          connection.range_starts_at,
          connection.range_ends_at,
          connection.last_synced_at,
          connection.created_at,
          connection.updated_at,
          preference.default_briefing_minutes,
          preference.calendar_suggestions_enabled AS suggestions_enabled
        FROM calendar_connections connection
        INNER JOIN user_preferences preference
          ON preference.user_id = connection.user_id
        WHERE
          connection.user_id = $1
          AND connection.provider = 'device'
          AND connection.active = TRUE
      `,
      [userId],
    );
    const connection = connectionResult.rows[0];
    if (connection === undefined) {
      return CalendarAvailabilitySchema.parse({
        connection: null,
        suggestion: null,
        rangeStartsAt: null,
        rangeEndsAt: null,
      });
    }
    const rangeStartsAt = toNullableIsoString(connection.range_starts_at);
    const rangeEndsAt = toNullableIsoString(connection.range_ends_at);
    if (
      !connection.suggestions_enabled ||
      rangeStartsAt === null ||
      rangeEndsAt === null
    ) {
      return CalendarAvailabilitySchema.parse({
        connection: mapConnection(connection),
        suggestion: null,
        rangeStartsAt,
        rangeEndsAt,
      });
    }

    const busyResult = await this.pool.query<BusyWindowRow>(
      `
        SELECT starts_at, ends_at
        FROM calendar_busy_windows
        WHERE connection_id = $1 AND user_id = $2
        ORDER BY starts_at, ends_at
      `,
      [connection.id, userId],
    );
    const busyWindows: CalendarBusyWindow[] = busyResult.rows.map((window) => ({
      startsAt: toIsoString(window.starts_at),
      endsAt: toIsoString(window.ends_at),
    }));
    const suggestion = findCalendarSuggestion({
      now,
      rangeStartsAt,
      rangeEndsAt,
      busyWindows,
      minimumMinutes,
      defaultBriefingMinutes: connection.default_briefing_minutes,
    });

    return CalendarAvailabilitySchema.parse({
      connection: mapConnection(connection),
      suggestion,
      rangeStartsAt,
      rangeEndsAt,
    });
  }

  public async disconnect(
    userId: string,
    connectionId: string,
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `
          UPDATE calendar_connections
          SET
            active = FALSE,
            timezone = NULL,
            range_starts_at = NULL,
            range_ends_at = NULL,
            last_synced_at = NULL,
            updated_at = NOW()
          WHERE id = $1 AND user_id = $2 AND active = TRUE
        `,
        [connectionId, userId],
      );
      if (result.rowCount === 1) {
        await client.query(
          `
            DELETE FROM calendar_busy_windows
            WHERE connection_id = $1 AND user_id = $2
          `,
          [connectionId, userId],
        );
        await client.query(
          `
            UPDATE user_preferences
            SET calendar_suggestions_enabled = FALSE, updated_at = NOW()
            WHERE user_id = $1
          `,
          [userId],
        );
      }
      await client.query("COMMIT");
      return result.rowCount === 1;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
