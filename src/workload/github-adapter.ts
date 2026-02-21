import { execSync } from "node:child_process";
import type { WorkloadAdapter, WorkloadTicket } from "./types.js";

interface GitHubIssue {
  readonly number: number;
  readonly title: string;
  readonly body?: string;
  readonly state: string;
  readonly assignees?: Array<{ readonly login: string }>;
  readonly labels?: Array<{ readonly name: string }>;
  readonly url: string;
}

export interface GitHubAdapterDeps {
  readonly exec?: (command: string) => string;
}

export class GitHubWorkloadAdapter implements WorkloadAdapter {
  private readonly exec: (command: string) => string;

  constructor(
    private readonly owner: string,
    private readonly repo: string,
    private readonly projectNumber?: number,
    deps: GitHubAdapterDeps = {}
  ) {
    this.exec = deps.exec ?? ((command: string) => execSync(command, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }));
  }

  async getBacklog(): Promise<WorkloadTicket[]> {
    const issues = this.listIssues('label:backlog');
    return issues.map((issue) => this.mapIssue(issue));
  }

  async getInProgress(): Promise<WorkloadTicket[]> {
    const issues = this.listIssues('label:"in-progress"');
    return issues.map((issue) => this.mapIssue(issue));
  }

  async getTicket(id: string): Promise<WorkloadTicket | undefined> {
    const issue = this.viewIssue(id);
    if (!issue) {
      return undefined;
    }

    return this.mapIssue(issue);
  }

  async getMyWork(): Promise<WorkloadTicket[]> {
    const issues = this.listIssues("", "@me");
    return issues.map((issue) => this.mapIssue(issue));
  }

  async updateStatus(id: string, status: string): Promise<boolean> {
    try {
      this.exec(`gh issue edit ${id} --repo ${this.owner}/${this.repo} --add-label ${JSON.stringify(status)}`);
      return true;
    } catch {
      return false;
    }
  }

  private listIssues(search = "", assignee?: string): GitHubIssue[] {
    const filters: string[] = [];
    const searchTerms: string[] = [];

    if (search) {
      searchTerms.push(search);
    }

    if (assignee) {
      filters.push(`--assignee ${assignee}`);
    }

    if (this.projectNumber !== undefined) {
      searchTerms.push(`project:${this.projectNumber}`);
    }

    if (searchTerms.length > 0) {
      filters.push(`--search ${JSON.stringify(searchTerms.join(" "))}`);
    }

    const command = [
      `gh issue list`,
      `--repo ${this.owner}/${this.repo}`,
      `--state open`,
      `--limit 100`,
      `--json number,title,body,state,assignees,labels,url`,
      ...filters,
    ].join(" ");

    const output = this.exec(command);
    return JSON.parse(output) as GitHubIssue[];
  }

  private viewIssue(id: string): GitHubIssue | undefined {
    try {
      const output = this.exec(
        `gh issue view ${id} --repo ${this.owner}/${this.repo} --json number,title,body,state,assignees,labels,url`
      );
      return JSON.parse(output) as GitHubIssue;
    } catch {
      return undefined;
    }
  }

  private mapIssue(issue: GitHubIssue): WorkloadTicket {
    const labels = (issue.labels ?? []).map((label) => label.name);
    const normalizedLabels = labels.map((label) => label.toLowerCase());

    let status = issue.state.toLowerCase();
    if (normalizedLabels.includes("backlog")) {
      status = "backlog";
    }
    if (normalizedLabels.includes("in-progress")) {
      status = "in-progress";
    }

    return {
      id: String(issue.number),
      title: issue.title,
      description: issue.body ?? "",
      status,
      assignee: issue.assignees?.[0]?.login ?? null,
      labels,
      url: issue.url,
      source: "github",
    };
  }
}
