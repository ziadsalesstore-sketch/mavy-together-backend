import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/**
 * Mandatory GDPR webhook. The only customer-linked data this app keeps is a vote row
 * (customer id, charity, timestamp). Report it to the merchant on request.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);
  if (topic !== "CUSTOMERS_DATA_REQUEST") return new Response(null, { status: 200 });
  const id = (payload as { customer?: { id?: number | string } }).customer?.id;
  console.info(`[gdpr] customers/data_request for ${shop}, customer ${id ?? "unknown"}: stored data is vote rows only.`);
  return new Response(null, { status: 200 });
};
