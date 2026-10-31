import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/** Mandatory GDPR webhook: delete this customer's votes. */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);
  if (topic !== "CUSTOMERS_REDACT") return new Response(null, { status: 200 });

  const customerId = (payload as { customer?: { id?: number | string } }).customer?.id;
  if (customerId != null) {
    const { count } = await db.vote.deleteMany({
      where: { shopifyCustomerId: String(customerId), cycle: { shop } },
    });
    console.info(`[gdpr] customers/redact for ${shop}: deleted ${count} vote(s).`);
  }
  return new Response(null, { status: 200 });
};
