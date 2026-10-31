import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { findOpenCycle } from "../lib/voting.server";

/**
 * Customer-facing path: GET/POST /apps/together/vote.
 * Shopify's App Proxy strips the "apps/together" prefix, so the file is just vote.tsx.
 *
 * Privacy rules enforced here:
 *  - No counts, percentages or rankings are ever returned.
 *  - The only per-customer data returned is whether THIS customer has voted.
 *  - Charity contact details are never selected.
 */
function customerIdOf(request: Request) {
  return new URL(request.url).searchParams.get("logged_in_customer_id");
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) return json({ error: "unauthenticated" }, { status: 401 });

  const customerId = customerIdOf(request);
  const cycle = await findOpenCycle(session.shop);
  if (!cycle) return json({ open: false, charities: [], hasVoted: false, loggedIn: !!customerId });

  const existing = customerId
    ? await db.vote.findUnique({
        where: { cycleId_shopifyCustomerId: { cycleId: cycle.id, shopifyCustomerId: customerId } },
        select: { id: true },
      })
    : null;

  return json({
    open: true,
    cycle: { id: cycle.id, title: cycle.title, closesAt: cycle.closesAt },
    loggedIn: !!customerId,
    hasVoted: !!existing,
    charities: cycle.charities
      .filter((cc) => cc.charity.active)
      .map((cc) => ({
        id: cc.charity.id,
        name: cc.charity.name,
        description: cc.charity.description,
        category: cc.charity.category,
        website: cc.charity.website,
        logoUrl: cc.charity.logoUrl,
        imageUrl: cc.charity.imageUrl,
        imageAlt: cc.charity.imageAlt,
      })),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });

  const { session } = await authenticate.public.appProxy(request);
  if (!session) return json({ error: "unauthenticated" }, { status: 401 });

  const customerId = customerIdOf(request);
  if (!customerId) return json({ error: "not_logged_in" }, { status: 401 });

  let charityId: string | undefined;
  try {
    const body = await request.json();
    charityId = typeof body?.charityId === "string" ? body.charityId : undefined;
  } catch {
    // falls through to invalid_charity
  }
  if (!charityId) return json({ error: "invalid_charity" }, { status: 400 });

  const cycle = await findOpenCycle(session.shop);
  if (!cycle) return json({ error: "closed" }, { status: 409 });

  const allowed = cycle.charities.some((cc) => cc.charityId === charityId && cc.charity.active);
  if (!allowed) return json({ error: "invalid_charity" }, { status: 400 });

  try {
    await db.vote.create({
      data: { cycleId: cycle.id, charityId, shopifyCustomerId: customerId },
    });
  } catch (e) {
    // The unique (cycleId, shopifyCustomerId) index is the real duplicate-vote guard,
    // so two simultaneous clicks cannot both succeed.
    if ((e as { code?: string })?.code === "P2002") {
      return json({ error: "already_voted" }, { status: 409 });
    }
    console.error("[vote] failed", e);
    return json({ error: "server_error" }, { status: 500 });
  }

  return json({ ok: true });
};
