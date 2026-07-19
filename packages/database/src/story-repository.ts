import {
  StoryIntelligenceDraftSchema,
  StoryIntelligenceSchema,
  type CandidateBaselineScores,
  type GroundedCitation,
  type GroundedClaim,
  type ReusableCandidate,
  type StoryIntelligence,
  type StoredStoryCluster,
} from "@tempo/contracts";
import type { Pool, PoolClient, QueryResultRow } from "pg";

export type StoryRepository = {
  saveStoryIntelligence(input: unknown): Promise<StoryIntelligence>;
  getStoryIntelligence(clusterId: string): Promise<StoryIntelligence | null>;
  listReadyCandidates(limit: number): Promise<ReusableCandidate[]>;
  listReadyStoryIntelligence(limit: number): Promise<StoryIntelligence[]>;
};

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

type ClusterRow = QueryResultRow & {
  id: string;
  deduplication_key: string;
  canonical_title: string;
  summary: string | null;
  first_seen_at: Date | string;
  last_updated_at: Date | string;
  status: "active" | "superseded" | "archived";
  created_at: Date | string;
  updated_at: Date | string;
};

type ClusterSourceRow = QueryResultRow & {
  source_item_id: string;
  membership_score: number;
  is_primary: boolean;
  canonical_url: string;
  source_title: string;
  publisher: string;
  published_at: Date | string | null;
};

type ClaimRow = QueryResultRow & {
  id: string;
  cluster_id: string;
  claim_key: string;
  kind: "source_fact" | "reported_claim" | "inference";
  claim_text: string;
  confidence: number;
  is_contested: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

type CitationRow = QueryResultRow & {
  id: string;
  claim_id: string;
  source_item_id: string;
  support_type: "direct" | "context" | "contradiction";
  supporting_text: string | null;
  canonical_url: string;
  source_title: string;
  publisher: string;
  published_at: Date | string | null;
};

type CandidateRow = QueryResultRow & {
  id: string;
  cluster_id: string;
  candidate_key: string;
  headline: string;
  takeaway: string;
  what_changed: string;
  estimated_seconds: number;
  language: string;
  content_class: "editorial";
  status: "draft" | "ready" | "retired";
  global_importance_score: number;
  novelty_score: number;
  urgency_score: number;
  credibility_score: number;
  source_diversity_score: number;
  recency_score: number;
  clickbait_penalty: number;
  confidence_score: number;
  prompt_version: string | null;
  model_version: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type ClaimIdentifierRow = QueryResultRow & {
  id: string;
  claim_key: string;
};

type CandidateClaimRow = QueryResultRow & {
  claim_id: string;
};

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toNullableIsoString = (value: Date | string | null): string | null =>
  value === null ? null : toIsoString(value);

const mapBaselineScores = (row: CandidateRow): CandidateBaselineScores => ({
  globalImportance: row.global_importance_score,
  novelty: row.novelty_score,
  urgency: row.urgency_score,
  credibility: row.credibility_score,
  sourceDiversity: row.source_diversity_score,
  recency: row.recency_score,
  clickbaitPenalty: row.clickbait_penalty,
  confidence: row.confidence_score,
});

const mapCandidate = (
  row: CandidateRow,
  claimIds: string[],
): ReusableCandidate => ({
  id: row.id,
  clusterId: row.cluster_id,
  key: row.candidate_key,
  headline: row.headline,
  takeaway: row.takeaway,
  whatChanged: row.what_changed,
  estimatedSeconds: row.estimated_seconds,
  language: row.language,
  contentClass: row.content_class,
  status: row.status,
  baselineScores: mapBaselineScores(row),
  claimIds,
  promptVersion: row.prompt_version,
  modelVersion: row.model_version,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

const loadStoryIntelligence = async (
  database: Queryable,
  clusterId: string,
): Promise<StoryIntelligence | null> => {
  const clusterResult = await database.query<ClusterRow>(
    `
      SELECT
        id,
        deduplication_key,
        canonical_title,
        summary,
        first_seen_at,
        last_updated_at,
        status,
        created_at,
        updated_at
      FROM story_clusters
      WHERE id = $1
    `,
    [clusterId],
  );
  const clusterRow = clusterResult.rows[0];
  if (clusterRow === undefined) {
    return null;
  }

  const sourceResult = await database.query<ClusterSourceRow>(
    `
          SELECT
            membership.source_item_id,
            membership.membership_score::DOUBLE PRECISION,
            membership.is_primary,
            item.canonical_url,
            item.title AS source_title,
            source.name AS publisher,
            item.published_at
          FROM story_cluster_items membership
          INNER JOIN source_items item ON item.id = membership.source_item_id
          INNER JOIN sources source ON source.id = item.source_id
          WHERE membership.cluster_id = $1
          ORDER BY membership.is_primary DESC, membership.source_item_id
        `,
    [clusterId],
  );
  const claimResult = await database.query<ClaimRow>(
    `
          SELECT
            id,
            cluster_id,
            claim_key,
            kind,
            claim_text,
            confidence::DOUBLE PRECISION,
            is_contested,
            created_at,
            updated_at
          FROM claims
          WHERE cluster_id = $1
          ORDER BY claim_key, id
        `,
    [clusterId],
  );
  const citationResult = await database.query<CitationRow>(
    `
          SELECT
            citation.id,
            citation.claim_id,
            citation.source_item_id,
            citation.support_type,
            citation.supporting_text,
            item.canonical_url,
            item.title AS source_title,
            source.name AS publisher,
            item.published_at
          FROM citations citation
          INNER JOIN source_items item ON item.id = citation.source_item_id
          INNER JOIN sources source ON source.id = item.source_id
          WHERE citation.cluster_id = $1
          ORDER BY citation.claim_id, citation.id
        `,
    [clusterId],
  );
  const candidateResult = await database.query<CandidateRow>(
    `
          SELECT
            id,
            cluster_id,
            candidate_key,
            headline,
            takeaway,
            what_changed,
            estimated_seconds,
            language,
            content_class,
            status,
            global_importance_score::DOUBLE PRECISION,
            novelty_score::DOUBLE PRECISION,
            urgency_score::DOUBLE PRECISION,
            credibility_score::DOUBLE PRECISION,
            source_diversity_score::DOUBLE PRECISION,
            recency_score::DOUBLE PRECISION,
            clickbait_penalty::DOUBLE PRECISION,
            confidence_score::DOUBLE PRECISION,
            prompt_version,
            model_version,
            created_at,
            updated_at
          FROM candidate_updates
          WHERE cluster_id = $1
        `,
    [clusterId],
  );

  const citationsByClaim = new Map<string, GroundedCitation[]>();
  for (const row of citationResult.rows) {
    const citation: GroundedCitation = {
      id: row.id,
      sourceItemId: row.source_item_id,
      supportType: row.support_type,
      supportingText: row.supporting_text,
      canonicalUrl: row.canonical_url,
      sourceTitle: row.source_title,
      publisher: row.publisher,
      publishedAt: toNullableIsoString(row.published_at),
    };
    const claimCitations = citationsByClaim.get(row.claim_id) ?? [];
    claimCitations.push(citation);
    citationsByClaim.set(row.claim_id, claimCitations);
  }

  const claims: GroundedClaim[] = claimResult.rows.map((row) => ({
    id: row.id,
    clusterId: row.cluster_id,
    key: row.claim_key,
    kind: row.kind,
    text: row.claim_text,
    confidence: row.confidence,
    isContested: row.is_contested,
    citations: citationsByClaim.get(row.id) ?? [],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  }));

  const candidateRow = candidateResult.rows[0];
  if (candidateRow === undefined) {
    throw new Error(`Story cluster ${clusterId} has no candidate update.`);
  }
  const candidateClaimResult = await database.query<CandidateClaimRow>(
    `
      SELECT claim_id
      FROM candidate_claims
      WHERE candidate_id = $1
      ORDER BY position
    `,
    [candidateRow.id],
  );

  const cluster: StoredStoryCluster = {
    id: clusterRow.id,
    deduplicationKey: clusterRow.deduplication_key,
    canonicalTitle: clusterRow.canonical_title,
    summary: clusterRow.summary,
    firstSeenAt: toIsoString(clusterRow.first_seen_at),
    lastUpdatedAt: toIsoString(clusterRow.last_updated_at),
    status: clusterRow.status,
    sourceItems: sourceResult.rows.map((row) => ({
      sourceItemId: row.source_item_id,
      membershipScore: row.membership_score,
      isPrimary: row.is_primary,
      canonicalUrl: row.canonical_url,
      sourceTitle: row.source_title,
      publisher: row.publisher,
      publishedAt: toNullableIsoString(row.published_at),
    })),
    createdAt: toIsoString(clusterRow.created_at),
    updatedAt: toIsoString(clusterRow.updated_at),
  };

  return StoryIntelligenceSchema.parse({
    cluster,
    claims,
    candidate: mapCandidate(
      candidateRow,
      candidateClaimResult.rows.map(({ claim_id }) => claim_id),
    ),
  });
};

export class PostgresStoryRepository implements StoryRepository {
  public constructor(private readonly pool: Pool) {}

  public async saveStoryIntelligence(
    input: unknown,
  ): Promise<StoryIntelligence> {
    const draft = StoryIntelligenceDraftSchema.parse(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const clusterResult = await client.query<ClusterRow>(
        `
          INSERT INTO story_clusters (
            deduplication_key,
            canonical_title,
            summary,
            first_seen_at,
            last_updated_at,
            status
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (deduplication_key) DO UPDATE
          SET
            canonical_title = EXCLUDED.canonical_title,
            summary = EXCLUDED.summary,
            first_seen_at = LEAST(
              story_clusters.first_seen_at,
              EXCLUDED.first_seen_at
            ),
            last_updated_at = GREATEST(
              story_clusters.last_updated_at,
              EXCLUDED.last_updated_at
            ),
            status = EXCLUDED.status,
            updated_at = NOW()
          RETURNING
            id,
            deduplication_key,
            canonical_title,
            summary,
            first_seen_at,
            last_updated_at,
            status,
            created_at,
            updated_at
        `,
        [
          draft.cluster.deduplicationKey,
          draft.cluster.canonicalTitle,
          draft.cluster.summary,
          draft.cluster.firstSeenAt,
          draft.cluster.lastUpdatedAt,
          draft.cluster.status,
        ],
      );
      const clusterId = clusterResult.rows[0]?.id;
      if (clusterId === undefined) {
        throw new Error("Failed to save the story cluster.");
      }

      await client.query(
        `
          UPDATE story_cluster_items
          SET is_primary = FALSE
          WHERE cluster_id = $1
        `,
        [clusterId],
      );
      for (const sourceItem of draft.cluster.sourceItems) {
        await client.query(
          `
            INSERT INTO story_cluster_items (
              cluster_id,
              source_item_id,
              membership_score,
              is_primary
            )
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (cluster_id, source_item_id) DO UPDATE
            SET
              membership_score = EXCLUDED.membership_score,
              is_primary = EXCLUDED.is_primary
          `,
          [
            clusterId,
            sourceItem.sourceItemId,
            sourceItem.membershipScore,
            sourceItem.isPrimary,
          ],
        );
      }

      const claimIdsByKey = new Map<string, string>();
      for (const claim of draft.claims) {
        const claimResult = await client.query<ClaimIdentifierRow>(
          `
            INSERT INTO claims (
              cluster_id,
              claim_key,
              kind,
              claim_text,
              confidence,
              is_contested
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (cluster_id, claim_key) DO UPDATE
            SET
              kind = EXCLUDED.kind,
              claim_text = EXCLUDED.claim_text,
              confidence = EXCLUDED.confidence,
              is_contested = EXCLUDED.is_contested,
              updated_at = NOW()
            RETURNING id, claim_key
          `,
          [
            clusterId,
            claim.key,
            claim.kind,
            claim.text,
            claim.confidence,
            claim.isContested,
          ],
        );
        const claimId = claimResult.rows[0]?.id;
        if (claimId === undefined) {
          throw new Error(`Failed to save claim ${claim.key}.`);
        }
        claimIdsByKey.set(claim.key, claimId);

        await client.query("DELETE FROM citations WHERE claim_id = $1", [
          claimId,
        ]);
        for (const citation of claim.citations) {
          await client.query(
            `
              INSERT INTO citations (
                claim_id,
                cluster_id,
                source_item_id,
                support_type,
                supporting_text
              )
              VALUES ($1, $2, $3, $4, $5)
            `,
            [
              claimId,
              clusterId,
              citation.sourceItemId,
              citation.supportType,
              citation.supportingText,
            ],
          );
        }
      }

      const scores = draft.candidate.baselineScores;
      const candidateResult = await client.query<{ id: string }>(
        `
          INSERT INTO candidate_updates (
            cluster_id,
            candidate_key,
            headline,
            takeaway,
            what_changed,
            estimated_seconds,
            language,
            content_class,
            status,
            global_importance_score,
            novelty_score,
            urgency_score,
            credibility_score,
            source_diversity_score,
            recency_score,
            clickbait_penalty,
            confidence_score,
            prompt_version,
            model_version
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19
          )
          ON CONFLICT (cluster_id) DO UPDATE
          SET
            candidate_key = EXCLUDED.candidate_key,
            headline = EXCLUDED.headline,
            takeaway = EXCLUDED.takeaway,
            what_changed = EXCLUDED.what_changed,
            estimated_seconds = EXCLUDED.estimated_seconds,
            language = EXCLUDED.language,
            content_class = EXCLUDED.content_class,
            status = EXCLUDED.status,
            global_importance_score = EXCLUDED.global_importance_score,
            novelty_score = EXCLUDED.novelty_score,
            urgency_score = EXCLUDED.urgency_score,
            credibility_score = EXCLUDED.credibility_score,
            source_diversity_score = EXCLUDED.source_diversity_score,
            recency_score = EXCLUDED.recency_score,
            clickbait_penalty = EXCLUDED.clickbait_penalty,
            confidence_score = EXCLUDED.confidence_score,
            prompt_version = EXCLUDED.prompt_version,
            model_version = EXCLUDED.model_version,
            updated_at = NOW()
          RETURNING id
        `,
        [
          clusterId,
          draft.candidate.key,
          draft.candidate.headline,
          draft.candidate.takeaway,
          draft.candidate.whatChanged,
          draft.candidate.estimatedSeconds,
          draft.candidate.language,
          draft.candidate.contentClass,
          draft.candidate.status,
          scores.globalImportance,
          scores.novelty,
          scores.urgency,
          scores.credibility,
          scores.sourceDiversity,
          scores.recency,
          scores.clickbaitPenalty,
          scores.confidence,
          draft.candidate.promptVersion,
          draft.candidate.modelVersion,
        ],
      );
      const candidateId = candidateResult.rows[0]?.id;
      if (candidateId === undefined) {
        throw new Error("Failed to save the reusable candidate update.");
      }

      await client.query(
        "DELETE FROM candidate_claims WHERE candidate_id = $1",
        [candidateId],
      );
      for (const [index, claimKey] of draft.candidate.claimKeys.entries()) {
        const claimId = claimIdsByKey.get(claimKey);
        if (claimId === undefined) {
          throw new Error(`Unknown candidate claim key: ${claimKey}`);
        }
        await client.query(
          `
            INSERT INTO candidate_claims (
              candidate_id,
              cluster_id,
              claim_id,
              position
            )
            VALUES ($1, $2, $3, $4)
          `,
          [candidateId, clusterId, claimId, index + 1],
        );
      }

      await client.query(
        `
          DELETE FROM claims
          WHERE
            cluster_id = $1
            AND NOT (claim_key = ANY($2::TEXT[]))
        `,
        [clusterId, draft.claims.map(({ key }) => key)],
      );
      await client.query(
        `
          DELETE FROM story_cluster_items
          WHERE
            cluster_id = $1
            AND NOT (source_item_id = ANY($2::UUID[]))
        `,
        [
          clusterId,
          draft.cluster.sourceItems.map(({ sourceItemId }) => sourceItemId),
        ],
      );

      const stored = await loadStoryIntelligence(client, clusterId);
      if (stored === null) {
        throw new Error("Failed to reload the stored story intelligence.");
      }
      await client.query("COMMIT");
      return stored;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public getStoryIntelligence(
    clusterId: string,
  ): Promise<StoryIntelligence | null> {
    return loadStoryIntelligence(this.pool, clusterId);
  }

  public async listReadyCandidates(
    limit: number,
  ): Promise<ReusableCandidate[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new Error("limit must be between 1 and 200.");
    }
    const candidateResult = await this.pool.query<CandidateRow>(
      `
        SELECT
          id,
          cluster_id,
          candidate_key,
          headline,
          takeaway,
          what_changed,
          estimated_seconds,
          language,
          content_class,
          status,
          global_importance_score::DOUBLE PRECISION,
          novelty_score::DOUBLE PRECISION,
          urgency_score::DOUBLE PRECISION,
          credibility_score::DOUBLE PRECISION,
          source_diversity_score::DOUBLE PRECISION,
          recency_score::DOUBLE PRECISION,
          clickbait_penalty::DOUBLE PRECISION,
          confidence_score::DOUBLE PRECISION,
          prompt_version,
          model_version,
          created_at,
          updated_at
        FROM candidate_updates
        WHERE status = 'ready'
        ORDER BY updated_at DESC, id DESC
        LIMIT $1
      `,
      [limit],
    );

    return Promise.all(
      candidateResult.rows.map(async (row) => {
        const claims = await this.pool.query<CandidateClaimRow>(
          `
            SELECT claim_id
            FROM candidate_claims
            WHERE candidate_id = $1
            ORDER BY position
          `,
          [row.id],
        );
        return mapCandidate(
          row,
          claims.rows.map(({ claim_id }) => claim_id),
        );
      }),
    );
  }

  public async listReadyStoryIntelligence(
    limit: number,
  ): Promise<StoryIntelligence[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new Error("limit must be between 1 and 200.");
    }
    const result = await this.pool.query<{ cluster_id: string }>(
      `
        SELECT cluster_id
        FROM candidate_updates
        WHERE status = 'ready'
        ORDER BY updated_at DESC, id DESC
        LIMIT $1
      `,
      [limit],
    );
    const stories = await Promise.all(
      result.rows.map(({ cluster_id }) =>
        loadStoryIntelligence(this.pool, cluster_id),
      ),
    );
    return stories.filter(
      (story): story is StoryIntelligence => story !== null,
    );
  }
}
