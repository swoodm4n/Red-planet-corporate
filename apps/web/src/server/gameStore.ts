/**
 * Game persistence: load the authoritative snapshot into an engine `Game`, save a
 * new snapshot, and rebuild the read-only projection tables. [D-045]
 */

import type { Prisma } from "@prisma/client";
import {
  type Game,
  computeCategoryScores,
  composite,
  computeScoreboard,
  rankByComposite,
} from "@rpc/engine";
import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/http";
import { deserializeGame, serializeGame } from "@/lib/serialize";

export interface LoadedGame {
  row: {
    id: number;
    name: string;
    seed: string;
    turnNumber: number;
    status: string;
    turnLengthHours: number;
    turnDeadline: Date | null;
  };
  game: Game;
}

export async function loadGame(gameId: number): Promise<LoadedGame> {
  const row = await prisma.game.findUnique({ where: { id: gameId } });
  if (!row) throw errors.notFound("Game not found");
  return {
    row: {
      id: row.id,
      name: row.name,
      seed: row.seed,
      turnNumber: row.turnNumber,
      status: row.status,
      turnLengthHours: row.turnLengthHours,
      turnDeadline: row.turnDeadline,
    },
    game: deserializeGame(row.stateJson as Record<string, unknown>),
  };
}

/** Persist a new engine snapshot to Game.stateJson and rebuild projections. */
export async function saveGameState(gameId: number, game: Game): Promise<void> {
  const serialized = serializeGame(game);
  await prisma.$transaction(async (tx) => {
    await tx.game.update({
      where: { id: gameId },
      data: { stateJson: serialized as Prisma.InputJsonValue, turnNumber: game.turnNumber },
    });
    await projectGame(tx, gameId, game);
  });
}

type Tx = Prisma.TransactionClient;

/** Wipe & rebuild all projection rows for a game from the engine state. [D-045] */
export async function projectGame(tx: Tx, gameId: number, game: Game): Promise<void> {
  await Promise.all([
    tx.subdivisionState.deleteMany({ where: { gameId } }),
    tx.buildingState.deleteMany({ where: { gameId } }),
    tx.moduleState.deleteMany({ where: { gameId } }),
    tx.personnelState.deleteMany({ where: { gameId } }),
    tx.vehicleState.deleteMany({ where: { gameId } }),
    tx.hexState.deleteMany({ where: { gameId } }),
    tx.marketPriceState.deleteMany({ where: { gameId } }),
    tx.equityPriceState.deleteMany({ where: { gameId } }),
    tx.equityHoldingState.deleteMany({ where: { gameId } }),
    tx.activeEffectState.deleteMany({ where: { gameId } }),
  ]);

  const boards = computeScoreboard(game);
  const ranked = rankByComposite(boards);
  const rankById = new Map<number, number>();
  ranked.forEach((b, i) => rankById.set(b.subdivisionId, i + 1));

  const subRows: Prisma.SubdivisionStateCreateManyInput[] = [];
  const buildingRows: Prisma.BuildingStateCreateManyInput[] = [];
  const moduleRows: Prisma.ModuleStateCreateManyInput[] = [];
  const personnelRows: Prisma.PersonnelStateCreateManyInput[] = [];
  const vehicleRows: Prisma.VehicleStateCreateManyInput[] = [];

  for (const s of game.subdivisions) {
    const cats = computeCategoryScores(game, s);
    subRows.push({
      gameId,
      subdivisionId: s.id,
      name: s.name,
      parentCompany: s.parentCompany,
      parentPerk: s.parentPerk,
      status: s.status,
      earthRelations: s.earthRelations,
      resourcesJson: s.resources as unknown as Prisma.InputJsonValue,
      composite: composite(cats),
      rank: rankById.get(s.id) ?? 0,
      categoriesJson: cats as unknown as Prisma.InputJsonValue,
      turnNumber: game.turnNumber,
    });
    for (const b of s.buildings) {
      buildingRows.push({
        gameId,
        buildingId: b.id,
        subdivisionId: s.id,
        type: b.type,
        tier: b.tier,
        col: b.hex.col,
        row: b.hex.row,
        status: b.status,
        garrisonJson: b.garrison as unknown as Prisma.InputJsonValue,
        modulesJson: b.modules as unknown as Prisma.InputJsonValue,
      });
      for (const m of b.modules) {
        moduleRows.push({
          gameId,
          moduleId: m.id,
          buildingId: b.id,
          subdivisionId: s.id,
          type: m.type,
          status: m.status,
        });
      }
    }
    for (const p of s.personnel) {
      personnelRows.push({
        gameId,
        personnelId: p.id,
        subdivisionId: s.id,
        type: p.type,
        status: p.status,
        assignedBuildingId: p.assignedBuildingId ?? null,
        assignedVehicleId: p.assignedVehicleId ?? null,
      });
    }
    for (const v of s.vehicles) {
      vehicleRows.push({
        gameId,
        vehicleId: v.id,
        subdivisionId: s.id,
        hull: v.hull,
        status: v.status,
        col: v.hex.col,
        row: v.hex.row,
        crewJson: v.crew as unknown as Prisma.InputJsonValue,
        modulesJson: v.modules as unknown as Prisma.InputJsonValue,
      });
    }
  }

  const hexRows: Prisma.HexStateCreateManyInput[] = game.map.map((h) => ({
    gameId,
    col: h.coord.col,
    row: h.coord.row,
    terrain: h.terrain,
    ownerSubdivisionId: h.ownerSubdivisionId ?? null,
    surveyed: h.surveyed ?? false,
  }));

  const marketRows: Prisma.MarketPriceStateCreateManyInput[] = (
    ["ENERGY", "MINERALS", "WATER", "FOOD", "RESEARCH"] as const
  ).map((res) => ({
    gameId,
    resource: res,
    livePrice: game.market.livePrice[res],
    cumulativeBought: game.market.cumulativeBought[res],
    cumulativeSold: game.market.cumulativeSold[res],
    turnNumber: game.turnNumber,
  }));

  const equityPriceRows: Prisma.EquityPriceStateCreateManyInput[] = Object.entries(
    game.equity.sharePrice,
  ).map(([issuer, price]) => ({
    gameId,
    issuerSubdivisionId: Number(issuer),
    sharePrice: price,
  }));

  const equityHoldingRows: Prisma.EquityHoldingStateCreateManyInput[] = game.equity.holdings.map(
    (h) => ({
      gameId,
      issuerSubdivisionId: h.issuerSubdivisionId,
      holderSubdivisionId: h.holderSubdivisionId,
      shares: h.shares,
    }),
  );

  const effectRows: Prisma.ActiveEffectStateCreateManyInput[] = game.activeEffects.map((e) => ({
    gameId,
    effectId: e.id,
    type: e.type,
    scope: e.scope,
    source: e.source,
    turnsRemaining: e.turnsRemaining,
    magnitude: e.magnitude ?? null,
    subdivisionId: e.subdivisionId ?? null,
    buildingId: e.buildingId ?? null,
  }));

  await Promise.all([
    subRows.length && tx.subdivisionState.createMany({ data: subRows }),
    buildingRows.length && tx.buildingState.createMany({ data: buildingRows }),
    moduleRows.length && tx.moduleState.createMany({ data: moduleRows }),
    personnelRows.length && tx.personnelState.createMany({ data: personnelRows }),
    vehicleRows.length && tx.vehicleState.createMany({ data: vehicleRows }),
    hexRows.length && tx.hexState.createMany({ data: hexRows }),
    marketRows.length && tx.marketPriceState.createMany({ data: marketRows }),
    equityPriceRows.length && tx.equityPriceState.createMany({ data: equityPriceRows }),
    equityHoldingRows.length && tx.equityHoldingState.createMany({ data: equityHoldingRows }),
    effectRows.length && tx.activeEffectState.createMany({ data: effectRows }),
  ]);
}
