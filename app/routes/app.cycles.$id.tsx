import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useState } from "react";
import {
  Page, Card, FormLayout, Checkbox, Button, Banner, InlineStack, Text, BlockStack, Badge, DataTable, Select,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { Field } from "../components/Field";
import { cairoLocalToDate, dateToCairoLocal, formatCairo } from "../lib/time";
import { isCycleOpen } from "../lib/voting.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const charities = await db.charity.findMany({ where: { shop, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });

  if (params.id === "new") {
    return { cycle: null, charities, selected: [] as string[], tally: [], totalVotes: 0, live: false };
  }

  const cycle = await db.votingCycle.findFirst({
    where: { id: params.id, shop },
    include: { charities: { orderBy: { position: "asc" }, include: { charity: { select: { id: true, name: true, active: true } } } } },
  });
  if (!cycle) throw new Response("Not found", { status: 404 });

  const grouped = await db.vote.groupBy({ by: ["charityId"], where: { cycleId: cycle.id }, _count: { _all: true } });
  const counts = new Map(grouped.map((g) => [g.charityId, g._count._all]));
  const totalVotes = grouped.reduce((n, g) => n + g._count._all, 0);
  const tally = cycle.charities
    .map((cc) => ({ id: cc.charity.id, name: cc.charity.name, votes: counts.get(cc.charity.id) ?? 0 }))
    .sort((a, b) => b.votes - a.votes);

  // A cycle may still list a charity that was made inactive later; keep it selectable here.
  const known = new Set(charities.map((c) => c.id));
  const extra = cycle.charities.filter((cc) => !known.has(cc.charity.id)).map((cc) => ({ id: cc.charity.id, name: `${cc.charity.name} (inactive)` }));

  return {
    cycle: {
      id: cycle.id,
      title: cycle.title,
      status: cycle.status,
      opensAt: dateToCairoLocal(cycle.opensAt),
      closesAt: dateToCairoLocal(cycle.closesAt),
      opensAtLabel: formatCairo(cycle.opensAt),
      closesAtLabel: formatCairo(cycle.closesAt),
      winnerCharityId: cycle.winnerCharityId,
      winnerNote: cycle.winnerNote,
    },
    charities: [...charities, ...extra],
    selected: cycle.charities.map((cc) => cc.charityId),
    tally,
    totalVotes,
    live: isCycleOpen(cycle),
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const form = await request.formData();
  const intent = String(form.get("intent") || "save");
  const fail = (message: string) => json({ error: message }, { status: 400 });

  if (params.id === "new" || intent === "save") {
    const title = String(form.get("title") ?? "").trim();
    if (!title) return fail("Give the cycle a title.");
    const opensAt = cairoLocalToDate(String(form.get("opensAt") ?? ""));
    const closesAt = cairoLocalToDate(String(form.get("closesAt") ?? ""));
    if (opensAt && closesAt && closesAt <= opensAt) return fail("The closing time must be after the opening time.");
    const ids = form.getAll("charityId").map(String);
    if (ids.length > 4) return fail("Choose at most 4 charities.");

    if (params.id === "new") {
      const created = await db.votingCycle.create({
        data: {
          shop, title, opensAt, closesAt,
          charities: { create: ids.map((charityId, position) => ({ charityId, position })) },
        },
      });
      return redirect(`/app/cycles/${created.id}`);
    }

    const existing = await db.votingCycle.findFirst({ where: { id: params.id, shop }, select: { id: true } });
    if (!existing) return fail("Cycle not found.");
    const hasVotes = (await db.vote.count({ where: { cycleId: existing.id } })) > 0;
    await db.$transaction(async (tx) => {
      await tx.votingCycle.update({ where: { id: existing.id }, data: { title, opensAt, closesAt } });
      if (!hasVotes) {
        await tx.cycleCharity.deleteMany({ where: { cycleId: existing.id } });
        await tx.cycleCharity.createMany({ data: ids.map((charityId, position) => ({ cycleId: existing.id, charityId, position })) });
      }
    });
    return json({ ok: hasVotes ? "Saved. The charity list is locked because votes exist." : "Saved." });
  }

  const cycle = await db.votingCycle.findFirst({ where: { id: params.id, shop }, include: { charities: true } });
  if (!cycle) return fail("Cycle not found.");

  if (intent === "open") {
    if (cycle.charities.length < 3 || cycle.charities.length > 4) return fail("A cycle needs 3 or 4 charities before it can open.");
    if (cycle.closesAt && cycle.closesAt <= new Date()) return fail("The closing time is in the past. Change it first.");
    const other = await db.votingCycle.findFirst({ where: { shop, status: "open", NOT: { id: cycle.id } }, select: { title: true } });
    if (other) return fail(`"${other.title}" is already open. Close it first.`);
    await db.votingCycle.update({ where: { id: cycle.id }, data: { status: "open" } });
    return json({ ok: "Voting is open." });
  }
  if (intent === "close") {
    await db.votingCycle.update({ where: { id: cycle.id }, data: { status: "closed" } });
    return json({ ok: "Voting is closed." });
  }
  if (intent === "winner") {
    const winner = String(form.get("winner") ?? "");
    if (winner && !cycle.charities.some((c) => c.charityId === winner)) return fail("Pick one of this cycle's charities.");
    await db.votingCycle.update({
      where: { id: cycle.id },
      data: { winnerCharityId: winner || null, winnerNote: String(form.get("winnerNote") ?? "").trim() || null },
    });
    return json({ ok: "Chosen cause saved." });
  }
  if (intent === "delete") {
    const votes = await db.vote.count({ where: { cycleId: cycle.id } });
    if (votes > 0) return fail("This cycle has votes. Close it instead of deleting it.");
    await db.votingCycle.delete({ where: { id: cycle.id } });
    return redirect("/app/cycles");
  }
  return fail("Unknown action.");
};

function downloadCsv(title: string, tally: { name: string; votes: number }[], total: number) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [["Charity", "Votes", "Percent"], ...tally.map((t) => [t.name, String(t.votes), total ? ((t.votes / total) * 100).toFixed(1) : "0"])];
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${title.replace(/[^\w-]+/g, "-")}-results.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function CycleDetail() {
  const { cycle, charities, selected, tally, totalVotes, live } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>() as { error?: string; ok?: string } | undefined;
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const [chosen, setChosen] = useState<string[]>(selected);
  const locked = totalVotes > 0;

  const toggle = (id: string, on: boolean) => setChosen((cur) => (on ? [...cur, id] : cur.filter((x) => x !== id)));
  const leader = tally[0] && tally[0].votes > 0 ? tally[0] : null;

  return (
    <Page title={cycle ? cycle.title : "New voting cycle"} backAction={{ content: "Voting", url: "/app/cycles" }}>
      <BlockStack gap="400">
        {result?.error && <Banner tone="critical">{result.error}</Banner>}
        {result?.ok && <Banner tone="success">{result.ok}</Banner>}

        <Form method="post">
          <Card>
            <FormLayout>
              <Field name="title" label="Title" defaultValue={cycle?.title} requiredField />
              <FormLayout.Group>
                <Field name="opensAt" label="Opens (Cairo time)" type="datetime-local" defaultValue={cycle?.opensAt} helpText="Optional. Voting only works while the cycle is Open and inside this window." />
                <Field name="closesAt" label="Closes (Cairo time)" type="datetime-local" defaultValue={cycle?.closesAt} helpText="Optional." />
              </FormLayout.Group>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Charities in this vote (3 or 4)</Text>
                {locked && <Text as="p" tone="subdued">Locked, because votes have been cast.</Text>}
                {charities.length === 0 && <Text as="p" tone="subdued">Add active charities first.</Text>}
                {charities.map((c) => (
                  <Checkbox
                    key={c.id}
                    label={c.name}
                    checked={chosen.includes(c.id)}
                    disabled={locked || (!chosen.includes(c.id) && chosen.length >= 4)}
                    onChange={(on) => toggle(c.id, on)}
                  />
                ))}
                {chosen.map((id) => <input key={id} type="hidden" name="charityId" value={id} />)}
              </BlockStack>
              <InlineStack>
                <Button submit variant="primary" loading={busy && nav.formData?.get("intent") !== "open"}>
                  {cycle ? "Save" : "Create cycle"}
                </Button>
              </InlineStack>
            </FormLayout>
          </Card>
        </Form>

        {cycle && (
          <>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Status</Text>
                  {live ? <Badge tone="success">Open</Badge> : cycle.status === "open" ? <Badge tone="attention">Open, outside window</Badge> : cycle.status === "closed" ? <Badge>Closed</Badge> : <Badge tone="info">Draft</Badge>}
                </InlineStack>
                <Text as="p" tone="subdued">Window: {cycle.opensAtLabel} to {cycle.closesAtLabel} (Cairo)</Text>
                <InlineStack gap="300">
                  {cycle.status !== "open" && (
                    <Form method="post"><input type="hidden" name="intent" value="open" /><Button submit variant="primary">Open voting</Button></Form>
                  )}
                  {cycle.status === "open" && (
                    <Form method="post"><input type="hidden" name="intent" value="close" /><Button submit>Close voting</Button></Form>
                  )}
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Results (private)</Text>
                  <Button onClick={() => downloadCsv(cycle.title, tally, totalVotes)} disabled={tally.length === 0}>Export CSV</Button>
                </InlineStack>
                <Text as="p" tone="subdued">Only you can see this. Nothing here is shown on the website.</Text>
                {tally.length === 0 ? (
                  <Text as="p" tone="subdued">Choose charities and save to see results.</Text>
                ) : (
                  <DataTable
                    columnContentTypes={["text", "numeric", "numeric"]}
                    headings={["Charity", "Votes", "Share"]}
                    rows={tally.map((t) => [t.name, t.votes, totalVotes ? `${((t.votes / totalVotes) * 100).toFixed(1)}%` : "0%"])}
                    totals={["Total", totalVotes, ""]}
                    showTotalsInFooter
                  />
                )}
              </BlockStack>
            </Card>

            <Card>
              <Form method="post">
                <input type="hidden" name="intent" value="winner" />
                <FormLayout>
                  <Text as="h2" variant="headingMd">Chosen cause</Text>
                  <Text as="p" tone="subdued">
                    {leader ? `Current leader: ${leader.name}. ` : ""}You decide the final choice and can override the vote. Announce it in your next weekly reveal.
                  </Text>
                  <WinnerSelect charities={tally} initial={cycle.winnerCharityId ?? ""} />
                  <Field name="winnerNote" label="Private note (optional)" defaultValue={cycle.winnerNote} />
                  <InlineStack><Button submit>Save chosen cause</Button></InlineStack>
                </FormLayout>
              </Form>
            </Card>

            {!locked && (
              <Form method="post" onSubmit={(e) => { if (!confirm("Delete this cycle?")) e.preventDefault(); }}>
                <input type="hidden" name="intent" value="delete" />
                <Card><InlineStack align="end"><Button submit tone="critical">Delete cycle</Button></InlineStack></Card>
              </Form>
            )}
          </>
        )}
      </BlockStack>
    </Page>
  );
}

function WinnerSelect({ charities, initial }: { charities: { id: string; name: string }[]; initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Select
        label="Cause we will support"
        options={[{ label: "Not chosen yet", value: "" }, ...charities.map((c) => ({ label: c.name, value: c.id }))]}
        value={value}
        onChange={setValue}
      />
      <input type="hidden" name="winner" value={value} />
    </>
  );
}
