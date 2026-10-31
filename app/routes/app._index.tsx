import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Page, Card, Text, BlockStack, InlineStack, Badge, Button, Banner } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { findOpenCycle } from "../lib/voting.server";
import { formatCairo } from "../lib/time";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [openCycle, activeCharities, latestClosed] = await Promise.all([
    findOpenCycle(shop),
    db.charity.count({ where: { shop, active: true } }),
    db.votingCycle.findFirst({ where: { shop, status: "closed" }, orderBy: { updatedAt: "desc" } }),
  ]);

  const totalVotes = openCycle ? await db.vote.count({ where: { cycleId: openCycle.id } }) : 0;
  const winner = latestClosed?.winnerCharityId
    ? await db.charity.findUnique({ where: { id: latestClosed.winnerCharityId }, select: { name: true } })
    : null;

  return {
    activeCharities,
    open: openCycle
      ? { id: openCycle.id, title: openCycle.title, closesAt: openCycle.closesAt, totalVotes }
      : null,
    latest: latestClosed ? { id: latestClosed.id, title: latestClosed.title, winner: winner?.name ?? null } : null,
  };
};

export default function Index() {
  const { activeCharities, open, latest } = useLoaderData<typeof loader>();

  return (
    <Page title="Mavy Together">
      <BlockStack gap="400">
        {activeCharities < 3 && (
          <Banner tone="info" title="Add charities to start a vote">
            <p>You have {activeCharities} active charit{activeCharities === 1 ? "y" : "ies"}. A voting cycle needs 3 or 4.</p>
          </Banner>
        )}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingMd">Current vote</Text>
              {open ? <Badge tone="success">Open</Badge> : <Badge>No vote open</Badge>}
            </InlineStack>
            {open ? (
              <>
                <Text as="p">{open.title}</Text>
                <Text as="p" tone="subdued">
                  Closes: {formatCairo(open.closesAt)} (Cairo). Votes so far: {open.totalVotes}. Visible to you only.
                </Text>
                <InlineStack>
                  <Link to={`/app/cycles/${open.id}`}><Button>Open results and controls</Button></Link>
                </InlineStack>
              </>
            ) : (
              <InlineStack>
                <Link to="/app/cycles/new"><Button variant="primary">Create a voting cycle</Button></Link>
              </InlineStack>
            )}
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">Latest finished vote</Text>
            {latest ? (
              <Text as="p">
                {latest.title}: {latest.winner ? `chosen cause is ${latest.winner}` : "no cause chosen yet"}
              </Text>
            ) : (
              <Text as="p" tone="subdued">None yet.</Text>
            )}
          </BlockStack>
        </Card>
        <Text as="p" tone="subdued">
          Weekly reveals and monthly impact are managed in the theme editor (Online Store, Customize, Mavy Together page).
          Vote counts and results never appear on the public site.
        </Text>
      </BlockStack>
    </Page>
  );
}
