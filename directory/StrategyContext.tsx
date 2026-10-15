import * as React from 'react';
import type { AlignmentLevel, KnowledgeDocument, KnowledgeDocumentType, ProjectStrategyAlignment, Strategy } from '../types';
import { useAuth } from './AuthContext';
import { useProjects } from './ProjectsContext';
import type { ProjectOutcome } from './ProjectsContext';
import { alignmentApi, BackendAlignmentLevel, BackendKnowledgeType, knowledgeApi, strategyApi } from '../services/backend/strategy';
import type { BackendAlignmentScore, BackendKnowledgeDocument, BackendStrategyNode } from '../services/backend/strategy';

export interface StrategyState {
  loading: boolean;
  /** The strategy tree as a flat list (a parent before its children); a strategy with sub-strategies carries the weight they add up to. */
  strategies: Strategy[];
  /** The levels the backend holds for each project and leaf strategy (None is not listed). */
  alignments: ProjectStrategyAlignment[];
  /** How well each project fits the strategies, in percent - the backend's figure. */
  alignmentPercentages: Map<string, number>;
  knowledgeDocuments: KnowledgeDocument[];
  reload: () => Promise<void>;
  /** Saves the whole tree (create / update / delete); the backend checks that the top-level weights add up to 100. */
  saveStrategies: (strategies: Strategy[]) => Promise<ProjectOutcome>;
  /** Saves the levels of the given projects (every leaf strategy of each). */
  saveAlignments: (alignments: ProjectStrategyAlignment[], projectIds: string[]) => Promise<ProjectOutcome>;
  uploadKnowledge: (file: File, description: string, type: KnowledgeDocumentType) => Promise<ProjectOutcome>;
  deleteKnowledge: (id: string) => Promise<ProjectOutcome>;
  downloadKnowledge: (document: KnowledgeDocument) => Promise<ProjectOutcome>;
}

const StrategyContext = React.createContext<StrategyState>(null as unknown as StrategyState);

const fail = (message?: string, code?: string): ProjectOutcome => ({ ok: false, message, code });

const LEVEL_NAME: Record<number, AlignmentLevel> = {
  [BackendAlignmentLevel.None]: 'None',
  [BackendAlignmentLevel.Low]: 'Low',
  [BackendAlignmentLevel.Medium]: 'Medium',
  [BackendAlignmentLevel.High]: 'High'
};

const KNOWLEDGE_TYPE_NAME: Record<number, KnowledgeDocumentType> = {
  [BackendKnowledgeType.Book]: 'Book',
  [BackendKnowledgeType.Pamphlet]: 'Pamphlet',
  [BackendKnowledgeType.Software]: 'Software',
  [BackendKnowledgeType.Notes]: 'Other',
  [BackendKnowledgeType.Other]: 'Other'
};

const toUiStrategy = (n: BackendStrategyNode): Strategy => ({
  id: n.id, name: n.name, description: n.description ?? '', weight: n.effectiveWeight, parentId: n.parentStrategyId
});

const toUiKnowledge = (d: BackendKnowledgeDocument): KnowledgeDocument => ({
  id: d.id, name: d.fileName, description: d.description ?? d.title, type: KNOWLEDGE_TYPE_NAME[d.documentType] ?? 'Other'
});

/** Strategies, the project-strategy alignment and the knowledge library as the backend holds them. */
export const StrategyProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const projects = useProjects().projects;
  const tenantId = session?.user.tenantId;

  const [loading, setLoading] = React.useState(false);
  const [strategies, setStrategies] = React.useState<Strategy[]>([]);
  const [scores, setScores] = React.useState<BackendAlignmentScore[]>([]);
  const [knowledgeDocuments, setKnowledge] = React.useState<KnowledgeDocument[]>([]);
  const projectIds = React.useMemo(() => projects.map(p => p.id), [projects]);
  const projectKey = projectIds.join(',');

  const loadStrategies = React.useCallback(async () => {
    const tree = await strategyApi.tree();
    if (tree.ok && tree.value) setStrategies(tree.value.nodes.map(toUiStrategy));
  }, []);

  const loadScores = React.useCallback(async () => {
    if (!projectIds.length) return setScores([]);
    const result = await alignmentApi.scores(projectIds);
    if (result.ok) setScores(result.value ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey]);

  const loadKnowledge = React.useCallback(async () => {
    const list = await knowledgeApi.list();
    if (list.ok) setKnowledge((list.value ?? []).map(toUiKnowledge));
  }, []);

  const reload = React.useCallback(async () => {
    if (!session) return;
    setLoading(true);
    await Promise.all([loadStrategies(), loadScores(), loadKnowledge()]);
    setLoading(false);
  }, [session, loadStrategies, loadScores, loadKnowledge]);

  React.useEffect(() => {
    if (!session) {
      setStrategies([]);
      setScores([]);
      setKnowledge([]);
    } else {
      void reload();
    }
  }, [session, reload]);

  const alignments = React.useMemo<ProjectStrategyAlignment[]>(
    () => scores.flatMap(s => s.levels
      .filter(l => l.level !== BackendAlignmentLevel.None)
      .map(l => ({ projectId: s.projectId, strategyId: l.strategyId, level: LEVEL_NAME[l.level] ?? 'None' }))),
    [scores]);
  const alignmentPercentages = React.useMemo(() => new Map(scores.map(s => [s.projectId, s.percentage] as const)), [scores]);

  const value = React.useMemo<StrategyState>(() => ({
    loading,
    strategies,
    alignments,
    alignmentPercentages,
    knowledgeDocuments,
    reload,

    saveStrategies: async list => {
      const saved = await strategyApi.saveTree(tenantId ?? '', list.map(s => ({
        key: s.id, name: s.name, description: s.description?.trim() || null, weight: Number(s.weight) || 0, parentKey: s.parentId
      })));
      if (!saved.ok) return fail(saved.error?.message, saved.error?.code);
      await Promise.all([loadStrategies(), loadScores()]);
      return { ok: true };
    },

    saveAlignments: async (list, ids) => {
      for (const projectId of ids) {
        const mine = list.filter(a => a.projectId === projectId);
        // Alignment is set on leaf strategies only; one the project is not listed for is None.
        const leaves = strategies.filter(s => !strategies.some(x => x.parentId === s.id)).map(s => s.id);
        const levels = leaves.map(strategyId => ({
          strategyId,
          level: BackendAlignmentLevel[(mine.find(a => a.strategyId === strategyId)?.level ?? 'None')]
        }));
        const saved = await alignmentApi.setLevels(tenantId ?? '', projectId, levels);
        if (!saved.ok) return fail(saved.error?.message, saved.error?.code);
      }
      await loadScores();
      return { ok: true };
    },

    uploadKnowledge: async (file, description, type) => {
      const typeCode = type === 'Pamphlet' ? BackendKnowledgeType.Pamphlet : BackendKnowledgeType[type];
      const uploaded = await knowledgeApi.upload(file, file.name, description, typeCode);
      if (!uploaded.ok) return fail(uploaded.error?.message, uploaded.error?.code);
      await loadKnowledge();
      return { ok: true };
    },

    deleteKnowledge: async id => {
      const removed = await knowledgeApi.remove(id);
      if (!removed.ok) return fail(removed.error?.message, removed.error?.code);
      await loadKnowledge();
      return { ok: true };
    },

    downloadKnowledge: async document => {
      const downloaded = await knowledgeApi.download(document.id, document.name);
      return downloaded.ok ? { ok: true } : fail(downloaded.error?.message, downloaded.error?.code);
    }
  }), [loading, strategies, alignments, alignmentPercentages, knowledgeDocuments, reload, tenantId, loadStrategies, loadScores, loadKnowledge]);

  return React.createElement(StrategyContext.Provider, { value }, children);
};

export const useStrategy = () => React.useContext(StrategyContext);
