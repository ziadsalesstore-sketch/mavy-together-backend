import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Page, Card, IndexTable, Text, Badge, EmptyState } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { formatCairo } from "../lib/time";
import { isCycleOpen } from "../lib/voting.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const cycles = await db.votingCycle.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { charities: true, votes: true } } },
  });
  return {
    cycles: cycles.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      live: isCycleOpen(c),
      opensAt: c.opensAt,
      closesAt: c.closesAt,
      charities: c._count.charities,
      votes: c._count.votes,
    })),
  };
};

export default function Cycles() {
  const { cycles } = useLoaderData<typeof loader>();

  return (
    <Page title="Voting cycles" primaryAction={{ content: "New cycle", url: "/app/cycles/new" }}>
      <Card padding="0">
        {cycles.length === 0 ? (
          <EmptyState heading="No voting cycles yet" action={{ content: "New cycle", url: "/app/cycles/new" }} image="">
            <p>Create a cycle, choose 3 or 4 charities, then open it when you are ready.</p>
          </EmptyState>
        ) : (
          <IndexTable
            resourceName={{ singular: "cycle", plural: "cycles" }}
            itemCount={cycles.length}
            selectable={false}
            headings={[{ title: "Title" }, { title: "Status" }, { title: "Window (Cairo)" }, { title: "Charities" }, { title: "Votes (private)" }]}
          >
            {cycles.map((c, i) => (
              <IndexTable.Row id={c.id} key={c.id} position={i}>
                <IndexTable.Cell>
                  <Link to={`/app/cycles/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <Text as="span" fontWeight="semibold">{c.title}</Text>
                  </Link>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  {c.live ? <Badge tone="success">Open</Badge> : c.status === "open" ? <Badge tone="attention">Open, outside window</Badge> : c.status === "closed" ? <Badge>Closed</Badge> : <Badge tone="info">Draft</Badge>}
                </IndexTable.Cell>
                <IndexTable.Cell>{formatCairo(c.opensAt)} to {formatCairo(c.closesAt)}</IndexTable.Cell>
                <IndexTable.Cell>{c.charities}</IndexTable.Cell>
                <IndexTable.Cell>{c.votes}</IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        )}
      </Card>
    </Page>
  );
}
