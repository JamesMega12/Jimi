export interface ActiveRegistryHistoryItem {
  packId: string;
  source: "bundled_default" | "configured";
  activatedAt: string;
}

export interface ActiveRegistryScope {
  activePackId: string;
  source: "bundled_default" | "configured";
  history: ActiveRegistryHistoryItem[];
}

export interface ActiveRegistry {
  summary: ActiveRegistryScope;
  procedure: ActiveRegistryScope;
}

export interface InstructionPackDraft {
  id: string;
  basePackId: string;
  name: string;
  scope: "summary" | "procedure";
  version: string;
  status: "draft";
  content: string;
  description?: string;
  changelog?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstructionPack {
  id: string;
  name: string;
  scope: "summary" | "procedure";
  version: string;
  status: "active" | "bundled_default" | "archived";
  content: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  isSystemDefault?: boolean;
  locked?: boolean;
}

export interface InstructionTrace {
  summaryPack?: {
    id: string;
    version: string;
    source: "bundled_default" | "configured" | "draft";
  };
  procedurePack?: {
    id: string;
    version: string;
    source: "bundled_default" | "configured" | "draft";
  };
}
