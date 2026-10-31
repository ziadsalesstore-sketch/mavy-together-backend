import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import {
  AppProvider as PolarisAppProvider,
  Button,
  Card,
  FormLayout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { login } from "../shopify.server";

/**
 * shopify-app-remix reserves ${authPathPrefix}/login (here, /auth/login)
 * for a dedicated login route calling `login()`, distinct from every other
 * /auth/* path which auth.$.tsx handles via `authenticate.admin()`. Remix's
 * static route (this file) wins over the auth.$.tsx splat for this exact
 * path.
 *
 * `login(request)` either returns a redirect Response straight into OAuth
 * (handled automatically, never reaches this component) when it can
 * determine the shop, or returns an `errors` object describing why it
 * couldn't (e.g. no/invalid `shop` param) — in which case this renders the
 * minimal form Shopify's own official app template ships, so the merchant
 * can enter/confirm the shop domain and submit.
 */
export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = await login(request);
  return json({ errors, polarisTranslations });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = await login(request);
  return json({ errors });
};

export default function AuthLogin() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");
  const errors = actionData?.errors ?? loaderData.errors ?? {};

  return (
    <PolarisAppProvider i18n={loaderData.polarisTranslations}>
      <Page>
        <Card>
          <Form method="post">
            <FormLayout>
              <Text variant="headingMd" as="h2">
                Log in
              </Text>
              <TextField
                type="text"
                name="shop"
                label="Shop domain"
                helpText="example.myshopify.com"
                value={shop}
                onChange={setShop}
                autoComplete="on"
                error={(errors as Record<string, string>).shop}
              />
              <Button submit>Log in</Button>
            </FormLayout>
          </Form>
        </Card>
      </Page>
    </PolarisAppProvider>
  );
}
