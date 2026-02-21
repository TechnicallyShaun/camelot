import type { WorkloadAdapter } from "./types.js";

export class WorkloadAdapterRegistry {
  private readonly adapters = new Map<string, WorkloadAdapter>();
  private activeAdapterName: string | null = null;

  register(name: string, adapter: WorkloadAdapter, isActive = false): void {
    this.adapters.set(name, adapter);

    if (isActive || this.activeAdapterName === null) {
      this.activeAdapterName = name;
    }
  }

  list(): { name: string; isActive: boolean }[] {
    return Array.from(this.adapters.keys())
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ name, isActive: this.activeAdapterName === name }));
  }

  get(name: string): WorkloadAdapter | undefined {
    return this.adapters.get(name);
  }

  getActiveName(): string | null {
    return this.activeAdapterName;
  }

  getActiveAdapter(): WorkloadAdapter | undefined {
    if (!this.activeAdapterName) {
      return undefined;
    }

    return this.adapters.get(this.activeAdapterName);
  }

  setActive(name: string): boolean {
    if (!this.adapters.has(name)) {
      return false;
    }

    this.activeAdapterName = name;
    return true;
  }
}
