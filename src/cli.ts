#!/usr/bin/env node
/**
 * Camelot CLI — lightweight wrapper for agents to report state back.
 * Usage:
 *   camelot-cli ticket list
 *   camelot-cli ticket get <id>
 *   camelot-cli ticket update <id> --status <stage> --project <name> --title <title>
 *   camelot-cli ticket create <title> [--project <name>]
 *   camelot-cli activity log <ticketId> <action> [--metadata <json>]
 *   camelot-cli standup [--date YYYY-MM-DD]
 */

const BASE_URL = process.env.CAMELOT_URL || "http://localhost:3000";

async function api(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${BASE_URL}/api${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-session-id": `cli-${process.pid}`,
      ...((options.headers as Record<string, string>) || {}),
    },
  });

  if (res.status === 204) return null;
  const body = await res.json() as any;
  if (!res.ok) {
    console.error(`Error: ${body.error || res.statusText}`);
    process.exit(1);
  }
  return body;
}

function parseArgs(args: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      flags[args[i].slice(2)] = args[++i];
    } else {
      positional.push(args[i]);
    }
  }
  return { positional, flags };
}

async function resolveProjectId(nameOrId: string): Promise<number | null> {
  const projects = await api("/projects");
  const num = Number(nameOrId);
  if (!isNaN(num)) {
    const byId = projects.find((p: any) => p.id === num);
    if (byId) return byId.id;
  }
  const byName = projects.find((p: any) => p.name.toLowerCase() === nameOrId.toLowerCase());
  return byName ? byName.id : null;
}

async function main() {
  const args = process.argv.slice(2);
  const { positional, flags } = parseArgs(args);

  const [resource, action, ...rest] = positional;

  if (!resource) {
    console.log("Usage: camelot-cli <resource> <action> [args] [--flags]");
    console.log("Resources: ticket, activity, standup");
    process.exit(0);
  }

  if (resource === "ticket") {
    if (action === "list") {
      const tickets = await api("/tickets");
      if (tickets.length === 0) {
        console.log("No tickets.");
        return;
      }
      for (const t of tickets) {
        console.log(`#${t.id}\t${t.stage}\t${t.projectId || "-"}\t${t.title}`);
      }
    } else if (action === "get") {
      const id = rest[0];
      if (!id) { console.error("Usage: camelot-cli ticket get <id>"); process.exit(1); }
      const ticket = await api(`/tickets`);
      const t = ticket.find((t: any) => t.id === Number(id));
      if (!t) { console.error(`Ticket #${id} not found`); process.exit(1); }
      console.log(JSON.stringify(t, null, 2));
    } else if (action === "create") {
      const title = rest.join(" ");
      if (!title) { console.error("Usage: camelot-cli ticket create <title>"); process.exit(1); }
      const body: any = { title };
      if (flags.project) {
        const pid = await resolveProjectId(flags.project);
        if (pid) body.projectId = pid;
        else console.warn(`Warning: project "${flags.project}" not found`);
      }
      const ticket = await api("/tickets", { method: "POST", body: JSON.stringify(body) });
      console.log(`Created ticket #${ticket.id}: ${ticket.title}`);
    } else if (action === "update") {
      const id = rest[0];
      if (!id) { console.error("Usage: camelot-cli ticket update <id> [--status X] [--project X] [--title X]"); process.exit(1); }
      const body: any = {};
      if (flags.status) body.stage = flags.status;
      if (flags.title) body.title = flags.title;
      if (flags.project) {
        const pid = await resolveProjectId(flags.project);
        if (pid !== null) body.projectId = pid;
        else { console.error(`Project "${flags.project}" not found`); process.exit(1); }
      }
      if (flags.project === "") body.projectId = null;
      if (Object.keys(body).length === 0) { console.error("No updates specified"); process.exit(1); }
      const result = await api(`/tickets/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      console.log(`Updated ticket #${id}: ${JSON.stringify(result)}`);
    } else {
      console.error(`Unknown ticket action: ${action}`);
      process.exit(1);
    }
  } else if (resource === "activity") {
    if (action === "log") {
      const [ticketId, actAction] = rest;
      if (!ticketId || !actAction) { console.error("Usage: camelot-cli activity log <ticketId> <action>"); process.exit(1); }
      const body: any = { ticketId: Number(ticketId), sessionId: `cli-${process.pid}`, action: actAction };
      if (flags.metadata) body.metadata = flags.metadata;
      await api("/ticket-activity", { method: "POST", body: JSON.stringify(body) });
      console.log(`Logged activity: ${actAction} on ticket #${ticketId}`);
    } else {
      console.error(`Unknown activity action: ${action}`);
      process.exit(1);
    }
  } else if (resource === "standup") {
    const date = flags.date || new Date().toISOString().slice(0, 10);
    const summary = await api(`/daily-summary?date=${date}`);
    console.log(`📋 Standup for ${date}`);
    console.log(`Tickets: ${summary.tickets.created} created, ${summary.tickets.updated} updated, ${summary.tickets.completed} completed`);
    console.log(`Activities: ${summary.activities.total} total`);
    if (summary.effortBullets.length > 0) {
      console.log("\nEffort:");
      for (const b of summary.effortBullets) console.log(`  • ${b}`);
    }
  } else {
    console.error(`Unknown resource: ${resource}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
