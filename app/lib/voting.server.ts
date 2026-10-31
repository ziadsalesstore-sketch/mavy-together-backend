import db from "../db.server";

/** A cycle accepts votes only while status is "open" AND now is inside its optional window. */
export function isCycleOpen(
  c: { status: string; opensAt: Date | null; closesAt: Date | null },
  now = new Date(),
) {
  if (c.status !== "open") return false;
  if (c.opensAt && c.opensAt > now) return false;
  if (c.closesAt && c.closesAt <= now) return false;
  return true;
}

export async function findOpenCycle(shop: string) {
  const cycles = await db.votingCycle.findMany({
    where: { shop, status: "open" },
    orderBy: { createdAt: "desc" },
    include: {
      charities: {
        orderBy: { position: "asc" },
        include: { charity: true },
      },
    },
  });
  return cycles.find((c) => isCycleOpen(c)) ?? null;
}
