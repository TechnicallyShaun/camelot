export interface WorkloadTicket {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: string;
  readonly assignee: string | null;
  readonly labels: string[];
  readonly url: string;
  readonly source: string;
}

export interface WorkloadAdapter {
  getBacklog(): Promise<WorkloadTicket[]>;
  getInProgress(): Promise<WorkloadTicket[]>;
  getTicket(id: string): Promise<WorkloadTicket | undefined>;
  getMyWork(): Promise<WorkloadTicket[]>;
  updateStatus(id: string, status: string): Promise<boolean>;
}
