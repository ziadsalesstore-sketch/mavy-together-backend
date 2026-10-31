import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

declare module "@remix-run/node" {
  interface Future {
    v3_singleFetch: true;
  }
}

// `shopify app dev` injects FRONTEND_PORT/BACKEND_PORT (per the roles
// declared in shopify.web.toml) so its reverse proxy knows which internal
// port to forward to. Respect whichever it assigns, falling back to a
// generic PORT/3000 for running this app outside the Shopify CLI.
const devServerPort = Number(
  process.env.FRONTEND_PORT || process.env.BACKEND_PORT || process.env.PORT || 3000,
);

export default defineConfig({
  server: {
    port: devServerPort,
    host: "localhost",
    // The dev tunnel domain changes on every restart, so Vite's Host-header
    // allowlist can't name it in advance. Local dev only — never set this in
    // a production Vite config.
    allowedHosts: true,
  },
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_lazyRouteDiscovery: true,
        v3_singleFetch: true,
      },
    }),
    tsconfigPaths(),
  ],
  build: {
    assetsInlineLimit: 0,
  },
}) satisfies UserConfig;
