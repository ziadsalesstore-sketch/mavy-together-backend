import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { Page, Card, FormLayout, Checkbox, Button, Banner, InlineStack, Text, BlockStack } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { Field } from "../components/Field";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  if (params.id === "new") return { charity: null };
  const charity = await db.charity.findFirst({ where: { id: params.id, shop: session.shop } });
  if (!charity) throw new Response("Not found", { status: 404 });
  return { charity };
};

const httpsOrEmpty = (v: string) => v === "" || /^https?:\/\/\S+$/i.test(v);

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "save");

  if (intent === "delete" && params.id !== "new") {
    const used = await db.vote.count({ where: { charityId: params.id } });
    if (used > 0) {
      return json({ errors: { form: "This charity has votes in a past or current cycle. Mark it inactive instead of deleting it." } }, { status: 400 });
    }
    await db.charity.deleteMany({ where: { id: params.id, shop: session.shop } });
    return redirect("/app/charities");
  }

  const str = (k: string) => String(form.get(k) ?? "").trim();
  const data = {
    name: str("name"),
    description: str("description") || null,
    category: str("category") || null,
    website: str("website"),
    logoUrl: str("logoUrl"),
    imageUrl: str("imageUrl"),
    imageAlt: str("imageAlt") || null,
    contact: str("contact") || null,
    verified: form.get("verified") === "on",
    active: form.get("active") === "on",
  };

  const errors: Record<string, string> = {};
  if (!data.name) errors.name = "Name is required.";
  if (!httpsOrEmpty(data.website)) errors.website = "Use a full link starting with https://";
  if (!httpsOrEmpty(data.logoUrl)) errors.logoUrl = "Use a full link starting with https://";
  if (!httpsOrEmpty(data.imageUrl)) errors.imageUrl = "Use a full link starting with https://";
  if (Object.keys(errors).length) return json({ errors }, { status: 400 });

  const clean = { ...data, website: data.website || null, logoUrl: data.logoUrl || null, imageUrl: data.imageUrl || null };

  if (params.id === "new") {
    await db.charity.create({ data: { ...clean, shop: session.shop } });
  } else {
    await db.charity.updateMany({ where: { id: params.id, shop: session.shop }, data: clean });
  }
  return redirect("/app/charities");
};

export default function CharityForm() {
  const { charity } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const errors = ((actionData as { errors?: Record<string, string> } | undefined)?.errors ?? {}) as Record<string, string>;
  const [verified, setVerified] = useState(charity?.verified ?? false);
  const [active, setActive] = useState(charity?.active ?? true);

  return (
    <Page
      title={charity ? charity.name : "Add charity"}
      backAction={{ content: "Charities", url: "/app/charities" }}
    >
      <BlockStack gap="400">
        {errors.form && <Banner tone="critical">{errors.form}</Banner>}
        <Form method="post">
          <Card>
            <FormLayout>
              <Field name="name" label="Name" defaultValue={charity?.name} error={errors.name} requiredField />
              <Field name="category" label="Category" defaultValue={charity?.category} helpText="For example: Education, Health, Environment." />
              <Field name="description" label="Description" defaultValue={charity?.description} multiline={4} helpText="Shown on the public voting card. Keep it short and factual." />
              <Field name="website" label="Website" type="url" defaultValue={charity?.website} error={errors.website} />
              <Field name="imageUrl" label="Cover image link" type="url" defaultValue={charity?.imageUrl} error={errors.imageUrl} helpText="Upload the photo in Shopify admin: Content, Files. Then copy its link and paste it here." />
              <Field name="imageAlt" label="Cover image description" defaultValue={charity?.imageAlt} helpText="Short description for screen readers." />
              <Field name="logoUrl" label="Logo link" type="url" defaultValue={charity?.logoUrl} error={errors.logoUrl} />
              <Field name="contact" label="Contact details (private)" defaultValue={charity?.contact} multiline={2} helpText="Only visible here in the admin. Never shown on the website." />
              <Checkbox label="Verified organisation" checked={verified} onChange={setVerified} />
              {verified && <input type="hidden" name="verified" value="on" />}
              <Checkbox label="Active (can appear in votes)" checked={active} onChange={setActive} />
              {active && <input type="hidden" name="active" value="on" />}
              <InlineStack gap="300">
                <Button submit variant="primary" loading={busy}>Save</Button>
              </InlineStack>
            </FormLayout>
          </Card>
        </Form>
        {charity && (
          <Form method="post" onSubmit={(e) => { if (!confirm("Delete this charity?")) e.preventDefault(); }}>
            <input type="hidden" name="intent" value="delete" />
            <Card>
              <InlineStack align="space-between" blockAlign="center">
                <Text as="p" tone="subdued">Charities that already received votes cannot be deleted, only made inactive.</Text>
                <Button submit tone="critical">Delete</Button>
              </InlineStack>
            </Card>
          </Form>
        )}
      </BlockStack>
    </Page>
  );
}
