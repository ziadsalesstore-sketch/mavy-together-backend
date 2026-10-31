import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Page, Card, IndexTable, Text, Badge, EmptyState, InlineStack, Thumbnail } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const charities = await db.charity.findMany({
    where: { shop: session.shop },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, category: true, logoUrl: true, verified: true, active: true },
  });
  return { charities };
};

export default function Charities() {
  const { charities } = useLoaderData<typeof loader>();

  return (
    <Page
      title="Charities"
      primaryAction={{ content: "Add charity", url: "/app/charities/new" }}
    >
      <Card padding="0">
        {charities.length === 0 ? (
          <EmptyState
            heading="No charities yet"
            action={{ content: "Add charity", url: "/app/charities/new" }}
            image=""
          >
            <p>Add the organisations your community can vote for.</p>
          </EmptyState>
        ) : (
          <IndexTable
            resourceName={{ singular: "charity", plural: "charities" }}
            itemCount={charities.length}
            selectable={false}
            headings={[
              { title: "Name" },
              { title: "Category" },
              { title: "Verified" },
              { title: "Status" },
            ]}
          >
            {charities.map((c, i) => (
              <IndexTable.Row id={c.id} key={c.id} position={i}>
                <IndexTable.Cell>
                  <Link to={`/app/charities/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <InlineStack gap="300" blockAlign="center">
                      {c.logoUrl ? <Thumbnail source={c.logoUrl} alt="" size="small" /> : null}
                      <Text as="span" fontWeight="semibold">{c.name}</Text>
                    </InlineStack>
                  </Link>
                </IndexTable.Cell>
                <IndexTable.Cell>{c.category || "-"}</IndexTable.Cell>
                <IndexTable.Cell>{c.verified ? <Badge tone="success">Verified</Badge> : <Badge>Not verified</Badge>}</IndexTable.Cell>
                <IndexTable.Cell>{c.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        )}
      </Card>
    </Page>
  );
}
