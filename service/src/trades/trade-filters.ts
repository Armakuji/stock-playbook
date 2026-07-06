import { Prisma } from "@prisma/client";

/**
 * Single source of truth for "not soft-deleted" — every read of the Trade
 * model (list/get/stats/AI validate) MUST go through this helper instead of
 * hand-writing `deletedAt: null` per query, so a new query can't forget it.
 */
export function activeTradeWhere(
  where: Prisma.TradeWhereInput = {},
): Prisma.TradeWhereInput {
  return { ...where, deletedAt: null };
}
