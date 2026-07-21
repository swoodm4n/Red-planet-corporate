/**
 * Seed: creates the admin account (credentials from env, never hardcoded) and a
 * fresh 6-player game using the engine's makeGame + the six parent corporations
 * from GAME_SPEC §5. Idempotent: re-running will not duplicate the admin or the
 * seed game.
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
import { hashPassword } from "../src/lib/auth/password";
import { serializeGame } from "../src/lib/serialize";
import { projectGame } from "../src/server/gameStore";
import { env } from "../src/lib/env";

const SEED_GAME_NAME = "Red Planet — Season 1";

const LANDING_ZONE = { col: 6, row: 4 };

// Six subdivision slots, one per parent company (§5). Perk A by default.
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

function randomU64(): bigint {
  const buf = randomBytes(8);
  return buf.readBigUInt64BE(0);
}

async function seedAdmin(): Promise<void> {
  const email = env.adminEmail.toLowerCase();
  const passwordHash = await hashPassword(env.adminPassword);
  await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", status: "APPROVED", passwordHash },
    create: { email, passwordHash, role: "ADMIN", status: "APPROVED", displayName: "Game Master" },
  });
  console.log(`[seed] admin account ready: ${email}`);
}

async function seedGame(): Promise<void> {
  const existing = await prisma.game.findFirst({ where: { name: SEED_GAME_NAME } });
  if (existing) {
    console.log(`[seed] game "${SEED_GAME_NAME}" already exists (id ${existing.id}); skipping`);
    return;
  }

  const gameId = 1;
  const seed = randomU64();

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
  const turnLength = env.defaultTurnLengthHours;
  const deadline = new Date(Date.now() + turnLength * 3600 * 1000);

  await prisma.game.create({
    data: {
      id: gameId,
      name: SEED_GAME_NAME,
      seed: seed.toString(),
      turnNumber: game.turnNumber,
      status: "ACTIVE",
      turnLengthHours: turnLength,
      turnDeadline: deadline,
      stateJson: serializeGame(game) as Prisma.InputJsonValue,
    },
  });

  await prisma.$transaction((tx) => projectGame(tx, gameId, game));

  console.log(`[seed] created game "${SEED_GAME_NAME}" (id ${gameId}) with 6 subdivisions; seed=${seed}`);
}

async function main(): Promise<void> {
  await seedAdmin();
  await seedGame();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
