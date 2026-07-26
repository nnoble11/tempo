import { createHash } from "node:crypto";

import type {
  CompleteOnboardingInput,
  CompleteOnboardingResult,
  CreateInterest,
  InterestPage,
  ListInterestsQuery,
  UpdateUserInterest,
  User,
  UserInterest,
  UserPreferences,
  UserPreferencesInput,
  UserProfile,
} from "@tempo/contracts";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import { IdempotencyConflictError } from "./briefing-repository.js";

export type ExternalUserIdentity = {
  id: string;
  email: string | null;
};

export type AccountRepository = {
  ensureUser(identity: ExternalUserIdentity): Promise<UserProfile>;
  getPreferences(userId: string): Promise<UserPreferences | null>;
  updatePreferences(
    userId: string,
    preferences: UserPreferencesInput,
  ): Promise<UserPreferences>;
  createInterest(
    userId: string,
    interest: CreateInterest,
  ): Promise<UserInterest>;
  listInterests(
    userId: string,
    query: ListInterestsQuery,
  ): Promise<InterestPage>;
  updateInterest(
    userId: string,
    userInterestId: string,
    update: UpdateUserInterest,
  ): Promise<UserInterest | null>;
  deleteInterest(userId: string, userInterestId: string): Promise<boolean>;
  completeOnboarding(
    userId: string,
    input: CompleteOnboardingInput,
  ): Promise<CompleteOnboardingResult>;
};

type UserRow = QueryResultRow & {
  id: string;
  email: string | null;
  onboarding_completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type PreferenceRow = QueryResultRow & {
  user_id: string;
  timezone: string;
  locale: string;
  default_briefing_minutes: number;
  daily_briefing_time: string;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  delivery_channels: ("in_app" | "push" | "email" | "sms")[];
  calendar_suggestions_enabled: boolean;
  recommendations_enabled: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

type UserInterestRow = QueryResultRow & {
  id: string;
  interest_id: string;
  type: "topic" | "entity" | "instruction";
  name: string;
  description: string | null;
  importance: number;
  expertise_level: "beginner" | "intermediate" | "advanced" | "expert";
  desired_depth: "brief" | "standard" | "deep";
  alert_sensitivity: number;
  preferred_sources: string[];
  blocked_sources: string[];
  keywords: string[];
  excluded_keywords: string[];
  active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  last_interacted_at: Date | string | null;
};

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const mapUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  onboardingCompletedAt:
    row.onboarding_completed_at === null
      ? null
      : toIsoString(row.onboarding_completed_at),
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

const mapPreferences = (row: PreferenceRow): UserPreferences => ({
  userId: row.user_id,
  timezone: row.timezone,
  locale: row.locale,
  defaultBriefingMinutes: row.default_briefing_minutes,
  dailyBriefingTime: row.daily_briefing_time.slice(0, 5),
  quietHoursStart: row.quiet_hours_start?.slice(0, 5) ?? null,
  quietHoursEnd: row.quiet_hours_end?.slice(0, 5) ?? null,
  deliveryChannels: row.delivery_channels,
  calendarSuggestionsEnabled: row.calendar_suggestions_enabled,
  recommendationsEnabled: row.recommendations_enabled,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

const mapUserInterest = (row: UserInterestRow): UserInterest => ({
  id: row.id,
  interestId: row.interest_id,
  type: row.type,
  name: row.name,
  description: row.description,
  importance: row.importance,
  expertiseLevel: row.expertise_level,
  desiredDepth: row.desired_depth,
  alertSensitivity: row.alert_sensitivity,
  preferredSources: row.preferred_sources,
  blockedSources: row.blocked_sources,
  keywords: row.keywords,
  excludedKeywords: row.excluded_keywords,
  active: row.active,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
  lastInteractedAt:
    row.last_interacted_at === null
      ? null
      : toIsoString(row.last_interacted_at),
});

const selectPreferences = async (
  client: Pool | PoolClient,
  userId: string,
): Promise<UserPreferences | null> => {
  const result = await client.query<PreferenceRow>(
    `
      SELECT
        user_id,
        timezone,
        locale,
        default_briefing_minutes,
        daily_briefing_time::TEXT,
        quiet_hours_start::TEXT,
        quiet_hours_end::TEXT,
        delivery_channels,
        calendar_suggestions_enabled,
        recommendations_enabled,
        created_at,
        updated_at
      FROM user_preferences
      WHERE user_id = $1
    `,
    [userId],
  );
  const row = result.rows[0];
  return row === undefined ? null : mapPreferences(row);
};

const selectUser = async (
  client: Pool | PoolClient,
  userId: string,
): Promise<User | null> => {
  const result = await client.query<UserRow>(
    `
      SELECT
        id,
        email,
        onboarding_completed_at,
        created_at,
        updated_at
      FROM users
      WHERE id = $1
    `,
    [userId],
  );
  const row = result.rows[0];
  return row === undefined ? null : mapUser(row);
};

const updatePreferencesRecord = async (
  client: Pool | PoolClient,
  userId: string,
  preferences: UserPreferencesInput,
): Promise<UserPreferences> => {
  const result = await client.query<PreferenceRow>(
    `
      UPDATE user_preferences
      SET
        timezone = $2,
        locale = $3,
        default_briefing_minutes = $4,
        daily_briefing_time = $5,
        quiet_hours_start = $6,
        quiet_hours_end = $7,
        delivery_channels = $8,
        calendar_suggestions_enabled = $9,
        recommendations_enabled = $10,
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING
        user_id,
        timezone,
        locale,
        default_briefing_minutes,
        daily_briefing_time::TEXT,
        quiet_hours_start::TEXT,
        quiet_hours_end::TEXT,
        delivery_channels,
        calendar_suggestions_enabled,
        recommendations_enabled,
        created_at,
        updated_at
    `,
    [
      userId,
      preferences.timezone,
      preferences.locale,
      preferences.defaultBriefingMinutes,
      preferences.dailyBriefingTime,
      preferences.quietHoursStart,
      preferences.quietHoursEnd,
      preferences.deliveryChannels,
      preferences.calendarSuggestionsEnabled,
      preferences.recommendationsEnabled,
    ],
  );
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error("Cannot update preferences for an unknown user.");
  }
  return mapPreferences(row);
};

const createUserInterest = async (
  client: Pool | PoolClient,
  userId: string,
  interest: CreateInterest,
): Promise<UserInterest> => {
  const interestResult = await client.query<{ id: string }>(
    `
      INSERT INTO interests (type, name, description)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [interest.type, interest.name, interest.description ?? null],
  );
  const interestId = interestResult.rows[0]?.id;
  if (interestId === undefined) {
    throw new Error("Failed to create the interest.");
  }

  const userInterestResult = await client.query<{ id: string }>(
    `
      INSERT INTO user_interests (
        user_id,
        interest_id,
        importance,
        expertise_level,
        desired_depth,
        alert_sensitivity,
        preferred_sources,
        blocked_sources,
        keywords,
        excluded_keywords
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `,
    [
      userId,
      interestId,
      interest.importance,
      interest.expertiseLevel,
      interest.desiredDepth,
      interest.alertSensitivity,
      interest.preferredSources,
      interest.blockedSources,
      interest.keywords,
      interest.excludedKeywords,
    ],
  );
  const userInterestId = userInterestResult.rows[0]?.id;
  if (userInterestId === undefined) {
    throw new Error("Failed to create the user interest.");
  }

  const created = await selectUserInterest(client, userId, userInterestId);
  if (created === null) {
    throw new Error("Failed to load the created user interest.");
  }
  return created;
};

const listAllUserInterests = async (
  client: Pool | PoolClient,
  userId: string,
): Promise<UserInterest[]> => {
  const result = await client.query<UserInterestRow>(
    `
      SELECT
        ui.id,
        ui.interest_id,
        i.type,
        i.name,
        i.description,
        ui.importance,
        ui.expertise_level,
        ui.desired_depth,
        ui.alert_sensitivity,
        ui.preferred_sources,
        ui.blocked_sources,
        ui.keywords,
        ui.excluded_keywords,
        ui.active,
        ui.created_at,
        ui.updated_at,
        ui.last_interacted_at
      FROM user_interests ui
      INNER JOIN interests i ON i.id = ui.interest_id
      WHERE ui.user_id = $1
        AND ui.deleted_at IS NULL
      ORDER BY ui.created_at, ui.id
    `,
    [userId],
  );
  return result.rows.map(mapUserInterest);
};

const selectUserInterest = async (
  client: Pool | PoolClient,
  userId: string,
  userInterestId: string,
): Promise<UserInterest | null> => {
  const result = await client.query<UserInterestRow>(
    `
      SELECT
        ui.id,
        ui.interest_id,
        i.type,
        i.name,
        i.description,
        ui.importance,
        ui.expertise_level,
        ui.desired_depth,
        ui.alert_sensitivity,
        ui.preferred_sources,
        ui.blocked_sources,
        ui.keywords,
        ui.excluded_keywords,
        ui.active,
        ui.created_at,
        ui.updated_at,
        ui.last_interacted_at
      FROM user_interests ui
      INNER JOIN interests i ON i.id = ui.interest_id
      WHERE ui.id = $1 AND ui.user_id = $2 AND ui.deleted_at IS NULL
    `,
    [userInterestId, userId],
  );
  const row = result.rows[0];
  return row === undefined ? null : mapUserInterest(row);
};

export class PostgresAccountRepository implements AccountRepository {
  public constructor(private readonly pool: Pool) {}

  public async ensureUser(
    identity: ExternalUserIdentity,
  ): Promise<UserProfile> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const userResult = await client.query<UserRow>(
        `
          INSERT INTO users (id, email)
          VALUES ($1, $2)
          ON CONFLICT (id) DO UPDATE
          SET
            email = COALESCE(EXCLUDED.email, users.email),
            updated_at = CASE
              WHEN users.email IS DISTINCT FROM COALESCE(
                EXCLUDED.email,
                users.email
              )
              THEN NOW()
              ELSE users.updated_at
            END
          RETURNING
            id,
            email,
            onboarding_completed_at,
            created_at,
            updated_at
        `,
        [identity.id, identity.email],
      );
      await client.query(
        `
          INSERT INTO user_preferences (user_id)
          VALUES ($1)
          ON CONFLICT (user_id) DO NOTHING
        `,
        [identity.id],
      );
      const preferences = await selectPreferences(client, identity.id);
      const userRow = userResult.rows[0];
      if (userRow === undefined || preferences === null) {
        throw new Error("Failed to create the application user profile.");
      }

      await client.query("COMMIT");
      return { user: mapUser(userRow), preferences };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async getPreferences(userId: string): Promise<UserPreferences | null> {
    return selectPreferences(this.pool, userId);
  }

  public async updatePreferences(
    userId: string,
    preferences: UserPreferencesInput,
  ): Promise<UserPreferences> {
    return updatePreferencesRecord(this.pool, userId, preferences);
  }

  public async createInterest(
    userId: string,
    interest: CreateInterest,
  ): Promise<UserInterest> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const created = await createUserInterest(client, userId, interest);
      await client.query("COMMIT");
      return created;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async listInterests(
    userId: string,
    query: ListInterestsQuery,
  ): Promise<InterestPage> {
    const result = await this.pool.query<UserInterestRow>(
      `
        SELECT
          ui.id,
          ui.interest_id,
          i.type,
          i.name,
          i.description,
          ui.importance,
          ui.expertise_level,
          ui.desired_depth,
          ui.alert_sensitivity,
          ui.preferred_sources,
          ui.blocked_sources,
          ui.keywords,
          ui.excluded_keywords,
          ui.active,
          ui.created_at,
          ui.updated_at,
          ui.last_interacted_at
        FROM user_interests ui
        INNER JOIN interests i ON i.id = ui.interest_id
        WHERE
          ui.user_id = $1
          AND ui.deleted_at IS NULL
          AND ($4::BOOLEAN IS NULL OR ui.active = $4)
          AND (
            $2::UUID IS NULL
            OR (ui.created_at, ui.id) < (
              SELECT cursor_ui.created_at, cursor_ui.id
              FROM user_interests cursor_ui
              WHERE cursor_ui.id = $2 AND cursor_ui.user_id = $1
            )
          )
        ORDER BY ui.created_at DESC, ui.id DESC
        LIMIT $3
      `,
      [userId, query.cursor ?? null, query.limit + 1, query.active ?? null],
    );

    const hasNextPage = result.rows.length > query.limit;
    const pageRows = result.rows.slice(0, query.limit);
    const lastRow = pageRows.at(-1);
    return {
      items: pageRows.map(mapUserInterest),
      nextCursor: hasNextPage && lastRow !== undefined ? lastRow.id : null,
    };
  }

  public async updateInterest(
    userId: string,
    userInterestId: string,
    update: UpdateUserInterest,
  ): Promise<UserInterest | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ interest_id: string }>(
        `
          UPDATE user_interests
          SET
            importance = COALESCE($3, importance),
            expertise_level = COALESCE($4, expertise_level),
            desired_depth = COALESCE($5, desired_depth),
            alert_sensitivity = COALESCE($6, alert_sensitivity),
            preferred_sources = COALESCE($7, preferred_sources),
            blocked_sources = COALESCE($8, blocked_sources),
            keywords = COALESCE($9, keywords),
            excluded_keywords = COALESCE($10, excluded_keywords),
            active = COALESCE($11, active),
            updated_at = NOW()
          WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
          RETURNING interest_id
        `,
        [
          userInterestId,
          userId,
          update.importance ?? null,
          update.expertiseLevel ?? null,
          update.desiredDepth ?? null,
          update.alertSensitivity ?? null,
          update.preferredSources ?? null,
          update.blockedSources ?? null,
          update.keywords ?? null,
          update.excludedKeywords ?? null,
          update.active ?? null,
        ],
      );
      const interestId = result.rows[0]?.interest_id;
      if (interestId === undefined) {
        await client.query("COMMIT");
        return null;
      }
      await client.query(
        `
          UPDATE interests
          SET
            name = CASE WHEN $2 THEN $3 ELSE name END,
            description = CASE WHEN $4 THEN $5 ELSE description END
          WHERE id = $1
        `,
        [
          interestId,
          update.name !== undefined,
          update.name ?? null,
          "description" in update,
          update.description ?? null,
        ],
      );
      const updated = await selectUserInterest(client, userId, userInterestId);
      await client.query("COMMIT");
      return updated;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async deleteInterest(
    userId: string,
    userInterestId: string,
  ): Promise<boolean> {
    const result = await this.pool.query(
      `
        UPDATE user_interests
        SET active = FALSE, deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
      `,
      [userInterestId, userId],
    );
    return result.rowCount === 1;
  }

  public async completeOnboarding(
    userId: string,
    input: CompleteOnboardingInput,
  ): Promise<CompleteOnboardingResult> {
    const requestHash = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const stateResult = await client.query<{
        onboarding_completed_at: Date | string | null;
        onboarding_request_hash: string | null;
      }>(
        `
          SELECT onboarding_completed_at, onboarding_request_hash
          FROM users
          WHERE id = $1
          FOR UPDATE
        `,
        [userId],
      );
      const state = stateResult.rows[0];
      if (state === undefined) {
        throw new Error("Cannot onboard an unknown user.");
      }

      if (state.onboarding_completed_at !== null) {
        if (state.onboarding_request_hash !== requestHash) {
          throw new IdempotencyConflictError(
            "Onboarding was already completed with different input.",
          );
        }
        const user = await selectUser(client, userId);
        const preferences = await selectPreferences(client, userId);
        const interests = await listAllUserInterests(client, userId);
        if (user === null || preferences === null || interests.length === 0) {
          throw new Error("The completed onboarding state is incomplete.");
        }
        await client.query("COMMIT");
        return {
          profile: { user, preferences },
          interests,
        };
      }

      const preferences = await updatePreferencesRecord(
        client,
        userId,
        input.preferences,
      );
      for (const interest of input.interests) {
        await createUserInterest(client, userId, interest);
      }
      const userResult = await client.query<UserRow>(
        `
          UPDATE users
          SET
            onboarding_completed_at = NOW(),
            onboarding_request_hash = $2,
            updated_at = NOW()
          WHERE id = $1
          RETURNING
            id,
            email,
            onboarding_completed_at,
            created_at,
            updated_at
        `,
        [userId, requestHash],
      );
      const userRow = userResult.rows[0];
      if (userRow === undefined) {
        throw new Error("Failed to complete onboarding.");
      }
      const interests = await listAllUserInterests(client, userId);

      await client.query("COMMIT");
      return {
        profile: {
          user: mapUser(userRow),
          preferences,
        },
        interests,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
