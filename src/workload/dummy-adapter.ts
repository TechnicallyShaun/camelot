import type { WorkloadAdapter, WorkloadTicket } from "./types.js";

const DUMMY_TICKETS: WorkloadTicket[] = [
  {
    id: "DEMO-1",
    title: "User authentication flow",
    description: "Implement login/logout with session management.\n\n## Acceptance Criteria\nGiven a registered user\nWhen they enter valid credentials\nThen they are redirected to the dashboard\n\nGiven a logged-in user\nWhen they click logout\nThen their session is destroyed",
    status: "in_progress",
    assignee: "alice",
    labels: ["feature", "auth", "priority:high"],
    url: "https://example.com/tickets/DEMO-1",
    source: "dummy",
  },
  {
    id: "DEMO-2",
    title: "Dashboard performance optimisation",
    description: "The dashboard loads slowly with >1000 records. Investigate and fix.\n\nPossibly need database indexing or pagination.",
    status: "backlog",
    assignee: null,
    labels: ["bug", "performance"],
    url: "https://example.com/tickets/DEMO-2",
    source: "dummy",
  },
  {
    id: "DEMO-3",
    title: "Add export to CSV",
    description: "Users should be able to export their data as CSV.\n\n## Acceptance Criteria\n- Export button visible on data table\n- CSV includes all visible columns\n- Filename includes current date",
    status: "backlog",
    assignee: "bob",
    labels: ["feature", "data"],
    url: "https://example.com/tickets/DEMO-3",
    source: "dummy",
  },
  {
    id: "DEMO-4",
    title: "Fix email notification templates",
    description: "Email notifications are using the old branding. Update templates to match new design system.\n\nTBD: which templates need updating?",
    status: "in_progress",
    assignee: "alice",
    labels: ["bug", "design"],
    url: "https://example.com/tickets/DEMO-4",
    source: "dummy",
  },
  {
    id: "DEMO-5",
    title: "API rate limiting",
    description: "Implement rate limiting on public API endpoints to prevent abuse.\n\nRequires: Redis for distributed rate counting.\nDepends on: infrastructure team provisioning Redis.\n\n## Acceptance Criteria\nGiven an API consumer\nWhen they exceed 100 requests per minute\nThen they receive a 429 response with retry-after header",
    status: "backlog",
    assignee: null,
    labels: ["feature", "security", "api"],
    url: "https://example.com/tickets/DEMO-5",
    source: "dummy",
  },
];

export class DummyWorkloadAdapter implements WorkloadAdapter {
  private tickets: WorkloadTicket[] = [...DUMMY_TICKETS];

  async getBacklog(): Promise<WorkloadTicket[]> {
    return this.tickets.filter(t => t.status === "backlog");
  }

  async getInProgress(): Promise<WorkloadTicket[]> {
    return this.tickets.filter(t => t.status === "in_progress");
  }

  async getTicket(id: string): Promise<WorkloadTicket | undefined> {
    return this.tickets.find(t => t.id === id);
  }

  async getMyWork(): Promise<WorkloadTicket[]> {
    return this.tickets.filter(t => t.assignee !== null);
  }

  async updateStatus(id: string, status: string): Promise<boolean> {
    const ticket = this.tickets.find(t => t.id === id);
    if (!ticket) return false;
    // Create a new ticket with updated status (immutable-style)
    this.tickets = this.tickets.map(t =>
      t.id === id ? { ...t, status } : t
    );
    return true;
  }
}
