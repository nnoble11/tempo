# Ranking and Briefing Planning

Status: Foundation implementation  
Last updated: 2026-07-17

## Purpose

Ranking decides which reusable candidate updates are most valuable for a
specific user at a specific time. Briefing planning then selects from those
ranked candidates while respecting a hard duration budget and cross-interest
diversity.

The implementation retains component scores. A final score is never stored or
returned without its inputs and intermediate totals.

## Initial component model

Positive components, normalized from zero to one:

- personal relevance;
- global importance;
- novelty;
- urgency;
- credibility;
- source diversity;
- interest strength;
- behavioral affinity;
- recency;
- timing fit;
- confidence.

Penalty components, also normalized from zero to one:

- redundancy;
- fatigue;
- clickbait;
- commercial-content pressure.

The initial deterministic score is:

```text
base =
  personal_relevance
  × confidence
  × credibility
  × novelty
  × timing_fit

bonus =
  0.12 × global_importance
  + 0.12 × urgency
  + 0.10 × interest_strength
  + 0.05 × source_diversity
  + 0.05 × behavioral_affinity
  + 0.06 × recency

penalty =
  0.25 × redundancy
  + 0.10 × fatigue
  + 0.15 × clickbait
  + 0.50 × commercial_content

final = clamp(base + bonus - penalty, 0, 1)
```

These weights are an observable starting point, not a permanent relevance model.
Changes require evaluation against versioned fixtures and documented reasoning.

## Reusable and personalized components

Persisted reusable candidate updates retain only signals that can be evaluated
without a user:

- global importance;
- novelty;
- urgency;
- credibility;
- source diversity;
- recency;
- clickbait penalty;
- confidence.

Personal relevance, interest strength, behavioral affinity, timing fit,
redundancy, fatigue, and commercial-content pressure are applied later for a
specific user and moment. The reusable repository schema has no columns for
those personalized signals.

This separation prevents one user's behavior or timing context from mutating a
candidate consumed by other users.

## Planner behavior

The foundation planner:

1. Validates all candidates and requires at least one citation per candidate.
2. Rejects duplicate candidate and story-cluster identifiers.
3. Calculates transparent ranking results.
4. Sorts by final score with a stable identifier tie-break.
5. Makes a first pass that favors uncovered interests.
6. Makes a second pass that fills remaining time with the strongest fitting
   candidates.
7. Never selects an item that would exceed the target duration.

The planner returns a selection and time allocation. It does not generate prose,
mutate reusable candidates, or perform delivery.

## Known limitations

The initial greedy allocator does not solve a global optimization problem. A
large high-ranking item can prevent a combination of smaller items from using
the full budget. That tradeoff keeps the foundation deterministic and
explainable while real usage data is gathered.

Future versions should evaluate:

- knapsack-style utilization;
- explicit explore-versus-exploit capacity;
- per-interest fatigue and minimum/maximum coverage;
- personalized reading-speed estimates;
- briefing-level narrative coherence;
- source and geography diversity;
- calibration of alert ranking separately from briefing ranking.

## Evaluation requirements

Before changing weights or selection behavior, measure:

- useful/not-useful ratio;
- duplicate-item rate;
- briefing duration error;
- interest coverage;
- source diversity;
- unsupported-claim rate;
- change in selection versus a versioned baseline fixture.

An unclicked summary is not automatically a negative behavioral signal.
