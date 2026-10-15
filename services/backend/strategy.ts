import { api } from '../api';

// Backend enums, as numbers on the wire.
export const BackendAlignmentLevel = { None: 0, Low: 1, Medium: 2, High: 3 } as const;
export const BackendKnowledgeType = { Book: 0, Software: 1, Notes: 2, Other: 3, Pamphlet: 4 } as const;

export interface BackendStrategyNode {
  id: string;
  name: string;
  description: string | null;
  storedWeight: number;
  effectiveWeight: number;
  parentStrategyId: string | null;
  level: number;
  isLeaf: boolean;
  sortOrder: number;
}

export interface BackendStrategyTree {
  nodes: BackendStrategyNode[];
  totalWeight: number;
}

export interface BackendAlignmentScore {
  projectId: string;
  levels: { strategyId: string; level: number }[];
  percentage: number;
}

export interface BackendKnowledgeDocument {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  documentType: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAtUtc: string;
}

export const strategyApi = {
  tree: () => api.get<BackendStrategyTree>('/api/strategy/tree'),
  saveTree: (tenantId: string, items: { key: string; name: string; description: string | null; weight: number; parentKey: string | null }[]) =>
    api.put<BackendStrategyTree>('/api/strategy/tree', { tenantId, items })
};

const al = '/api/integrations/project-strategy-alignment';

export const alignmentApi = {
  scores: (projectIds: string[]) => api.post<BackendAlignmentScore[]>(`${al}/scores`, { projectIds }),
  setLevels: (tenantId: string, projectId: string, levels: { strategyId: string; level: number }[]) =>
    api.put<BackendAlignmentScore>(`${al}/levels`, { tenantId, projectId, levels })
};

export const knowledgeApi = {
  list: () => api.get<BackendKnowledgeDocument[]>('/api/knowledge/documents/'),
  upload: (file: File, title: string, description: string | null, documentType: number) => {
    const form = new FormData();
    form.append('file', file, file.name);
    const params = new URLSearchParams({ title, documentType: String(documentType) });
    if (description) params.set('description', description);
    return api.post<BackendKnowledgeDocument>(`/api/knowledge/documents/?${params.toString()}`, form);
  },
  remove: (id: string) => api.delete<void>(`/api/knowledge/documents/${id}`),
  download: (id: string, fileName: string) => api.download(`/api/knowledge/documents/${id}/download`, fileName)
};
