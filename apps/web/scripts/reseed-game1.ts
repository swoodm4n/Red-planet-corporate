/**
 * Non-destructive reset of game id 1 to a pristine turn-1 makeGame() snapshot,
 * matching prisma/seed.ts's SLOTS. Regenerates Game.stateJson (and re-projects)
 * without touching the schema or any other rows. Used to guarantee the map-intel
 * test runs against a fresh seed (sub 1 espionage base = 1, sub 3 opsec = 2).
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import {
  type GameSetup,
  type ParentCompany,
  type PersonnelType,
  makeGame,
  neighbors,
} from "@rpc/engine";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { serializeGame } from "../src/lib/serialize";
import { projectGame } from "../src/server/gameStore";

const LANDING_ZONE = { col: 6, row: 4 };
const SLOTS: {
  name: string;
  parentCompany: ParentCompany;
  parentPerk: "A" | "B";
  hqHex: { col: number; row: number };
  choicePersonnel: [PersonnelType, PersonnelType];
}[] = [
  { name: "Terra Division", parentCompany: "TERRA_AGRICULTURAL", parentPerk: "A", hqHex: { col: 2, row: 2 }, choicePersonnel: ["ENGINEER", "ADMINISTRATOR"] },
  { name: "Consortium Dig", parentCompany: "UNIFIED_MINING", parentPerk: "A", hqHex: { col: 2, row: 6 }, choicePersonnel: ["ENGINEER", "CONTRACTOR"] },
  { name: "Stellar Freight", parentCompany: "STELLAR_DYNAMICS", parentPerk: "A", hqHex: { col: 6, row: 2 }, choicePersonnel: ["ENGINEER", "ADMINISTRATOR"] },
  { name: "Helix Labs", parentCompany: "HELIX_PHARMA", parentPerk: "A", hqHex: { col: 11, row: 2 }, choicePersonnel: ["INNOVATOR", "ANALYST"] },
  { name: "Omega Garrison", parentCompany: "OMEGA_SECURITY", parentPerk: "A", hqHex: { col: 11, row: 6 }, choicePersonnel: ["CONTRACTOR", "ANALYST"] },
  { name: "Genesis Works", parentCompany: "GENESIS_TECH", parentPerk: "A", hqHex: { col: 6, row: 7 }, choicePersonnel: ["INNOVATOR", "ANALYST"] },
];

async function main(): Promise<void> {
  const gameId = 1;
  const seed = randomBytes(8).readBigUInt64BE(0);
  const setup: GameSetup = {
    id: gameId,
    gameSeed: seed,
    landingZoneHex: LANDING_ZONE,
    subdivisions: SLOTS.map((s, i) => {
      const freeBuildingHex = neighbors(s.hqHex).find(
        (n) => !(n.col === LANDING_ZONE.col && n.row === LANDING_ZONE.row),
      );
      return {
        id: i + 1,
        name: s.name,
        parentCompany: s.parentCompany,
        parentPerk: s.parentPerk,
        choicePersonnel: s.choicePersonnel,
        hqHex: s.hqHex,
        freeBuildingHex,
      };
    }),
  };
  const game = makeGame(setup);
  // A pristine seed has no accumulated turn history. Clear game-scoped mutable rows
  // (append-only logs + per-turn submissions) so re-resolving turn 1 does not collide
  // with stale TurnLog(gameId,turnNumber) rows from a previously-advanced game.
  await prisma.turnLog.deleteMany({ where: { gameId } });
  await prisma.submission.deleteMany({ where: { gameId } });
  await prisma.researchProposal.deleteMany({ where: { gameId } });
  await prisma.adminQueuedAction.deleteMany({ where: { gameId } });
  await prisma.announcement.deleteMany({ where: { gameId } });
  await prisma.game.update({
    where: { id: gameId },
    data: {
      turnNumber: game.turnNumber,
      seed: seed.toString(),
      stateJson: serializeGame(game) as Prisma.InputJsonValue,
    },
  });
  await prisma.$transaction((tx) => projectGame(tx, gameId, game));
  console.log(`[reseed] game 1 reset to fresh turn ${game.turnNumber} (seed=${seed})`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
