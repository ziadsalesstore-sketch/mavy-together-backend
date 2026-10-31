import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/**
 * This is the route Shopify loads when a merchant opens the embedded app
 * inside admin (application_url points at the bare domain root). Calling
 * authenticate.admin(request) here is what actually performs the OAuth
 * handshake and writes a session into our own session storage table —
 * without it, webhooks silently can't get an `admin` client.
 *
 * The real UI lives under /app/* (see app/routes/app.tsx); this route's
 * only job is to authenticate then hand off, preserving the embedded
 * context query params (shop, host, embedded) App Bridge needs.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const url = new URL(request.url);
  throw redirect(`/app${url.search}`);
};
