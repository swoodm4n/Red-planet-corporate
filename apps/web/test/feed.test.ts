import { describe, expect, it } from "vitest";
import { buildFeed, classifyEvent } from "@/lib/client/feed";
import type { DashboardResponse, Message } from "@/lib/client/types";

const names = new Map<number, string>([
  [1, "Terra Division"],
  [2, "Stellar Freight"],
]);

function msg(over: Partial<Message>): Message {
  return {
    id: "m1", gameId: 1, scope: "PUBLIC", channel: "COMMS",
    senderSubdivisionId: 1, recipientSubdivisionId: null, recipientIsAdmin: false,
    body: "hello", createdAt: "2026-07-21T10:00:00.000Z", ...over,
  };
}

describe("feed merge", () => {
  it("classifies events into lanes", () => {
    expect(classifyEvent("DUST_STORM")).toBe("SYSTEM");
    expect(classifyEvent("RAID_ALERT")).toBe("WAR");
    expect(classifyEvent("SENSOR_SWEEP", "INTEL")).toBe("INTEL");
  });

  it("merges sources newest-first and tags channels", () => {
    const dash = {
      announcements: [{ id: "a1", title: "Notice", body: "All quiet.", createdAt: "2026-07-21T09:00:00.000Z" }],
      colonyEvents: [
        { turnNumber: 3, at: "2026-07-21T08:00:00.000Z", event: { name: "No Event", message: "No event this turn", scope: "", affectedSubdivisionIds: [] } },
        { turnNumber: 4, at: "2026-07-21T11:00:00.000Z", event: { name: "SABOTAGE_STRIKE", message: "A depot was hit.", scope: "", affectedSubdivisionIds: [] } },
      ],
      market: [{ resource: "ENERGY", livePriceFp: 5000, livePrice: 0.5, cumulativeBought: 0, cumulativeSold: 0 }],
    } as unknown as DashboardResponse;

    const feed = buildFeed({
      messages: [msg({})],
      dashboard: dash,
      turns: [{ turnNumber: 4, createdAt: "2026-07-21T07:00:00.000Z" }],
      names,
      viewerSubdivisionId: 2,
    });

    // "No Event" filler is dropped.
    expect(feed.find((f) => /no event/i.test(f.body))).toBeUndefined();
    // War event present and lane-tagged.
    expect(feed.find((f) => f.channel === "WAR")).toBeTruthy();
    // Comms present from message; public sender labelled with rival name (viewer is 2).
    const comms = feed.find((f) => f.channel === "COMMS");
    expect(comms?.source).toContain("Terra Division");
    // Newest-first ordering.
    for (let i = 1; i < feed.length; i++) expect(feed[i - 1].at).toBeGreaterThanOrEqual(feed[i].at);
    // Market digest present.
    expect(feed.find((f) => f.channel === "MARKET")).toBeTruthy();
  });
});
