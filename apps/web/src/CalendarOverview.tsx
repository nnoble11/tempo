"use client";

import type { CalendarAvailability } from "@tempo/contracts";
import { useEffect, useState } from "react";

import { disconnectCalendar, fetchCalendarAvailability } from "./api";
import { FeatureShell } from "./FeatureShell";
import { useProtectedPage } from "./use-protected-page";

export function CalendarOverview() {
  const protection = useProtectedPage("/calendar");
  const [availability, setAvailability] = useState<CalendarAvailability | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    setAvailability(await fetchCalendarAvailability());
  };

  useEffect(() => {
    if (protection.ready) {
      void load().catch(() => setMessage("Availability could not be loaded."));
    }
  }, [protection.ready]);

  if (!protection.ready || availability === null) {
    return (
      <main className="centerState">
        <h1>Preparing calendar availability</h1>
        <p>{protection.error ?? message ?? "Checking your secure session."}</p>
      </main>
    );
  }

  return (
    <FeatureShell
      eyebrow="CALENDAR AVAILABILITY"
      title="Make open time useful, not invasive."
      copy="Calendar permission and synchronization happen on iOS. The web companion receives only time-only busy intervals and can remove them at any time."
    >
      <section className="featureCard">
        <h2>Privacy boundary</h2>
        <p className="muted">
          Tempo never stores event titles, descriptions, locations, attendees,
          calendar names, or event identifiers. It never edits your calendar.
        </p>
        {availability.connection === null ? (
          <p>Open Calendar in the Tempo iOS app to connect this feature.</p>
        ) : (
          <div className="actionRow">
            <span>
              Connected · last synced{" "}
              {availability.connection.lastSyncedAt === null
                ? "never"
                : new Date(
                    availability.connection.lastSyncedAt,
                  ).toLocaleString()}
            </span>
            <button
              className="dangerAction"
              onClick={() =>
                void disconnectCalendar(availability.connection?.id ?? "")
                  .then(load)
                  .then(() =>
                    setMessage("Connection and busy windows deleted."),
                  )
              }
            >
              Disconnect and delete
            </button>
          </div>
        )}
      </section>
      <section className="featureCard suggestionCard">
        {availability.suggestion === null ? (
          <>
            <h2>No suggestion right now</h2>
            <p className="muted">
              Tempo only offers a briefing when a synchronized free window fits
              at least two minutes.
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow">A GOOD MOMENT</p>
            <h2>
              You have {availability.suggestion.availableMinutes} minutes.
            </h2>
            <p className="muted">
              A {availability.suggestion.suggestedBriefingMinutes}-minute
              briefing fits before your next busy window.
            </p>
            <a className="primaryLink" href="/">
              Open Today
            </a>
          </>
        )}
      </section>
      {message === null ? null : <p className="formMessage">{message}</p>}
    </FeatureShell>
  );
}
