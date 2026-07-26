"use client";

import type {
  DesiredDepth,
  InterestType,
  UserInterest,
} from "@tempo/contracts";
import { useCallback, useEffect, useState } from "react";

import {
  createInterest,
  deleteInterest,
  fetchInterests,
  updateInterest,
} from "./api";
import { FeatureShell } from "./FeatureShell";
import { useProtectedPage } from "./use-protected-page";

export function InterestManager() {
  const protection = useProtectedPage("/interests");
  const [items, setItems] = useState<UserInterest[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<InterestType>("topic");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setItems((await fetchInterests()).items);
  }, []);

  useEffect(() => {
    if (protection.ready)
      void load().catch(() => setMessage("Could not load."));
  }, [load, protection.ready]);

  if (!protection.ready) {
    return (
      <main className="centerState">
        <h1>Preparing your interests</h1>
        <p>{protection.error ?? "Checking your secure session."}</p>
      </main>
    );
  }

  const add = async (): Promise<void> => {
    if (name.trim().length === 0) return;
    try {
      await createInterest({
        type,
        name: name.trim(),
        description: type === "instruction" ? name.trim() : "Managed in Tempo",
        importance: 3,
        expertiseLevel: "intermediate",
        desiredDepth: "standard",
        alertSensitivity: 1,
        preferredSources: [],
        blockedSources: [],
        keywords: [],
        excludedKeywords: [],
      });
      setName("");
      await load();
      setMessage("Interest added.");
    } catch {
      setMessage("Could not add this interest.");
    }
  };

  return (
    <FeatureShell
      eyebrow="YOUR SIGNAL"
      title="Interests should evolve with you."
      copy="Add topics, entities, and natural-language rules. Muting is reversible; deletion removes future selection while preserving historical briefing evidence."
    >
      <section className="featureCard featureForm">
        <h2>Add an interest</h2>
        <div className="choiceRow">
          {(["topic", "entity", "instruction"] as const).map((value) => (
            <button
              className={type === value ? "choice selected" : "choice"}
              key={value}
              onClick={() => setType(value)}
            >
              {value === "instruction" ? "Natural-language rule" : value}
            </button>
          ))}
        </div>
        <textarea
          aria-label="New interest"
          onChange={(event) => setName(event.target.value)}
          placeholder={
            type === "instruction"
              ? "Tell me about… but skip…"
              : `Add a ${type}`
          }
          rows={type === "instruction" ? 3 : 1}
          value={name}
        />
        <button className="primaryAction" onClick={() => void add()}>
          Add interest
        </button>
      </section>
      <div className="featureGrid">
        {items.map((interest) => (
          <InterestEditor
            interest={interest}
            key={interest.id}
            onChanged={load}
          />
        ))}
      </div>
      {message === null ? null : <p className="formMessage">{message}</p>}
    </FeatureShell>
  );
}

function InterestEditor({
  interest,
  onChanged,
}: {
  interest: UserInterest;
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState(interest.name);
  const [description, setDescription] = useState(interest.description ?? "");
  const [importance, setImportance] = useState(interest.importance);
  const [depth, setDepth] = useState<DesiredDepth>(interest.desiredDepth);
  const [busy, setBusy] = useState(false);

  const save = async (): Promise<void> => {
    setBusy(true);
    try {
      await updateInterest(interest.id, {
        name: name.trim(),
        description: description.trim() || null,
        importance,
        desiredDepth: depth,
      });
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`featureCard ${interest.active ? "" : "mutedCard"}`}>
      <p className="eyebrow">{interest.type.toUpperCase()}</p>
      <input onChange={(event) => setName(event.target.value)} value={name} />
      <textarea
        onChange={(event) => setDescription(event.target.value)}
        rows={3}
        value={description}
      />
      <label>
        Importance
        <select
          onChange={(event) => setImportance(Number(event.target.value))}
          value={importance}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <label>
        Depth
        <select
          onChange={(event) => setDepth(event.target.value as DesiredDepth)}
          value={depth}
        >
          <option value="brief">Brief</option>
          <option value="standard">Standard</option>
          <option value="deep">Deep</option>
        </select>
      </label>
      <div className="actionRow">
        <button disabled={busy} onClick={() => void save()}>
          Save edits
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void updateInterest(interest.id, { active: !interest.active }).then(
              onChanged,
            )
          }
        >
          {interest.active ? "Mute" : "Reactivate"}
        </button>
        <button
          className="dangerAction"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Delete this interest from future briefings?")) {
              void deleteInterest(interest.id).then(onChanged);
            }
          }}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
