import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// Handles the OAuth install/auth flow at /auth/* (authPathPrefix in
// shopify.server.ts). Required for the app to be installable at all —
// this is what the merchant's browser hits during "Install app".
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};
