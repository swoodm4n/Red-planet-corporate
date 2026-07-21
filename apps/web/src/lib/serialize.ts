/**
 * Lossless (de)serialization between the engine `Game` object graph and a
 * JSON-safe representation storable in Postgres (Prisma Json). [D-045]
 *
 * The only non-JSON-native values in `Game` are:
 *   - gameSeed: bigint                 -> decimal string
 *   - milestonesClaimed: Set<string>   -> string[]
 *   - subdivision.closedBordersAgainst: Set<number | "ALL"> -> (number|"ALL")[]
 * Everything else (Records, arrays, fixed-point numbers) is already JSON-safe.
 *
 * This is a pure data transform — it contains NO game logic. Round-trip identity
 * is covered by an integration test.
 */

import type { Game } from "@rpc/engine";

export type SerializedGame = Record<string, unknown>;

export function serializeGame(game: Game): SerializedGame {
  return {
    ...game,
    gameSeed: game.gameSeed.toString(),
    milestonesClaimed: Array.from(game.milestonesClaimed),
    subdivisions: game.subdivisions.map((s) => ({
      ...s,
      closedBordersAgainst: Array.from(s.closedBordersAgainst),
    })),
  } as SerializedGame;
}

export function deserializeGame(obj: SerializedGame): Game {
  const raw = obj as unknown as Game & {
    gameSeed: string;
    milestonesClaimed: string[];
    subdivisions: (Omit<Game["subdivisions"][number], "closedBordersAgainst"> & {
      closedBordersAgainst: (number | "ALL")[];
    })[];
  };

  const game: Game = {
    ...(raw as unknown as Game),
    gameSeed: BigInt(raw.gameSeed),
    milestonesClaimed: new Set(raw.milestonesClaimed ?? []),
    subdivisions: raw.subdivisions.map((s) => ({
      ...(s as unknown as Game["subdivisions"][number]),
      closedBordersAgainst: new Set<number | "ALL">(s.closedBordersAgainst ?? []),
    })),
  };
  return game;
}
