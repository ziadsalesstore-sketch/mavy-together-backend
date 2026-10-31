import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/** Mandatory GDPR webhook: delete everything stored for this shop. */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);
  if (topic !== "SHOP_REDACT") return new Response(null, { status: 200 });

  await db.$transaction([
    db.vote.deleteMany({ where: { cycle: { shop } } }),
    db.votingCycle.deleteMany({ where: { shop } }),
    db.charity.deleteMany({ where: { shop } }),
    db.session.deleteMany({ where: { shop } }),
  ]);
  console.info(`[gdpr] shop/redact for ${shop}: all data deleted.`);
  return new Response(null, { status: 200 });
};
