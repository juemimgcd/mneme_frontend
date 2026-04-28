<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { gsap } from 'gsap';
import { useRoute, useRouter } from 'vue-router';
import EmptyState from '@/components/common/EmptyState.vue';
import { api } from '@/lib/api';
import { mergeQuery, readQueryBoolean, readQueryFloat, readQueryNumber, readQueryString } from '@/lib/route-query';
import { useSessionStore } from '@/stores/session';
import { useWorkspaceStore } from '@/stores/workspace';
import type {
  GraphEdge,
  GraphNode,
  GraphProjectionRebuildResult,
  GraphQueryOptions,
  GraphResult,
} from '@/lib/types';

type GraphScope = 'knowledge_base' | 'user' | 'document';
type GraphLayoutMode = 'tree' | 'constellation';
type GraphFilter = 'all' | 'documents';

interface PositionedNode extends GraphNode, SimulationNodeDatum {
  x: number;
  y: number;
  radius: number;
  width: number;
  height: number;
  degree: number;
}

interface PositionedEdge extends GraphEdge {
  sourceNode: PositionedNode;
  targetNode: PositionedNode;
  path: string;
}

interface GraphBand {
  id: string;
  label: string;
  nodeType: GraphNode['node_type'];
  y: number;
  height: number;
}

interface GraphCluster {
  id: string;
  label: string;
  nodeType: GraphNode['node_type'];
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ForceEdge extends SimulationLinkDatum<PositionedNode> {
  id: string;
  source: string | PositionedNode;
  target: string | PositionedNode;
  edge_type: GraphEdge['edge_type'];
  metadata: GraphEdge['metadata'];
}

interface GraphLayout {
  width: number;
  height: number;
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  treeEdges: PositionedEdge[];
  relatedEdges: PositionedEdge[];
  bands: GraphBand[];
  clusters: GraphCluster[];
}

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const workspace = useWorkspaceStore();

const searchRailRef = ref<HTMLDivElement | null>(null);
const stageRef = ref<HTMLDivElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const graph = ref<GraphResult | null>(null);
const loading = ref(false);
const rebuildLoading = ref(false);
const error = ref('');
const rebuildMessage = ref('');
const lastRebuild = ref<GraphProjectionRebuildResult | null>(null);
const selectedNodeId = ref('');
const scope = ref<GraphScope>('knowledge_base');
const includeRelationships = ref(true);
const minSharedMemoryCount = ref(2);
const minRelationshipScore = ref(0.35);
const maxRelatedEdges = ref(80);
const graphDocumentId = ref('');
const focusMode = ref(true);
const layoutMode = ref<GraphLayoutMode>('tree');
const graphFilter = ref<GraphFilter>('all');
const searchQuery = ref('');
const viewportTween = ref<gsap.core.Tween | null>(null);
const hoveredNodeId = ref('');
const graphSimulation = shallowRef<Simulation<PositionedNode, ForceEdge> | null>(null);
const searchDropdownOpen = ref(false);
const viewport = reactive({
  scale: 1,
  x: 0,
  y: 0,
  panning: false,
  lastClientX: 0,
  lastClientY: 0,
});
const nodeDrag = reactive({
  id: '',
  pointerId: 0,
  startClientX: 0,
  startClientY: 0,
  moved: false,
});
const suppressNodeClick = ref(false);
const selectionHistory = ref<string[]>([]);
const historyCursor = ref(-1);
const suppressSelectionHistory = ref(false);

const selectedNode = computed(() =>
  visibleGraph.value?.nodes.find((node) => node.id === selectedNodeId.value) ?? null,
);

const currentDocumentId = computed(() => {
  if (graphDocumentId.value && workspace.filteredDocuments.some((item) => item.id === graphDocumentId.value)) {
    return graphDocumentId.value;
  }
  return workspace.selectedDocumentId || workspace.filteredDocuments[0]?.id || '';
});

const graphRebuildTargetKnowledgeBaseId = computed(() => {
  if (scope.value === 'user') {
    return '';
  }

  if (scope.value === 'document') {
    const targetDocument = workspace.documents.find((item) => item.id === currentDocumentId.value);
    return targetDocument?.knowledge_base_id ?? workspace.activeKnowledgeBaseId;
  }

  return workspace.activeKnowledgeBaseId;
});

const graphOptions = computed<GraphQueryOptions>(() => ({
  includeMemory: false,
  includeRelationships: includeRelationships.value,
  minSharedMemoryCount: minSharedMemoryCount.value,
  minRelationshipScore: minRelationshipScore.value,
  maxRelatedEdges: maxRelatedEdges.value,
  relationshipScope: scope.value === 'document' ? 'knowledge_base' : undefined,
}));

const visibleGraph = computed<GraphResult | null>(() => {
  const payload = graph.value;
  if (!payload) {
    return payload;
  }

  let nodes = payload.nodes.filter((node) => node.node_type !== 'memory_entry');
  if (graphFilter.value === 'documents') {
    nodes = nodes.filter((node) => node.node_type === 'document' || node.id === payload.root_node_id);
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = payload.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  const nodeTypeCounts = nodes.reduce<Record<string, number>>((acc, node) => {
    acc[node.node_type] = (acc[node.node_type] ?? 0) + 1;
    return acc;
  }, {});
  const edgeTypeCounts = edges.reduce<Record<string, number>>((acc, edge) => {
    acc[edge.edge_type] = (acc[edge.edge_type] ?? 0) + 1;
    return acc;
  }, {});

  return {
    ...payload,
    nodes,
    edges,
    node_count: nodes.length,
    edge_count: edges.length,
    node_type_counts: nodeTypeCounts,
    edge_type_counts: edgeTypeCounts,
  };
});

const graphStats = computed(() => {
  const payload = visibleGraph.value;
  return [
    { label: 'Nodes', value: payload?.node_count ?? 0 },
    { label: 'Edges', value: payload?.edge_count ?? 0 },
    { label: 'Docs', value: payload?.node_type_counts.document ?? 0 },
    { label: 'Collections', value: payload?.node_type_counts.knowledge_base ?? 0 },
  ];
});

const graphScopeLabel = computed(() => {
  if (scope.value === 'user') {
    return 'Workspace canvas';
  }
  if (scope.value === 'document') {
    return 'Document canvas';
  }
  return workspace.currentKnowledgeBase?.name ?? 'Knowledge canvas';
});

const graphSubtitle = computed(() => {
  const scopeCopy = scope.value.replace('_', ' ');
  const relationCopy = includeRelationships.value ? `${relatedEdgeCount.value} related signals` : 'relations hidden';
  return `${scopeCopy} · ${relationCopy} · arranged as notes`;
});

const graphViewModes = computed(() => [
  {
    key: 'explore',
    label: 'Explore',
    active: !focusMode.value,
    action: () => {
      focusMode.value = false;
    },
  },
  {
    key: 'focus',
    label: 'Focus',
    active: focusMode.value,
    action: () => {
      focusMode.value = true;
      if (!selectedNodeId.value && layout.value.nodes[0]?.id) {
        setSelectedNode(layout.value.nodes[0].id, { history: 'replace' });
      }
    },
  },
  {
    key: 'relations',
    label: 'Relations',
    active: includeRelationships.value,
    action: () => {
      includeRelationships.value = !includeRelationships.value;
    },
  },
]);

const nodeCategoryFilters = computed(() => [
  {
    key: 'documents' as const,
    label: 'Docs',
    color: nodeColor('document'),
    active: graphFilter.value === 'documents',
  },
  {
    key: 'knowledge' as const,
    label: 'Collections',
    color: nodeColor('knowledge_base'),
    active: graphFilter.value === 'all',
  },
]);

const relatedEdgeCount = computed(() => visibleGraph.value?.edge_type_counts.related ?? 0);
const generatedAt = computed(() =>
  graph.value?.generated_at
    ? new Date(graph.value.generated_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '--',
);
const graphTransform = computed(
  () => `matrix(${viewport.scale} 0 0 ${viewport.scale} ${viewport.x} ${viewport.y})`,
);
const currentWorkspaceDocumentNodeId = computed(() =>
  workspace.selectedDocumentId ? `document:${workspace.selectedDocumentId}` : '',
);
const activeHighlightNodeId = computed(() => hoveredNodeId.value || selectedNodeId.value);
const highlightedNodeIds = computed(() => {
  const nodeId = activeHighlightNodeId.value;
  const payload = visibleGraph.value;
  const highlighted = new Set<string>();
  if (!payload || !nodeId) {
    return highlighted;
  }

  highlighted.add(nodeId);
  for (const edge of payload.edges) {
    if (edge.source === nodeId) {
      highlighted.add(edge.target);
    }
    if (edge.target === nodeId) {
      highlighted.add(edge.source);
    }
  }

  return highlighted;
});
const highlightedEdgeIds = computed(() => {
  const nodeId = activeHighlightNodeId.value;
  const payload = visibleGraph.value;
  const highlighted = new Set<string>();
  if (!payload || !nodeId) {
    return highlighted;
  }

  for (const edge of payload.edges) {
    if (edge.source === nodeId || edge.target === nodeId) {
      highlighted.add(edge.id);
    }
  }

  return highlighted;
});
const selectionActionLabel = computed(() => {
  if (!selectedNode.value) {
    return '';
  }

  if (selectedNode.value.node_type === 'knowledge_base') {
    return 'Open Collection';
  }

  if (selectedNode.value.node_type === 'document') {
    return 'Open Document';
  }

  return '';
});
const selectedAnchorDocumentId = computed(() => {
  if (!selectedNode.value) {
    return '';
  }

  if (selectedNode.value.node_type === 'document') {
    return selectedNode.value.id;
  }

  return '';
});
const selectedRelatedConnections = computed(() => {
  const payload = visibleGraph.value;
  const anchorDocumentId = selectedAnchorDocumentId.value;
  if (!payload || !anchorDocumentId) {
    return [];
  }

  return payload.edges
    .filter((edge) => edge.edge_type === 'related' && (edge.source === anchorDocumentId || edge.target === anchorDocumentId))
    .map((edge) => {
      const counterpartId = edge.source === anchorDocumentId ? edge.target : edge.source;
      const counterpart = payload.nodes.find((node) => node.id === counterpartId);
      const sharedMemories = Array.isArray(edge.metadata.shared_memories)
        ? edge.metadata.shared_memories
            .map((item) => (typeof item === 'object' && item ? item as Record<string, unknown> : null))
            .filter((item): item is Record<string, unknown> => Boolean(item))
        : [];

      return {
        edge,
        counterpartId,
        counterpartLabel: counterpart?.label ?? counterpartId.replace('document:', ''),
        counterpartDescription: counterpart ? nodeDescription(counterpart) : 'document',
        relationshipScore:
          typeof edge.metadata.relationship_score === 'number' ? edge.metadata.relationship_score : null,
        sharedMemoryCount:
          typeof edge.metadata.shared_memory_count === 'number' ? edge.metadata.shared_memory_count : 0,
        sharedMemoryTypes: Array.isArray(edge.metadata.shared_memory_types)
          ? edge.metadata.shared_memory_types.map((item) => String(item))
          : [],
        sharedMemories: sharedMemories.slice(0, 3).map((item) => ({
          entryName: typeof item.entry_name === 'string' ? item.entry_name : 'memory',
          entryType: typeof item.entry_type === 'string' ? item.entry_type : 'entry',
        })),
      };
    })
    .sort((a, b) => {
      const scoreA = a.relationshipScore ?? 0;
      const scoreB = b.relationshipScore ?? 0;
      return scoreB - scoreA || b.sharedMemoryCount - a.sharedMemoryCount || a.counterpartLabel.localeCompare(b.counterpartLabel);
    });
});
const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLowerCase());
const searchResults = computed(() => {
  const payload = visibleGraph.value;
  const query = normalizedSearchQuery.value;
  if (!payload || !query) {
    return [];
  }

  const ranked = payload.nodes
    .map((node) => {
      const haystack = [
        node.label,
        node.node_type,
        metadataText(node.metadata.file_type),
        metadataText(node.metadata.status),
        metadataText(node.metadata.document_count),
      ]
        .join(' ')
        .toLowerCase();

      const exactLabel = node.label.toLowerCase() === query ? 3 : 0;
      const startsWith = node.label.toLowerCase().startsWith(query) ? 2 : 0;
      const includes = haystack.includes(query) ? 1 : 0;
      return { node, score: exactLabel + startsWith + includes };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.node.depth - b.node.depth || a.node.label.localeCompare(b.node.label));

  return ranked.slice(0, 10).map((item) => item.node);
});
const searchMatchIds = computed(() => new Set(searchResults.value.map((node) => node.id)));
const historyTrail = computed(() => {
  const payload = visibleGraph.value ?? graph.value;
  if (!payload || historyCursor.value < 0) {
    return [];
  }

  const cursorSlice = selectionHistory.value.slice(0, historyCursor.value + 1);
  const recent = cursorSlice.slice(-4);
  return recent
    .map((nodeId) => payload.nodes.find((node) => node.id === nodeId) ?? graph.value?.nodes.find((node) => node.id === nodeId) ?? null)
    .filter((node): node is GraphNode => Boolean(node));
});
const showSearchDropdown = computed(
  () => searchDropdownOpen.value && normalizedSearchQuery.value.length > 0 && searchResults.value.length > 0,
);
const hoveredNode = computed(() => {
  if (!hoveredNodeId.value) {
    return null;
  }
  return layout.value.nodes.find((node) => node.id === hoveredNodeId.value) ?? null;
});
const hoveredNodeTooltip = computed(() => {
  if (!hoveredNode.value) {
    return null;
  }

  const node = hoveredNode.value;
  const x = node.x * viewport.scale + viewport.x + node.radius + 22;
  const y = node.y * viewport.scale + viewport.y - 22;

  return {
    node,
    x,
    y,
    title: node.label,
    subtitle: nodeDescription(node),
    detail:
      node.node_type === 'document'
        ? metadataText(node.metadata.status)
        : node.node_type === 'knowledge_base'
          ? `${metadataText(node.metadata.document_count)} docs`
          : 'workspace root',
  };
});

function edgeLabel(edge: GraphEdge) {
  if (edge.edge_type !== 'related') {
    return edge.edge_type;
  }

  const score = edge.metadata.relationship_score;
  const sharedCount = edge.metadata.shared_memory_count;
  if (typeof score === 'number' && typeof sharedCount === 'number') {
    return `${sharedCount} signals · ${Math.round(score * 100)}%`;
  }
  if (typeof score === 'number') {
    return `${Math.round(score * 100)}%`;
  }
  return 'related';
}

function relationshipPercent(value: number | null) {
  return value == null ? '--' : `${Math.round(value * 100)}%`;
}

function relationshipStrength(value: number | null) {
  if (value == null) {
    return 0.35;
  }
  return Math.min(Math.max(value, 0), 1);
}

function relationCardStyle(score: number | null) {
  const strength = relationshipStrength(score);
  return {
    '--relation-border': `rgba(47, 73, 104, ${0.12 + strength * 0.16})`,
    '--relation-bg': `linear-gradient(135deg, rgba(255, 252, 246, ${0.55 + strength * 0.18}), rgba(109, 135, 155, ${0.04 + strength * 0.06}) 82%), var(--ua-elevated)`,
  };
}

function isCurrentWorkspaceDocument(nodeId: string) {
  return currentWorkspaceDocumentNodeId.value ? nodeId === currentWorkspaceDocumentNodeId.value : false;
}

function nodeDescription(node: GraphNode) {
  if (node.node_type === 'document') {
    const status = typeof node.metadata.status === 'string' ? node.metadata.status : 'document';
    const fileType = typeof node.metadata.file_type === 'string' ? node.metadata.file_type.toUpperCase() : 'FILE';
    return `${fileType} · ${status}`;
  }

  if (node.node_type === 'knowledge_base') {
    const documentCount = typeof node.metadata.document_count === 'number' ? node.metadata.document_count : 0;
    return `${documentCount} docs`;
  }

  if (node.node_type === 'user') {
    return 'workspace root';
  }

  return 'node';
}

function metadataText(value: unknown): string {
  if (value == null || value === '') {
    return '--';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(metadataText).join(', ');
  }
  return JSON.stringify(value);
}

function truncateLabel(value: string, maxLength = 30) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function setSelectedNode(
  nodeId: string,
  options: { history?: 'push' | 'replace' | 'ignore' } = {},
) {
  if (!nodeId) {
    selectedNodeId.value = '';
    return;
  }

  const historyMode = options.history ?? 'push';
  if (historyMode === 'ignore') {
    suppressSelectionHistory.value = true;
  }

  selectedNodeId.value = nodeId;

  if (historyMode === 'ignore') {
    return;
  }

  if (historyMode === 'replace') {
    selectionHistory.value = [nodeId];
    historyCursor.value = 0;
    return;
  }

  const nextHistory = selectionHistory.value.slice(0, historyCursor.value + 1);
  if (nextHistory[nextHistory.length - 1] === nodeId) {
    historyCursor.value = nextHistory.length - 1;
    selectionHistory.value = nextHistory;
    return;
  }

  nextHistory.push(nodeId);
  selectionHistory.value = nextHistory.slice(-12);
  historyCursor.value = selectionHistory.value.length - 1;
}

function navigateHistory(step: number) {
  const nextCursor = historyCursor.value + step;
  if (nextCursor < 0 || nextCursor >= selectionHistory.value.length) {
    return;
  }
  historyCursor.value = nextCursor;
  setSelectedNode(selectionHistory.value[nextCursor], { history: 'ignore' });
}

function jumpToHistory(nodeId: string) {
  const nextCursor = selectionHistory.value.findIndex((item) => item === nodeId);
  if (nextCursor === -1) {
    return;
  }
  historyCursor.value = nextCursor;
  setSelectedNode(nodeId, { history: 'ignore' });
}

function openSearchDropdown() {
  if (!normalizedSearchQuery.value) {
    return;
  }
  searchDropdownOpen.value = true;
}

function closeSearchDropdown() {
  searchDropdownOpen.value = false;
}

function handleGlobalPointerDown(event: PointerEvent) {
  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }
  if (searchRailRef.value?.contains(target)) {
    return;
  }
  closeSearchDropdown();
}

function nodeTypeLabel(nodeType: GraphNode['node_type']) {
  return nodeType.replace('_', ' ');
}

function nodeSummary(node: GraphNode) {
  const summary = node.metadata.summary;
  if (typeof summary === 'string' && summary.trim()) {
    return summary.trim();
  }
  return nodeDescription(node);
}

function clampScale(value: number) {
  return Math.min(Math.max(value, 0.72), 2.4);
}

function stopViewportAnimation() {
  viewportTween.value?.kill();
  viewportTween.value = null;
}

function createEmptyLayout(): GraphLayout {
  return {
    width: 1240,
    height: 680,
    nodes: [],
    edges: [],
    treeEdges: [],
    relatedEdges: [],
    bands: [],
    clusters: [],
  };
}

function createDegreeMap(payload: GraphResult) {
  const degreeMap = new Map<string, number>();
  for (const node of payload.nodes) {
    degreeMap.set(node.id, 0);
  }
  for (const edge of payload.edges) {
    degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1);
    degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1);
  }
  return degreeMap;
}

function nodeRadius(node: GraphNode, degree: number) {
  const baseMap = {
    user: 18,
    knowledge_base: 19,
    document: 13,
    memory_entry: 9,
  } satisfies Record<GraphNode['node_type'], number>;

  return Math.min(baseMap[node.node_type] + Math.sqrt(Math.max(degree, 0)) * 3.2, 34);
}

function nodeColor(nodeType: GraphNode['node_type']) {
  const palette = {
    user: '#83798d',
    knowledge_base: '#2f4968',
    document: '#6d879b',
    memory_entry: '#687d72',
  } satisfies Record<GraphNode['node_type'], string>;

  return palette[nodeType];
}

function nodeStyle(node: PositionedNode) {
  const color = nodeColor(node.node_type);
  return {
    '--node-color': color,
    '--node-glow': `${color}44`,
  };
}

function createPositionedNode(node: GraphNode, x: number, y: number, degree = 0): PositionedNode {
  const radius = nodeRadius(node, degree);
  const metricsMap = {
    user: { width: 160, height: 46 },
    knowledge_base: { width: 176, height: 48 },
    document: { width: 170, height: 48 },
    memory_entry: { width: 148, height: 40 },
  } satisfies Record<GraphNode['node_type'], { width: number; height: number }>;

  const metrics = metricsMap[node.node_type];

  return {
    ...node,
    x,
    y,
    radius,
    width: metrics.width,
    height: metrics.height,
    degree,
  };
}

function buildEdgeCurve(sourceNode: PositionedNode, targetNode: PositionedNode) {
  const deltaX = targetNode.x - sourceNode.x;
  const deltaY = targetNode.y - sourceNode.y;

  if (Math.abs(deltaY) >= Math.abs(deltaX) * 0.65) {
    const direction = deltaY >= 0 ? 1 : -1;
    const sourceX = sourceNode.x;
    const targetX = targetNode.x;
    const sourceY = sourceNode.y + direction * (sourceNode.height / 2);
    const targetY = targetNode.y - direction * (targetNode.height / 2);
    const curveOffset = Math.min(Math.max(Math.abs(targetY - sourceY) * 0.38, 42), 140);
    return `M ${sourceX} ${sourceY} C ${sourceX} ${sourceY + direction * curveOffset}, ${targetX} ${targetY - direction * curveOffset}, ${targetX} ${targetY}`;
  }

  const direction = deltaX >= 0 ? 1 : -1;
  const sourceX = sourceNode.x + direction * (sourceNode.width / 2);
  const targetX = targetNode.x - direction * (targetNode.width / 2);
  const sourceY = sourceNode.y;
  const targetY = targetNode.y;
  const curveOffset = Math.min(Math.max(Math.abs(targetX - sourceX) * 0.35, 36), 96);
  return `M ${sourceX} ${sourceY} C ${sourceX + direction * curveOffset} ${sourceY}, ${targetX - direction * curveOffset} ${targetY}, ${targetX} ${targetY}`;
}

function nodeCollisionRadius(node: PositionedNode) {
  return Math.hypot(node.width / 2, node.height / 2) + 10;
}

function createPositionedEdges(payload: GraphResult, positioned: Map<string, PositionedNode>) {
  return payload.edges
    .map((edge) => {
      const sourceNode = positioned.get(edge.source);
      const targetNode = positioned.get(edge.target);
      if (!sourceNode || !targetNode) {
        return null;
      }

      return {
        ...edge,
        sourceNode,
        targetNode,
        path: buildEdgeCurve(sourceNode, targetNode),
      };
    })
    .filter((edge): edge is PositionedEdge => Boolean(edge));
}

function finalizeLayout(
  width: number,
  height: number,
  positioned: Map<string, PositionedNode>,
  payload: GraphResult,
  decorations?: { bands?: GraphBand[]; clusters?: GraphCluster[] },
) {
  const edges = createPositionedEdges(payload, positioned);
  return {
    width,
    height,
    nodes: Array.from(positioned.values()),
    edges,
    treeEdges: edges.filter((edge) => edge.edge_type !== 'related'),
    relatedEdges: edges.filter((edge) => edge.edge_type === 'related'),
    bands: decorations?.bands ?? [],
    clusters: decorations?.clusters ?? [],
  };
}

function splitNodeGroup(group: GraphNode[], maxPerChunk: number) {
  if (group.length <= maxPerChunk) {
    return [group];
  }

  const chunks: GraphNode[][] = [];
  for (let index = 0; index < group.length; index += maxPerChunk) {
    chunks.push(group.slice(index, index + maxPerChunk));
  }
  return chunks;
}

function bandLabelForNodes(nodes: GraphNode[]) {
  if (nodes.some((node) => node.node_type === 'document')) {
    return {
      nodeType: 'document' as const,
      label: 'Documents',
    };
  }

  return null;
}

function buildTreeLayout(payload: GraphResult, degreeMap: Map<string, number>) {
  const maxDepth = Math.max(...payload.nodes.map((node) => node.depth), 1);
  const provisionalWidth = Math.max(1760, 940 + maxDepth * 260);
  const horizontalPadding = 120;
  const verticalPadding = 104;
  const nodeGap = 32;
  const groupGap = 72;
  const rowGap = 112;
  const depthGap = 128;

  const byDepth = new Map<number, GraphNode[]>();
  for (const node of payload.nodes) {
    const depthNodes = byDepth.get(node.depth) ?? [];
    depthNodes.push(node);
    byDepth.set(node.depth, depthNodes);
  }

  const averageCardWidth = 184;
  const maxColumns = Math.max(
    2,
    Math.floor((provisionalWidth - horizontalPadding * 2 + nodeGap) / (averageCardWidth + nodeGap)),
  );

  const rowsByDepth = new Map<number, GraphNode[][][]>();
  let widestRow = 0;

  for (const [depth, nodes] of [...byDepth.entries()].sort((a, b) => a[0] - b[0])) {
    if (depth === 0) {
      rowsByDepth.set(depth, [[[...nodes].sort((a, b) => a.label.localeCompare(b.label))]]);
      widestRow = Math.max(widestRow, nodes[0] ? 196 : 0);
      continue;
    }

    const grouped = new Map<string, GraphNode[]>();
    const orderedNodes = [...nodes].sort((a, b) => {
      const parentCompare = (a.parent_id ?? '').localeCompare(b.parent_id ?? '');
      const typeCompare = a.node_type.localeCompare(b.node_type);
      return parentCompare || typeCompare || a.label.localeCompare(b.label);
    });

    for (const node of orderedNodes) {
      const parentKey = node.parent_id ?? '__root__';
      const bucket = grouped.get(parentKey) ?? [];
      bucket.push(node);
      grouped.set(parentKey, bucket);
    }

    const subgroups = [...grouped.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .flatMap(([parentId, group]) =>
        splitNodeGroup(group, maxColumns).map((chunk, chunkIndex) => ({
          parentId,
          chunkIndex,
          nodes: chunk,
        })),
      );

    const rows: GraphNode[][][] = [];
    let currentRow: GraphNode[][] = [];
    let currentCount = 0;

    for (const subgroup of subgroups) {
      const subgroupCount = subgroup.nodes.length;
      const nextCount = currentCount === 0 ? subgroupCount : currentCount + subgroupCount;
      if (currentRow.length && nextCount > maxColumns) {
        rows.push(currentRow);
        currentRow = [];
        currentCount = 0;
      }

      currentRow.push(subgroup.nodes);
      currentCount += subgroupCount;
    }

    if (currentRow.length) {
      rows.push(currentRow);
    }

    rowsByDepth.set(depth, rows);

    for (const row of rows) {
      const flatRow = row.flat();
      const rowWidth =
        flatRow.reduce((sum, node) => sum + createPositionedNode(node, 0, 0, degreeMap.get(node.id) ?? 0).width, 0) +
        Math.max(flatRow.length - 1, 0) * nodeGap +
        Math.max(row.length - 1, 0) * groupGap;
      widestRow = Math.max(widestRow, rowWidth);
    }
  }

  const width = Math.max(provisionalWidth, widestRow + horizontalPadding * 2);
  const positioned = new Map<string, PositionedNode>();
  const bands: GraphBand[] = [];
  const clusters: GraphCluster[] = [];
  let currentY = verticalPadding;

  for (const depth of [...rowsByDepth.keys()].sort((a, b) => a - b)) {
    const rows = rowsByDepth.get(depth) ?? [];
    const depthTop = currentY - 46;
    let depthBottom = currentY;

    rows.forEach((rowGroups, rowIndex) => {
      const rowGroupsMetrics = rowGroups.map((groupNodes) =>
        groupNodes.map((node) => createPositionedNode(node, 0, 0, degreeMap.get(node.id) ?? 0)),
      );
      const rowWidth =
        rowGroupsMetrics.reduce(
          (sum, groupNodes) => sum + groupNodes.reduce((groupSum, node) => groupSum + node.width, 0),
          0,
        ) +
        rowGroupsMetrics.reduce((sum, groupNodes) => sum + Math.max(groupNodes.length - 1, 0) * nodeGap, 0) +
        Math.max(rowGroupsMetrics.length - 1, 0) * groupGap;
      let currentX = (width - rowWidth) / 2;
      const rowY = currentY + rowIndex * rowGap;
      depthBottom = Math.max(depthBottom, rowY + 58);

      rowGroupsMetrics.forEach((groupNodes, groupIndex) => {
        const groupStartX = currentX;

        groupNodes.forEach((node, nodeIndex) => {
          const x = currentX + node.width / 2;
          positioned.set(node.id, { ...node, x, y: rowY });
          currentX += node.width;
          if (nodeIndex < groupNodes.length - 1) {
            currentX += nodeGap;
          }
        });

        const groupWidth = currentX - groupStartX;
        const groupNodeType = groupNodes[0]?.node_type ?? 'document';
        const parentId = rowGroups[groupIndex][0]?.parent_id ?? `depth-${depth}-row-${rowIndex}-group-${groupIndex}`;
        const parentNode =
          rowGroups[groupIndex][0]?.parent_id
            ? payload.nodes.find((node) => node.id === rowGroups[groupIndex][0]?.parent_id) ?? null
            : null;

        const shouldDecorateCluster =
          groupNodeType === 'document' &&
          parentNode?.node_type !== 'knowledge_base' &&
          parentNode?.node_type !== 'user';

        if (shouldDecorateCluster) {
          clusters.push({
            id: `${parentId}-${depth}-${rowIndex}-${groupIndex}`,
            label: '',
            nodeType: groupNodeType,
            x: groupStartX - 14,
            y: rowY - 34,
            width: groupWidth + 28,
            height: Math.max(...groupNodes.map((node) => node.height)) + 52,
          });
        }

        if (groupIndex < rowGroupsMetrics.length - 1) {
          currentX += groupGap;
        }
      });
    });

    const bandMeta = bandLabelForNodes(rows.flat(2));
    if (bandMeta) {
      bands.push({
        id: `band-${depth}`,
        label: bandMeta.label,
        nodeType: bandMeta.nodeType,
        y: depthTop,
        height: Math.max(depthBottom - depthTop, 88),
      });
    }

    const blockHeight = Math.max(rows.length, 1) * rowGap;
    currentY += blockHeight + depthGap;
  }

  const height = Math.max(currentY - depthGap + verticalPadding, 820);

  for (const node of positioned.values()) {
    const parentId = node.parent_id;
    if (!parentId) {
      continue;
    }
    const parentNode = positioned.get(parentId);
    if (!parentNode) {
      continue;
    }

    if (Math.abs(node.x - parentNode.x) < 6) {
      continue;
    }

    const attraction = Math.min((node.x - parentNode.x) * 0.1, 32);
    node.x -= attraction;
  }

  for (const depth of [...byDepth.keys()].sort((a, b) => a - b)) {
    const depthNodes = [...positioned.values()]
      .filter((node) => node.depth === depth)
      .sort((a, b) => a.x - b.x);

    for (let index = 1; index < depthNodes.length; index += 1) {
      const previous = depthNodes[index - 1];
      const current = depthNodes[index];
      const minimumGap = previous.width / 2 + current.width / 2 + nodeGap;
      const overlap = previous.x + minimumGap - current.x;
      if (overlap > 0) {
        current.x += overlap;
      }
    }

    for (let index = depthNodes.length - 2; index >= 0; index -= 1) {
      const next = depthNodes[index + 1];
      const current = depthNodes[index];
      const minimumGap = current.width / 2 + next.width / 2 + nodeGap;
      const overlap = current.x + minimumGap - next.x;
      if (overlap > 0) {
        current.x -= overlap;
      }
    }
  }

  return finalizeLayout(width, height, positioned, payload, { bands, clusters });
}

function buildConstellationLayout(payload: GraphResult, degreeMap: Map<string, number>) {
  const width = 1540;
  const height = Math.max(920, Math.ceil(payload.nodes.length / 16) * 220 + 560);
  const centerX = width / 2;
  const centerY = height / 2;
  const rootId =
    selectedNodeId.value && payload.nodes.some((node) => node.id === selectedNodeId.value)
      ? selectedNodeId.value
      : payload.root_node_id || payload.nodes[0]?.id;
  const rootNode = payload.nodes.find((node) => node.id === rootId) ?? payload.nodes[0];
  const positioned = new Map<string, PositionedNode>();
  positioned.set(rootNode.id, createPositionedNode(rootNode, centerX, centerY, degreeMap.get(rootNode.id) ?? 0));

  const distances = new Map<string, number>([[rootNode.id, 0]]);
  const queue = [rootNode.id];

  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const distance = distances.get(current) ?? 0;
    if (distance >= 3) {
      continue;
    }

    for (const edge of payload.edges) {
      const neighbor = edge.source === current ? edge.target : edge.target === current ? edge.source : '';
      if (!neighbor || distances.has(neighbor)) {
        continue;
      }
      distances.set(neighbor, distance + 1);
      queue.push(neighbor);
    }
  }

  const rings = new Map<number, GraphNode[]>();
  for (const node of payload.nodes) {
    if (node.id === rootNode.id) {
      continue;
    }
    const ringIndex = distances.get(node.id) ?? Math.min(node.depth + 1, 4);
    const ring = rings.get(ringIndex) ?? [];
    ring.push(node);
    rings.set(ringIndex, ring);
  }

  const ringBaseRadius = 240;
  for (const [ringIndex, nodes] of rings) {
    const ordered = [...nodes].sort((a, b) => {
      const typeCompare = a.node_type.localeCompare(b.node_type);
      return typeCompare || a.label.localeCompare(b.label);
    });
    const baseRadius = ringBaseRadius + (Math.min(ringIndex, 4) - 1) * 190;
    const angleStart = ringIndex % 2 === 0 ? -Math.PI / 4 : -Math.PI / 2;
    ordered.forEach((node, index) => {
      const angle = angleStart + (Math.PI * 2 * index) / Math.max(ordered.length, 1);
      const minOrbitRadius = (ordered.length * 132) / (Math.PI * 2);
      const orbitRadius = Math.max(baseRadius, minOrbitRadius + node.depth * 18);
      positioned.set(
        node.id,
        createPositionedNode(
          node,
          centerX + orbitRadius * Math.cos(angle),
          centerY + orbitRadius * Math.sin(angle),
          degreeMap.get(node.id) ?? 0,
        ),
      );
    });
  }

  return finalizeLayout(width, height, positioned, payload);
}

function buildLayout(payload: GraphResult | null) {
  if (!payload || !payload.nodes.length) {
    return createEmptyLayout();
  }

  const degreeMap = createDegreeMap(payload);
  return layoutMode.value === 'constellation'
    ? buildConstellationLayout(payload, degreeMap)
    : buildTreeLayout(payload, degreeMap);
}

const layout = ref<GraphLayout>(createEmptyLayout());

function edgeWeight(edge: Pick<GraphEdge, 'edge_type' | 'metadata'>) {
  const relationshipScore = edge.metadata.relationship_score;
  const sharedMemoryCount = edge.metadata.shared_memory_count;
  if (typeof relationshipScore === 'number') {
    return Math.min(Math.max(relationshipScore, 0), 1);
  }
  if (typeof sharedMemoryCount === 'number') {
    return Math.min(sharedMemoryCount / 8, 1);
  }
  return edge.edge_type === 'related' ? 0.5 : 0.65;
}

function edgeRenderStyle(edge: PositionedEdge) {
  const weight = edgeWeight(edge);
  const width = edge.edge_type === 'related' ? 0.9 + weight * 2.4 : 0.8 + weight * 1.6;
  return {
    '--edge-width': `${width}px`,
    '--edge-opacity': String(edge.edge_type === 'related' ? 0.22 + weight * 0.42 : 0.24 + weight * 0.28),
  };
}

function edgePath(edge: PositionedEdge) {
  return buildEdgeCurve(edge.sourceNode, edge.targetNode);
}

function forceDistance(edge: ForceEdge) {
  const weight = edgeWeight(edge);
  if (edge.edge_type === 'related') {
    return 238 - weight * 54;
  }
  if (edge.edge_type === 'extracts') {
    return 146;
  }
  return 196 - weight * 34;
}

function forceStrength(edge: ForceEdge) {
  const weight = edgeWeight(edge);
  if (edge.edge_type === 'related') {
    return 0.1 + weight * 0.14;
  }
  return 0.22 + weight * 0.14;
}

function stopGraphSimulation() {
  graphSimulation.value?.stop();
  graphSimulation.value = null;
}

function clampNodeToBounds(node: PositionedNode) {
  const paddingX = node.width / 2 + 28;
  const paddingY = node.height / 2 + 28;
  node.x = Math.min(Math.max(node.x ?? layout.value.width / 2, paddingX), layout.value.width - paddingX);
  node.y = Math.min(Math.max(node.y ?? layout.value.height / 2, paddingY), layout.value.height - paddingY);
}

function restartGraphSimulation(payload: GraphResult | null) {
  stopGraphSimulation();
  layout.value = buildLayout(payload);

  if (!payload || !layout.value.nodes.length) {
    return;
  }

  const positioned = new Map(layout.value.nodes.map((node) => [node.id, node]));
  layout.value.edges = createPositionedEdges(payload, positioned);
  layout.value.treeEdges = layout.value.edges.filter((edge) => edge.edge_type !== 'related');
  layout.value.relatedEdges = layout.value.edges.filter((edge) => edge.edge_type === 'related');

  if (layoutMode.value === 'tree') {
    return;
  }

  const links = payload.edges
    .filter((edge) => positioned.has(edge.source) && positioned.has(edge.target))
    .map<ForceEdge>((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      edge_type: edge.edge_type,
      metadata: edge.metadata,
    }));

  graphSimulation.value = forceSimulation<PositionedNode, ForceEdge>(layout.value.nodes)
    .force(
      'link',
      forceLink<PositionedNode, ForceEdge>(links)
        .id((node) => node.id)
        .distance(forceDistance)
        .strength(forceStrength),
    )
    .force('charge', forceManyBody<PositionedNode>().strength((node) => -340 - Math.sqrt(node.degree) * 48))
    .force('center', forceCenter<PositionedNode>(layout.value.width / 2, layout.value.height / 2).strength(0.022))
    .force(
      'collide',
      forceCollide<PositionedNode>()
        .radius((node) => nodeCollisionRadius(node))
        .strength(0.96)
        .iterations(4),
    )
    .force('x', forceX<PositionedNode>(layout.value.width / 2).strength(0.01))
    .force('y', forceY<PositionedNode>(layout.value.height / 2).strength(0.008))
    .alpha(0.8)
    .alphaDecay(0.045)
    .on('tick', () => {
      for (const node of layout.value.nodes) {
        clampNodeToBounds(node);
      }
    });
}

function animateViewport(target: { scale?: number; x?: number; y?: number }, duration = 0.48) {
  stopViewportAnimation();
  viewportTween.value = gsap.to(viewport, {
    ...target,
    duration,
    ease: 'power3.out',
    onComplete: () => {
      viewportTween.value = null;
    },
  });
}

function resetViewport(animate = true) {
  stopViewportAnimation();
  viewport.scale = 1;
  viewport.x = 0;
  viewport.y = 0;
  centerOnNode(selectedNodeId.value || layout.value.nodes[0]?.id || '', animate);
}

function centerOnNode(nodeId = selectedNodeId.value, animate = true) {
  const node = layout.value.nodes.find((item) => item.id === nodeId);
  if (!node) {
    return;
  }

  const target = {
    x: layout.value.width / 2 - node.x * viewport.scale,
    y: layout.value.height / 2 - node.y * viewport.scale,
  };

  if (!animate) {
    stopViewportAnimation();
    viewport.x = target.x;
    viewport.y = target.y;
    return;
  }

  animateViewport(target, 0.42);
}

function zoomTo(nextScale: number, animate = true) {
  const clamped = clampScale(nextScale);
  if (clamped === viewport.scale) {
    return;
  }

  const activeNode = layout.value.nodes.find((item) => item.id === selectedNodeId.value);
  if (activeNode) {
    const target = {
      scale: clamped,
      x: layout.value.width / 2 - activeNode.x * clamped,
      y: layout.value.height / 2 - activeNode.y * clamped,
    };
    if (!animate) {
      stopViewportAnimation();
      viewport.scale = target.scale;
      viewport.x = target.x;
      viewport.y = target.y;
      return;
    }
    animateViewport(target, 0.36);
    return;
  }

  const scaleRatio = clamped / viewport.scale;
  const target = {
    scale: clamped,
    x: viewport.x * scaleRatio,
    y: viewport.y * scaleRatio,
  };
  if (!animate) {
    stopViewportAnimation();
    viewport.scale = target.scale;
    viewport.x = target.x;
    viewport.y = target.y;
    return;
  }
  animateViewport(target, 0.3);
}

function zoomIn() {
  zoomTo(viewport.scale + 0.14, true);
}

function zoomOut() {
  zoomTo(viewport.scale - 0.14, true);
}

function clientToSvgPoint(event: PointerEvent | WheelEvent) {
  const svg = svgRef.value;
  if (!svg) {
    return null;
  }

  const rect = svg.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / Math.max(rect.width, 1)) * layout.value.width,
    y: ((event.clientY - rect.top) / Math.max(rect.height, 1)) * layout.value.height,
  };
}

function clientToGraphPoint(event: PointerEvent | WheelEvent) {
  const point = clientToSvgPoint(event);
  if (!point) {
    return null;
  }

  return {
    x: (point.x - viewport.x) / viewport.scale,
    y: (point.y - viewport.y) / viewport.scale,
    svgX: point.x,
    svgY: point.y,
  };
}

function handleWheel(event: WheelEvent) {
  event.preventDefault();
  const graphPoint = clientToGraphPoint(event);
  if (!graphPoint) {
    zoomTo(viewport.scale + (event.deltaY < 0 ? 0.12 : -0.12), false);
    return;
  }

  const nextScale = clampScale(viewport.scale * (event.deltaY < 0 ? 1.12 : 0.88));
  stopViewportAnimation();
  viewport.scale = nextScale;
  viewport.x = graphPoint.svgX - graphPoint.x * nextScale;
  viewport.y = graphPoint.svgY - graphPoint.y * nextScale;
}

function startPan(event: PointerEvent) {
  if (event.pointerType === 'mouse' && ![0, 1, 2].includes(event.button)) {
    return;
  }

  event.preventDefault();
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  stopViewportAnimation();
  viewport.panning = true;
  viewport.lastClientX = event.clientX;
  viewport.lastClientY = event.clientY;
}

function movePan(event: PointerEvent) {
  if (!viewport.panning || !stageRef.value) {
    return;
  }

  const rect = stageRef.value.getBoundingClientRect();
  const dx = (event.clientX - viewport.lastClientX) * (layout.value.width / Math.max(rect.width, 1));
  const dy = (event.clientY - viewport.lastClientY) * (layout.value.height / Math.max(rect.height, 1));

  viewport.x += dx;
  viewport.y += dy;
  viewport.lastClientX = event.clientX;
  viewport.lastClientY = event.clientY;
}

function endPan() {
  viewport.panning = false;
}

function isNodeMuted(nodeId: string) {
  if (!focusMode.value || !activeHighlightNodeId.value) {
    return false;
  }

  return !highlightedNodeIds.value.has(nodeId);
}

function isNodeSearchMatch(nodeId: string) {
  return normalizedSearchQuery.value ? searchMatchIds.value.has(nodeId) : false;
}

function setHoveredNode(nodeId: string) {
  hoveredNodeId.value = nodeId;
}

function clearHoveredNode() {
  hoveredNodeId.value = '';
}

function isEdgeMuted(edge: PositionedEdge) {
  if (!focusMode.value || !activeHighlightNodeId.value) {
    return false;
  }

  return !highlightedEdgeIds.value.has(edge.id);
}

function isEdgeHighlighted(edge: PositionedEdge) {
  return highlightedEdgeIds.value.has(edge.id);
}

function isNodeLabelVisible(node: PositionedNode) {
  return node.degree >= 3 || viewport.scale > 1.18 || node.id === hoveredNodeId.value || node.id === selectedNodeId.value;
}

function startNodeDrag(event: PointerEvent, node: PositionedNode) {
  if (event.pointerType === 'mouse' && event.button !== 0) {
    return;
  }

  event.preventDefault();
  (event.currentTarget as SVGElement).setPointerCapture?.(event.pointerId);
  const point = clientToGraphPoint(event);
  nodeDrag.id = node.id;
  nodeDrag.pointerId = event.pointerId;
  nodeDrag.startClientX = event.clientX;
  nodeDrag.startClientY = event.clientY;
  nodeDrag.moved = false;
  node.fx = point?.x ?? node.x;
  node.fy = point?.y ?? node.y;
  graphSimulation.value?.alphaTarget(0.3).restart();
}

function moveNodeDrag(event: PointerEvent) {
  if (!nodeDrag.id || event.pointerId !== nodeDrag.pointerId) {
    return;
  }

  const node = layout.value.nodes.find((item) => item.id === nodeDrag.id);
  const point = clientToGraphPoint(event);
  if (!node || !point) {
    return;
  }

  event.preventDefault();
  const movedDistance = Math.hypot(event.clientX - nodeDrag.startClientX, event.clientY - nodeDrag.startClientY);
  nodeDrag.moved = nodeDrag.moved || movedDistance > 3;
  node.fx = point.x;
  node.fy = point.y;
  node.x = point.x;
  node.y = point.y;
}

function endNodeDrag(event: PointerEvent) {
  if (!nodeDrag.id || event.pointerId !== nodeDrag.pointerId) {
    return;
  }

  const node = layout.value.nodes.find((item) => item.id === nodeDrag.id);
  if (node) {
    node.fx = null;
    node.fy = null;
  }
  graphSimulation.value?.alphaTarget(0);
  suppressNodeClick.value = nodeDrag.moved;
  nodeDrag.id = '';
  nodeDrag.pointerId = 0;
  nodeDrag.moved = false;

  window.setTimeout(() => {
    suppressNodeClick.value = false;
  }, 0);
}

function handleNodeClick(nodeId: string) {
  if (suppressNodeClick.value) {
    return;
  }
  selectNode(nodeId);
}

async function loadGraph() {
  if (!session.token) {
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    if (scope.value === 'user') {
      graph.value = await api.userGraph(session.token, graphOptions.value);
    } else if (scope.value === 'document') {
      const documentId = currentDocumentId.value;
      if (!documentId) {
        graph.value = null;
        return;
      }
      graph.value = await api.documentGraph(session.token, documentId, graphOptions.value);
    } else {
      if (!workspace.activeKnowledgeBaseId) {
        graph.value = null;
        return;
      }
      graph.value = await api.knowledgeBaseGraph(
        session.token,
        workspace.activeKnowledgeBaseId,
        graphOptions.value,
      );
    }

    setSelectedNode(graph.value.root_node_id || graph.value.nodes[0]?.id || '', { history: 'replace' });
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Unable to load graph.';
    graph.value = null;
  } finally {
    loading.value = false;
  }
}

async function rebuildGraphProjection() {
  if (!session.token || rebuildLoading.value) {
    return;
  }

  if (scope.value !== 'user' && !graphRebuildTargetKnowledgeBaseId.value) {
    rebuildMessage.value = 'Select a knowledge base before rebuilding the graph projection.';
    return;
  }

  rebuildLoading.value = true;
  rebuildMessage.value = '';
  try {
    lastRebuild.value =
      scope.value === 'user'
        ? await api.rebuildUserGraph(session.token)
        : await api.rebuildKnowledgeBaseGraph(session.token, graphRebuildTargetKnowledgeBaseId.value);

    rebuildMessage.value =
      lastRebuild.value.scope === 'user'
        ? `Rebuilt ${lastRebuild.value.document_count} documents across the workspace.`
        : `Rebuilt ${lastRebuild.value.document_count} documents and ${lastRebuild.value.memory_entry_count} memory entries.`;

    await loadGraph();
  } catch (rebuildError) {
    rebuildMessage.value =
      rebuildError instanceof Error ? rebuildError.message : 'Unable to rebuild graph projection.';
  } finally {
    rebuildLoading.value = false;
  }
}

function selectNode(nodeId: string) {
  setSelectedNode(nodeId, { history: 'push' });
}

function locateNode(nodeId: string) {
  setSelectedNode(nodeId, { history: 'push' });
  centerOnNode(nodeId, true);
  closeSearchDropdown();
}

function locateFirstSearchResult() {
  const first = searchResults.value[0];
  if (!first) {
    return;
  }
  locateNode(first.id);
}

async function openSelection() {
  if (!selectedNode.value) {
    return;
  }

  if (selectedNode.value.node_type === 'knowledge_base') {
    const targetKnowledgeBaseId = selectedNode.value.entity_id;
    if (
      session.token &&
      workspace.knowledgeBases.some((item) => item.id === targetKnowledgeBaseId) &&
      workspace.activeKnowledgeBaseId !== targetKnowledgeBaseId
    ) {
      await workspace.selectKnowledgeBase(targetKnowledgeBaseId, session.token);
    }

    await router.push({
      name: 'knowledge-bases',
      query: mergeQuery(route.query, { kb: targetKnowledgeBaseId }),
    });
    return;
  }

  const targetDocumentId = selectedNode.value.node_type === 'document' ? selectedNode.value.entity_id : '';

  if (!targetDocumentId) {
    return;
  }

  const targetDocument = workspace.documents.find((item) => item.id === targetDocumentId);
  const targetKnowledgeBaseId = targetDocument?.knowledge_base_id ?? workspace.activeKnowledgeBaseId;

  if (
    targetKnowledgeBaseId &&
    session.token &&
    workspace.knowledgeBases.some((item) => item.id === targetKnowledgeBaseId) &&
    workspace.activeKnowledgeBaseId !== targetKnowledgeBaseId
  ) {
    await workspace.selectKnowledgeBase(targetKnowledgeBaseId, session.token);
  }

  await router.push({
    name: 'documents',
    query: mergeQuery(route.query, {
      kb: targetKnowledgeBaseId || undefined,
      doc: targetDocumentId,
    }),
  });
}

async function openDocumentByNodeId(nodeId: string) {
  const payload = visibleGraph.value ?? graph.value;
  const targetNode = payload?.nodes.find((node) => node.id === nodeId);
  if (!targetNode) {
    return;
  }

  const targetDocumentId = targetNode.node_type === 'document' ? targetNode.entity_id : '';

  if (!targetDocumentId) {
    return;
  }

  const targetDocument = workspace.documents.find((item) => item.id === targetDocumentId);
  const targetKnowledgeBaseId = targetDocument?.knowledge_base_id ?? workspace.activeKnowledgeBaseId;

  if (
    targetKnowledgeBaseId &&
    session.token &&
    workspace.knowledgeBases.some((item) => item.id === targetKnowledgeBaseId) &&
    workspace.activeKnowledgeBaseId !== targetKnowledgeBaseId
  ) {
    await workspace.selectKnowledgeBase(targetKnowledgeBaseId, session.token);
  }

  await router.push({
    name: 'documents',
    query: mergeQuery(route.query, {
      kb: targetKnowledgeBaseId || undefined,
      doc: targetDocumentId,
    }),
  });
}

function selectDocument(event: Event) {
  graphDocumentId.value = (event.target as HTMLSelectElement).value;
}

watch(selectedNodeId, (nodeId) => {
  if (suppressSelectionHistory.value) {
    suppressSelectionHistory.value = false;
  }
  if (!nodeId) {
    return;
  }
  centerOnNode(nodeId, true);
  if (hoveredNodeId.value && hoveredNodeId.value !== nodeId) {
    clearHoveredNode();
  }
});

watch(searchResults, (results) => {
  if (!results.length) {
    closeSearchDropdown();
  }
  if (!results.length || selectedNodeId.value) {
    return;
  }
  setSelectedNode(results[0].id, { history: 'ignore' });
});

watch(normalizedSearchQuery, (query) => {
  if (!query) {
    closeSearchDropdown();
    return;
  }
  searchDropdownOpen.value = true;
});

watch(
  () => [layoutMode.value, graphFilter.value] as const,
  () => {
    resetViewport(true);
  },
);

watch(
  () => layout.value.nodes.map((node) => node.id).join('|'),
  (nodeIds) => {
    if (!nodeIds) {
      return;
    }
    if (!selectedNodeId.value || !layout.value.nodes.some((node) => node.id === selectedNodeId.value)) {
      setSelectedNode(layout.value.nodes[0]?.id ?? '', { history: 'replace' });
    }
  },
  { immediate: true },
);

watch(
  () => [visibleGraph.value, layoutMode.value] as const,
  ([payload]) => {
    restartGraphSimulation(payload);
    if (!payload?.nodes.length) {
      return;
    }
    if (!selectedNodeId.value || !payload.nodes.some((node) => node.id === selectedNodeId.value)) {
      setSelectedNode(payload.root_node_id || payload.nodes[0]?.id || '', { history: 'replace' });
    }
    resetViewport(false);
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener('pointerdown', handleGlobalPointerDown);
});

onBeforeUnmount(() => {
  stopViewportAnimation();
  stopGraphSimulation();
  clearHoveredNode();
  endPan();
  window.removeEventListener('pointerdown', handleGlobalPointerDown);
});

watch(
  () => route.query,
  (query) => {
    const nextScope = readQueryString(query, 'scope');
    scope.value =
      nextScope === 'user' || nextScope === 'document' || nextScope === 'knowledge_base'
        ? nextScope
        : 'knowledge_base';
    includeRelationships.value = readQueryBoolean(query, 'relationships', true);
    minSharedMemoryCount.value = readQueryNumber(query, 'shared', 2);
    minRelationshipScore.value = readQueryFloat(query, 'score', 0.35);
    maxRelatedEdges.value = readQueryNumber(query, 'edges', 80);
    graphDocumentId.value = readQueryString(query, 'graphDoc');
    searchQuery.value = readQueryString(query, 'find');
    const nextLayout = readQueryString(query, 'layout');
    layoutMode.value = nextLayout === 'tree' || nextLayout === 'constellation' ? nextLayout : 'tree';
    const nextFilter = readQueryString(query, 'filter');
    graphFilter.value = nextFilter === 'documents' || nextFilter === 'all' ? nextFilter : 'all';
  },
  { immediate: true, deep: true },
);

watch(
  [
    scope,
    includeRelationships,
    minSharedMemoryCount,
    minRelationshipScore,
    maxRelatedEdges,
    graphDocumentId,
    layoutMode,
    graphFilter,
    searchQuery,
  ],
  async () => {
    const nextQuery = mergeQuery(route.query, {
      scope: scope.value !== 'knowledge_base' ? scope.value : undefined,
      relationships: includeRelationships.value ? undefined : '0',
      shared: minSharedMemoryCount.value !== 2 ? minSharedMemoryCount.value : undefined,
      score: minRelationshipScore.value !== 0.35 ? minRelationshipScore.value : undefined,
      edges: maxRelatedEdges.value !== 80 ? maxRelatedEdges.value : undefined,
      graphDoc: scope.value === 'document' ? currentDocumentId.value : undefined,
      layout: layoutMode.value !== 'constellation' ? layoutMode.value : undefined,
      filter: graphFilter.value !== 'all' ? graphFilter.value : undefined,
      find: searchQuery.value.trim() || undefined,
    });

    if (JSON.stringify(nextQuery) === JSON.stringify(route.query)) {
      return;
    }

    await router.replace({
      path: route.path,
      query: nextQuery,
    });
  },
);

watch(
  () =>
    [
      session.token,
      workspace.activeKnowledgeBaseId,
      workspace.filteredDocuments.map((item) => item.id).join('|'),
      scope.value,
      includeRelationships.value,
      minSharedMemoryCount.value,
      minRelationshipScore.value,
      maxRelatedEdges.value,
      currentDocumentId.value,
    ] as const,
  () => {
    void loadGraph();
  },
  { immediate: true },
);
</script>

<template>
  <div class="graph-explorer">
    <header class="graph-shell-header">
      <div class="graph-brand">
        <span class="graph-brand__mark">M</span>
        <div>
          <p>Knowledge canvas</p>
          <h1>{{ graphScopeLabel }}</h1>
        </div>
      </div>

      <div class="graph-layer-strip" aria-label="Graph layers">
        <button
          v-for="category in nodeCategoryFilters"
          :key="category.key"
          class="graph-layer-pill"
          type="button"
          :data-active="category.active"
          :style="{ '--layer-color': category.color }"
          @click="category.key === 'documents' ? (graphFilter = 'documents') : (graphFilter = 'all')"
        >
          <span />
          {{ category.label }}
        </button>
      </div>

      <div class="graph-header-actions">
        <button class="ghost-button" type="button" :disabled="loading" @click="loadGraph">
          {{ loading ? 'Loading' : 'Refresh' }}
        </button>
        <button
          class="ghost-button"
          type="button"
          :disabled="rebuildLoading || (scope !== 'user' && !graphRebuildTargetKnowledgeBaseId)"
          @click="rebuildGraphProjection"
        >
          {{ rebuildLoading ? 'Rebuilding' : 'Rebuild' }}
        </button>
        <button class="ghost-button" type="button" @click="zoomOut()">-</button>
        <button class="ghost-button" type="button" @click="zoomIn()">+</button>
        <button class="ghost-button" type="button" @click="resetViewport()">Reset</button>
      </div>
    </header>

    <section
      ref="searchRailRef"
      class="graph-search-rail"
      @keydown.esc.prevent="closeSearchDropdown"
    >
      <span class="graph-search-rail__icon">Search</span>
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Search notes, collections, or metadata..."
        @focus="openSearchDropdown"
        @keydown.enter.prevent="locateFirstSearchResult"
      />
      <div class="graph-search-mode" aria-label="Search mode">
        <span data-active="true">Quick find</span>
        <span>Visible nodes</span>
      </div>
      <span v-if="searchQuery.trim()" class="graph-result-count">
        {{ searchResults.length }} result{{ searchResults.length === 1 ? '' : 's' }}
      </span>

      <div v-if="showSearchDropdown" class="graph-search-dropdown">
        <button
          v-for="node in searchResults.slice(0, 6)"
          :key="node.id"
          class="graph-search-dropdown__item"
          type="button"
          @click="locateNode(node.id)"
        >
          <span class="graph-search-dropdown__badge" :style="{ '--badge-color': nodeColor(node.node_type) }">
            {{ nodeTypeLabel(node.node_type) }}
          </span>
          <strong>{{ node.label }}</strong>
          <small>{{ truncateLabel(nodeSummary(node), 64) }}</small>
        </button>
      </div>
    </section>

    <section class="graph-nav-strip">
      <div class="graph-history" aria-label="Selection history">
        <button
          class="graph-history__back"
          type="button"
          :disabled="historyCursor <= 0"
          @click="navigateHistory(-1)"
        >
          Back
        </button>

        <template v-for="(node, index) in historyTrail" :key="node.id">
          <button
            class="graph-history__crumb"
            type="button"
            :data-active="node.id === selectedNodeId"
            @click="jumpToHistory(node.id)"
          >
            {{ truncateLabel(node.label, 18) }}
          </button>
          <span v-if="index < historyTrail.length - 1" class="graph-history__sep">›</span>
        </template>

        <span v-if="!historyTrail.length" class="graph-history__empty">Select a node to start browsing</span>
      </div>

      <div class="graph-mode-strip" aria-label="Graph modes">
        <button
          v-for="mode in graphViewModes"
          :key="mode.key"
          class="graph-mode-pill"
          type="button"
          :data-active="mode.active"
          @click="mode.action()"
        >
          {{ mode.label }}
        </button>
      </div>
    </section>

    <section class="graph-board">
      <main class="graph-main">
        <div class="graph-main__meta">
          <span>{{ graphSubtitle }}</span>
          <span>Generated {{ generatedAt }}</span>
          <span>Press <kbd>?</kbd> for shortcuts</span>
        </div>

        <div v-if="focusMode && selectedNode" class="graph-focus-chip">
          <span>Showing neighborhood</span>
          <strong>{{ truncateLabel(selectedNode.label, 28) }}</strong>
          <button type="button" @click="focusMode = false">Clear</button>
        </div>

        <div
          ref="stageRef"
          class="graph-stage"
          :data-loading="loading"
          :data-panning="viewport.panning"
          @wheel="handleWheel"
          @pointerdown="startPan"
          @pointermove="movePan"
          @pointerup="endPan"
          @pointerleave="endPan"
          @pointercancel="endPan"
        >
          <div v-if="loading" class="graph-loading">
            <span />
            <p>Drawing graph...</p>
          </div>

          <EmptyState
            v-else-if="error"
            title="Graph unavailable"
            :description="error"
          />

          <EmptyState
            v-else-if="!graph || !layout.nodes.length"
            title="No graph data"
            description="Index documents first, then refresh the graph."
          />

          <svg
            v-else
            ref="svgRef"
            class="knowledge-graph"
            :viewBox="`0 0 ${layout.width} ${layout.height}`"
            role="img"
            aria-label="Knowledge graph"
            @contextmenu.prevent
          >
            <g class="graph-layer" :transform="graphTransform">
              <g v-if="layoutMode === 'tree'" class="graph-layer__bands">
                <g v-for="band in layout.bands" :key="band.id" class="graph-band" :data-type="band.nodeType">
                  <rect x="34" :y="band.y" :width="layout.width - 68" :height="band.height" rx="22" />
                  <text x="58" :y="band.y + 26">{{ band.label }}</text>
                </g>
              </g>

              <g v-if="layoutMode === 'tree'" class="graph-layer__groups">
                <g v-for="cluster in layout.clusters" :key="cluster.id" class="graph-group" :data-type="cluster.nodeType">
                  <rect :x="cluster.x" :y="cluster.y" :width="cluster.width" :height="cluster.height" rx="18" />
                </g>
              </g>

              <g class="graph-layer__edges">
                <path
                  v-for="edge in layout.edges"
                  :key="edge.id"
                  class="graph-edge"
                  :class="{
                    'is-highlighted': isEdgeHighlighted(edge),
                    'is-dimmed': isEdgeMuted(edge),
                    'graph-edge--related': edge.edge_type === 'related',
                  }"
                  :d="edgePath(edge)"
                  :data-type="edge.edge_type"
                  :style="edgeRenderStyle(edge)"
                />
              </g>

              <g class="graph-layer__labels">
                <template v-for="edge in layout.relatedEdges" :key="`label-${edge.id}`">
                  <text
                    v-if="isEdgeHighlighted(edge) && viewport.scale > 0.86"
                    class="graph-edge-label"
                    :class="{ 'is-dimmed': isEdgeMuted(edge) }"
                    :x="(edge.sourceNode.x + edge.targetNode.x) / 2"
                    :y="(edge.sourceNode.y + edge.targetNode.y) / 2"
                  >
                    {{ edgeLabel(edge) }}
                  </text>
                </template>
              </g>

              <g class="graph-layer__nodes">
                <g
                  v-for="node in layout.nodes"
                  :key="node.id"
                  class="graph-node-card-svg"
                  :class="{
                    'is-selected': node.id === selectedNodeId,
                    'is-dimmed': isNodeMuted(node.id),
                    'is-search-match': isNodeSearchMatch(node.id),
                    'is-current': isCurrentWorkspaceDocument(node.id),
                  }"
                  :transform="`translate(${node.x - node.width / 2} ${node.y - node.height / 2})`"
                  :data-type="node.node_type"
                  :style="nodeStyle(node)"
                  tabindex="0"
                  role="button"
                  @pointerdown.stop="startNodeDrag($event, node)"
                  @pointermove.stop="moveNodeDrag"
                  @pointerup.stop="endNodeDrag"
                  @pointercancel.stop="endNodeDrag"
                  @mouseenter="setHoveredNode(node.id)"
                  @mouseleave="clearHoveredNode"
                  @focus="setHoveredNode(node.id)"
                  @blur="clearHoveredNode"
                  @click.stop="handleNodeClick(node.id)"
                  @dblclick.stop="selectNode(node.id); centerOnNode(node.id)"
                  @keydown.enter="selectNode(node.id)"
                >
                  <rect class="graph-node-card-svg__panel" :width="node.width" :height="node.height" rx="11" />
                  <rect class="graph-node-card-svg__bar" x="10" y="8" width="3" :height="node.height - 16" rx="1.5" />
                  <text class="graph-node-card-svg__type" x="20" y="16">
                    {{ nodeTypeLabel(node.node_type) }}
                  </text>
                  <text class="graph-node-card-svg__label" x="20" y="30">
                    {{ truncateLabel(node.label, node.width > 170 ? 22 : 18) }}
                  </text>
                  <text
                    v-if="isNodeLabelVisible(node)"
                    class="graph-node-card-svg__summary"
                    x="20"
                    :y="node.height - 8"
                  >
                    {{ truncateLabel(nodeSummary(node), 22) }}
                  </text>
                </g>
              </g>
            </g>
          </svg>

          <div
            v-if="hoveredNodeTooltip"
            class="graph-tooltip"
            :style="{
              left: `${hoveredNodeTooltip.x}px`,
              top: `${hoveredNodeTooltip.y}px`,
            }"
          >
            <strong>{{ hoveredNodeTooltip.title }}</strong>
            <span>{{ hoveredNodeTooltip.subtitle }}</span>
            <small>{{ hoveredNodeTooltip.detail }}</small>
          </div>
        </div>
      </main>

      <aside class="graph-side graph-side--dense">
        <section class="graph-panel graph-panel--compact">
          <div class="graph-panel__header">
            <span>Controls</span>
            <strong>Canvas state</strong>
          </div>

          <div class="graph-control-grid">
            <label class="graph-field">
              <span>Scope</span>
              <select v-model="scope">
                <option value="knowledge_base">Collection</option>
                <option value="document">Document</option>
                <option value="user">Notebook</option>
              </select>
            </label>

            <label class="graph-field">
              <span>Layout</span>
              <select v-model="layoutMode">
                <option value="constellation">Constellation</option>
                <option value="tree">Tree</option>
              </select>
            </label>

            <label v-if="scope === 'document'" class="graph-field graph-field--wide">
              <span>Document</span>
              <select :value="currentDocumentId" @change="selectDocument">
                <option
                  v-for="document in workspace.filteredDocuments"
                  :key="document.id"
                  :value="document.id"
                >
                  {{ document.name }}
                </option>
              </select>
            </label>

            <label class="graph-field">
              <span>Layer</span>
              <select v-model="graphFilter">
                <option value="all">All</option>
                <option value="documents">Docs</option>
              </select>
            </label>

            <label class="graph-field">
              <span>Links</span>
              <input v-model.number="minSharedMemoryCount" min="1" max="20" type="number" />
            </label>

            <label class="graph-field">
              <span>Score</span>
              <input v-model.number="minRelationshipScore" max="1" min="0" step="0.05" type="number" />
            </label>
          </div>

          <div class="graph-switches">
            <label>
              <input v-model="includeRelationships" type="checkbox" />
              <span>Relations</span>
            </label>
            <label>
              <input v-model="focusMode" type="checkbox" />
              <span>Focus</span>
            </label>
          </div>
        </section>

        <section class="graph-panel graph-panel--dense">
          <div class="graph-panel__header">
            <span>Snapshot</span>
            <strong>Current canvas</strong>
          </div>

          <div class="graph-stat-grid">
            <article v-for="stat in graphStats" :key="stat.label" class="graph-stat">
              <span>{{ stat.label }}</span>
              <strong>{{ stat.value }}</strong>
            </article>
          </div>

          <article class="context-card">
            <header class="knowledge-card__header">
              <strong>{{ workspace.currentKnowledgeBase?.name ?? 'Notebook' }}</strong>
              <span class="inline-badge">{{ graph?.scope ?? 'idle' }}</span>
            </header>
            <p>{{ relatedEdgeCount }} related edges · {{ layoutMode }} · generated {{ generatedAt }}</p>
          </article>

          <article v-if="rebuildMessage || lastRebuild" class="context-card">
            <header class="knowledge-card__header">
              <strong>Projection</strong>
              <span class="inline-badge">{{ lastRebuild?.status ?? 'ready' }}</span>
            </header>
            <p>{{ rebuildMessage || 'Graph projection has not been rebuilt in this session.' }}</p>
          </article>
        </section>

        <section class="graph-panel graph-panel--dense">
          <div class="graph-panel__header">
            <span>Search</span>
            <strong>Quick jump</strong>
          </div>

          <div v-if="searchQuery.trim()" class="graph-search__results">
            <button
              v-for="node in searchResults"
              :key="node.id"
              class="graph-search__item"
              type="button"
              :data-active="node.id === selectedNodeId"
              @click="locateNode(node.id)"
            >
              <span>{{ nodeTypeLabel(node.node_type) }}</span>
              <strong>{{ node.label }}</strong>
              <small>{{ nodeDescription(node) }}</small>
            </button>
          </div>

          <p v-else class="graph-search__hint">
            Use the search rail to jump across visible notes and collections.
          </p>
        </section>

        <section class="graph-panel graph-panel--dense">
          <div class="graph-panel__header">
            <span>Selection</span>
            <strong>Selected note</strong>
          </div>

          <div v-if="selectedNode" class="graph-inspector">
            <article class="graph-node-card" :data-type="selectedNode.node_type">
              <span>{{ nodeTypeLabel(selectedNode.node_type) }}</span>
              <strong>{{ selectedNode.label }}</strong>
              <p>{{ nodeSummary(selectedNode) }}</p>
            </article>

            <div class="graph-actions">
              <button class="ghost-button" type="button" @click="centerOnNode(selectedNode.id)">
                Center
              </button>
              <button
                v-if="selectionActionLabel"
                class="primary-button"
                type="button"
                @click="openSelection"
              >
                {{ selectionActionLabel }}
              </button>
            </div>

            <dl class="graph-metadata">
              <template
                v-for="[key, value] in Object.entries(selectedNode.metadata).slice(0, 8)"
                :key="key"
              >
                <dt>{{ key.replaceAll('_', ' ') }}</dt>
                <dd>{{ metadataText(value) }}</dd>
              </template>
            </dl>
          </div>

          <EmptyState
            v-else
            title="Nothing selected"
            description="Choose any node to inspect its metadata."
          />
        </section>

        <section class="graph-panel graph-panel--dense">
          <div class="graph-panel__header">
            <span>Relations</span>
            <strong>Shared context</strong>
          </div>

          <div v-if="selectedRelatedConnections.length" class="graph-relations">
            <article
              v-for="connection in selectedRelatedConnections"
              :key="connection.edge.id"
              class="graph-relation-card"
              :style="relationCardStyle(connection.relationshipScore)"
            >
              <header class="graph-relation-card__header">
                <div>
                  <strong>{{ connection.counterpartLabel }}</strong>
                  <p>{{ connection.counterpartDescription }}</p>
                </div>
                <span class="inline-badge">{{ relationshipPercent(connection.relationshipScore) }}</span>
              </header>

              <div class="graph-relation-card__meta">
                <span>{{ connection.sharedMemoryCount }} shared signals</span>
                <span v-if="connection.sharedMemoryTypes.length">
                  signal types: {{ connection.sharedMemoryTypes.slice(0, 3).join(' · ') }}
                </span>
              </div>

              <div v-if="connection.sharedMemories.length" class="graph-relation-card__memory">
                <span
                  v-for="memory in connection.sharedMemories"
                  :key="`${connection.edge.id}-${memory.entryName}`"
                  class="memory-chip"
                >
                  {{ memory.entryName }} · {{ memory.entryType }}
                </span>
              </div>

              <div class="graph-actions">
                <button class="ghost-button" type="button" @click="locateNode(connection.counterpartId)">
                  Locate
                </button>
                <button class="primary-button" type="button" @click="openDocumentByNodeId(connection.counterpartId)">
                  Open
                </button>
              </div>
            </article>
          </div>

          <EmptyState
            v-else
            title="No related docs"
            description="Select a document node to inspect why it connects to other documents."
          />
        </section>
      </aside>
    </section>
  </div>
</template>

<style scoped>
.graph-explorer {
  --ua-root: #0f0f14;
  --ua-surface: #15141b;
  --ua-elevated: #1b1923;
  --ua-panel: #211f2b;
  --ua-accent: #2f4968;
  --ua-accent-dim: #6d879b;
  --ua-accent-bright: #172c45;
  --ua-text: #f5f2ff;
  --ua-text-secondary: #c9c2d8;
  --ua-text-muted: #8f879f;
  --ua-border: rgba(54, 58, 64, 0.12);
  --ua-border-strong: rgba(54, 58, 64, 0.22);
  --ua-glass: rgba(20, 19, 26, 0.9);
  --ua-edge: rgba(47, 73, 104, 0.24);
  --ua-edge-dim: rgba(47, 73, 104, 0.08);
  --ua-dot: rgba(245, 242, 255, 0.045);
  --ua-shadow: 0 18px 44px rgba(72, 59, 43, 0.08);
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 3rem);
  overflow: hidden;
  border: 1px solid var(--ua-border);
  border-radius: 26px;
  background:
    radial-gradient(circle at 18% 0%, rgba(109, 135, 155, 0.14), transparent 24rem),
    radial-gradient(circle at 84% 22%, rgba(131, 121, 141, 0.08), transparent 28rem),
    linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent 14rem),
    var(--ua-root);
  color: var(--ua-text);
  box-shadow: var(--ua-shadow);
}

.graph-explorer::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0.055;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
}

:global(:root[data-theme='light'] .graph-explorer),
:global(:root[data-theme='dark'] .graph-explorer) {
  --ua-root: #0f0f14;
  --ua-surface: #15141b;
  --ua-elevated: #1b1923;
  --ua-panel: #211f2b;
  --ua-accent: #2f4968;
  --ua-accent-dim: #6d879b;
  --ua-accent-bright: #172c45;
  --ua-text: #f5f2ff;
  --ua-text-secondary: #c9c2d8;
  --ua-text-muted: #8f879f;
  --ua-border: rgba(54, 58, 64, 0.12);
  --ua-border-strong: rgba(54, 58, 64, 0.22);
  --ua-glass: rgba(20, 19, 26, 0.9);
  --ua-edge: rgba(47, 73, 104, 0.24);
  --ua-edge-dim: rgba(47, 73, 104, 0.08);
  --ua-dot: rgba(245, 242, 255, 0.045);
  --ua-shadow: 0 18px 44px rgba(72, 59, 43, 0.08);
  background:
    radial-gradient(circle at 18% 0%, rgba(109, 135, 155, 0.14), transparent 24rem),
    radial-gradient(circle at 84% 22%, rgba(131, 121, 141, 0.08), transparent 28rem),
    linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent 10rem),
    var(--ua-root);
}

.graph-shell-header,
.graph-search-rail,
.graph-board {
  position: relative;
  z-index: 1;
}

.graph-shell-header {
  display: flex;
  gap: 1rem;
  align-items: center;
  min-height: 64px;
  padding: 0.78rem 0.9rem;
  border-bottom: 1px solid var(--ua-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 76%),
    var(--ua-glass);
  backdrop-filter: blur(10px);
}

.graph-brand {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 260px;
}

.graph-brand__mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--ua-border-strong);
  border-radius: 10px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 70%),
    linear-gradient(135deg, rgba(47, 73, 104, 0.12), transparent),
    var(--ua-elevated);
  color: var(--ua-accent-bright);
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 1.35rem;
  line-height: 1;
  box-shadow: 0 10px 24px rgba(72, 59, 43, 0.1);
}

.graph-brand p,
.graph-panel__header span,
.graph-field span,
.graph-search__item span {
  margin: 0;
  color: var(--ua-text-muted);
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.graph-brand h1 {
  margin: 0.15rem 0 0;
  color: var(--ua-text);
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(1.08rem, 1.8vw, 1.34rem);
  font-weight: 500;
  letter-spacing: 0.01em;
}

.graph-layer-strip,
.graph-header-actions,
.graph-search-mode,
.graph-switches,
.graph-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;
}

.graph-layer-strip {
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.graph-layer-strip::-webkit-scrollbar {
  display: none;
}

.graph-layer-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 32px;
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--ua-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--ua-text-secondary);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

.graph-layer-pill span {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--layer-color);
  opacity: 0.42;
}

.graph-layer-pill[data-active='true'] {
  border-color: color-mix(in srgb, var(--layer-color) 55%, transparent);
  color: var(--ua-text);
  background: color-mix(in srgb, var(--layer-color) 14%, var(--ua-elevated));
}

.graph-layer-pill[data-active='true'] span {
  opacity: 1;
  box-shadow: none;
}

.graph-explorer .ghost-button,
.graph-explorer .primary-button {
  min-height: 34px;
  border-radius: 12px;
  border-color: var(--ua-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 70%),
    var(--ua-elevated);
  color: var(--ua-text-secondary);
  box-shadow: none;
}

.graph-explorer .ghost-button:hover,
.graph-explorer .primary-button:hover {
  border-color: var(--ua-border-strong);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 70%),
    color-mix(in srgb, var(--ua-accent) 9%, var(--ua-elevated));
  color: var(--ua-accent-bright);
  transform: none;
}

.graph-explorer .primary-button {
  border-color: color-mix(in srgb, var(--ua-accent) 34%, transparent);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 62%),
    linear-gradient(135deg, var(--ua-accent), var(--ua-accent-dim));
  color: #fbf9ff;
}

.graph-search-rail {
  position: relative;
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.52rem 0.82rem;
  border-bottom: 1px solid var(--ua-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 78%),
    var(--ua-glass);
}

.graph-search-rail__icon {
  color: var(--ua-text-muted);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.graph-search-rail input,
.graph-field input,
.graph-field select {
  min-width: 0;
  border: 1px solid var(--ua-border);
  background: var(--ua-elevated);
  color: var(--ua-text);
}

.graph-search-rail input {
  flex: 1;
  min-height: 34px;
  padding: 0.48rem 0.62rem;
  border-radius: 10px;
  font-size: 0.88rem;
}

.graph-search-rail input::placeholder,
.graph-field input::placeholder {
  color: var(--ua-text-muted);
}

.graph-search-rail input:focus,
.graph-field input:focus,
.graph-field select:focus {
  border-color: color-mix(in srgb, var(--ua-accent) 62%, transparent);
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ua-accent) 14%, transparent);
}

.graph-search-mode {
  flex-wrap: nowrap;
  gap: 0.15rem;
  padding: 0.18rem;
  border: 1px solid var(--ua-border);
  border-radius: 999px;
  background: var(--ua-elevated);
}

.graph-search-mode span {
  padding: 0.32rem 0.55rem;
  border-radius: 999px;
  color: var(--ua-text-muted);
  font-size: 0.68rem;
  font-weight: 750;
}

.graph-search-mode span[data-active='true'] {
  background: color-mix(in srgb, var(--ua-accent) 15%, transparent);
  color: var(--ua-accent-bright);
}

.graph-result-count {
  color: var(--ua-text-muted);
  font-size: 0.8rem;
  white-space: nowrap;
}

.graph-search-dropdown {
  position: absolute;
  z-index: 8;
  top: calc(100% + 0.45rem);
  left: 4.8rem;
  right: 1rem;
  display: grid;
  gap: 0.45rem;
  padding: 0.55rem;
  border: 1px solid var(--ua-border-strong);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 72%),
    linear-gradient(135deg, color-mix(in srgb, var(--ua-accent) 8%, transparent), transparent 72%),
    var(--ua-elevated);
  box-shadow: 0 16px 32px rgba(72, 59, 43, 0.12);
  backdrop-filter: blur(10px);
}

.graph-search-dropdown__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.2rem 0.75rem;
  align-items: center;
  padding: 0.7rem 0.8rem;
  border: 1px solid transparent;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  text-align: left;
}

.graph-search-dropdown__item:hover {
  border-color: color-mix(in srgb, var(--ua-accent) 36%, transparent);
  background: color-mix(in srgb, var(--ua-accent) 9%, var(--ua-elevated));
}

.graph-search-dropdown__badge {
  grid-row: 1 / span 2;
  display: inline-flex;
  align-items: center;
  align-self: start;
  min-height: 24px;
  padding: 0.2rem 0.5rem;
  border: 1px solid color-mix(in srgb, var(--badge-color) 35%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--badge-color) 12%, transparent);
  color: var(--badge-color);
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.graph-search-dropdown__item strong {
  min-width: 0;
  color: var(--ua-text);
  font-size: 0.88rem;
  font-weight: 650;
}

.graph-search-dropdown__item small {
  min-width: 0;
  color: var(--ua-text-secondary);
  line-height: 1.45;
}

.graph-nav-strip {
  display: flex;
  gap: 0.9rem;
  align-items: center;
  justify-content: space-between;
  min-height: 42px;
  padding: 0.42rem 0.82rem;
  border-bottom: 1px solid var(--ua-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 78%),
    var(--ua-glass);
}

.graph-history,
.graph-mode-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}

.graph-history {
  min-width: 0;
  flex: 1 1 auto;
}

.graph-history__back,
.graph-history__crumb,
.graph-mode-pill,
.graph-focus-chip button {
  min-height: 30px;
  padding: 0.35rem 0.62rem;
  border: 1px solid var(--ua-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--ua-text-secondary);
  font-size: 0.72rem;
  font-weight: 750;
}

.graph-history__back:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.graph-history__crumb[data-active='true'],
.graph-mode-pill[data-active='true'] {
  border-color: color-mix(in srgb, var(--ua-accent) 42%, transparent);
  background: color-mix(in srgb, var(--ua-accent) 12%, transparent);
  color: var(--ua-accent-bright);
}

.graph-history__sep,
.graph-history__empty {
  color: var(--ua-text-muted);
  font-size: 0.76rem;
}

.graph-board {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  flex: 1;
  min-height: 0;
  gap: 0;
  align-items: stretch;
}

.graph-main {
  position: relative;
  min-width: 0;
  min-height: 760px;
}

.graph-focus-chip {
  position: absolute;
  z-index: 3;
  top: 0.9rem;
  left: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  max-width: min(calc(100% - 2rem), 520px);
  padding: 0.38rem 0.45rem 0.38rem 0.7rem;
  border: 1px solid color-mix(in srgb, var(--ua-accent) 34%, transparent);
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 75%),
    var(--ua-glass);
  box-shadow: 0 10px 24px rgba(72, 59, 43, 0.12);
  backdrop-filter: blur(8px);
}

.graph-focus-chip span {
  color: var(--ua-text-muted);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.graph-focus-chip strong {
  color: var(--ua-text);
  font-size: 0.82rem;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.graph-focus-chip button:hover,
.graph-history__back:hover:not(:disabled),
.graph-history__crumb:hover,
.graph-mode-pill:hover {
  border-color: var(--ua-border-strong);
  color: var(--ua-accent-bright);
}

.graph-main__meta {
  position: absolute;
  z-index: 3;
  top: 0.72rem;
  right: 0.78rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.55rem;
  max-width: min(720px, calc(100% - 2rem));
  color: var(--ua-text-muted);
  font-size: 0.7rem;
  pointer-events: none;
}

.graph-main__meta span {
  padding: 0.28rem 0.46rem;
  border: 1px solid var(--ua-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(8px);
}

.graph-main__meta kbd {
  display: inline-grid;
  place-items: center;
  min-width: 1.3rem;
  height: 1.3rem;
  margin: 0 0.1rem;
  border: 1px solid var(--ua-border-strong);
  border-radius: 5px;
  color: var(--ua-accent);
  font: 700 0.68rem 'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', monospace;
}

.graph-stage {
  --graph-bg: var(--ua-root);
  --graph-grid: var(--ua-dot);
  --graph-edge: var(--ua-edge);
  --graph-edge-hot: color-mix(in srgb, var(--ua-accent) 82%, white);
  --graph-label: var(--ua-text);
  position: relative;
  height: 100%;
  min-height: 760px;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background:
    radial-gradient(circle at 32% 22%, color-mix(in srgb, var(--ua-accent) 6%, transparent), transparent 20rem),
    radial-gradient(circle at 68% 68%, rgba(131, 121, 141, 0.045), transparent 20rem),
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 14rem),
    var(--graph-bg);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.graph-stage::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle, var(--graph-grid) 1px, transparent 1.5px),
    linear-gradient(180deg, transparent 0, transparent 31px, rgba(47, 73, 104, 0.028) 31px, rgba(47, 73, 104, 0.028) 32px);
  background-position: 0 0;
  background-size: 20px 20px, 100% 32px;
  mask-image: radial-gradient(circle at 50% 50%, #000 0%, transparent 88%);
  pointer-events: none;
}

.graph-stage[data-panning='true'] {
  cursor: grabbing;
}

.knowledge-graph {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 760px;
}

.graph-layer__bands,
.graph-layer__groups,
.graph-layer__labels {
  pointer-events: none;
}

.graph-band rect {
  fill: rgba(255, 255, 255, 0.03);
  stroke: rgba(47, 73, 104, 0.12);
  stroke-width: 1;
  stroke-dasharray: 5 9;
}

.graph-band text,
.graph-group text {
  fill: var(--ua-text-muted);
  font-family: 'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.graph-band[data-type='knowledge_base'] rect,
.graph-group[data-type='knowledge_base'] rect {
  stroke: rgba(47, 73, 104, 0.24);
}

.graph-band[data-type='document'] rect,
.graph-group[data-type='document'] rect {
  stroke: rgba(109, 135, 155, 0.2);
}

.graph-group rect {
  fill: rgba(255, 255, 255, 0.02);
  stroke-width: 1;
  stroke-dasharray: 4 7;
}

.graph-edge {
  fill: none;
  stroke: var(--graph-edge);
  stroke-width: var(--edge-width, 1px);
  stroke-linecap: round;
  opacity: var(--edge-opacity, 0.2);
  transition:
    opacity 180ms ease,
    stroke 180ms ease,
    stroke-width 180ms ease;
}

.graph-edge[data-type='extracts'] {
  stroke: rgba(109, 135, 155, 0.34);
}

.graph-edge--related {
  stroke: rgba(47, 73, 104, 0.26);
  stroke-dasharray: 3 8;
}

.graph-edge.is-highlighted {
  stroke: var(--graph-edge-hot);
  stroke-width: max(var(--edge-width, 1px), 1.9px);
  opacity: 0.78;
  filter: none;
}

.graph-edge.is-dimmed {
  opacity: 0.07;
}

.graph-node-card-svg {
  cursor: pointer;
  filter: drop-shadow(0 8px 18px rgba(72, 59, 43, 0.12));
  transition:
    opacity 180ms ease,
    filter 180ms ease;
}

.graph-node-card-svg__panel {
  fill: color-mix(in srgb, var(--ua-elevated) 94%, white);
  stroke: color-mix(in srgb, var(--node-color) 10%, var(--ua-border));
  stroke-width: 1px;
  transition:
    fill 180ms ease,
    stroke 180ms ease,
    stroke-width 180ms ease;
}

.graph-node-card-svg__bar {
  fill: color-mix(in srgb, var(--node-color) 78%, white 10%);
  opacity: 0.96;
}

.graph-node-card-svg__type,
.graph-node-card-svg__summary {
  fill: var(--node-color);
  font-family: 'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 9px;
  font-weight: 760;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.graph-node-card-svg__label {
  fill: var(--ua-text);
  font-family: 'Inter', 'Source Sans 3', sans-serif;
  font-size: 12.2px;
  font-weight: 620;
  letter-spacing: -0.01em;
}

.graph-node-card-svg__summary {
  fill: var(--ua-text-muted);
  font-size: 7.4px;
  font-weight: 620;
  letter-spacing: 0.02em;
  text-transform: none;
}

.graph-node-card-svg:hover,
.graph-node-card-svg.is-selected {
  filter: drop-shadow(0 12px 24px rgba(72, 59, 43, 0.14));
}

.graph-node-card-svg:hover .graph-node-card-svg__panel,
.graph-node-card-svg.is-selected .graph-node-card-svg__panel {
  stroke: var(--ua-accent);
  stroke-width: 1.45px;
  fill: color-mix(in srgb, var(--node-color) 8%, var(--ua-elevated));
}

.graph-node-card-svg:focus-visible {
  filter: drop-shadow(0 0 0 rgba(72, 59, 43, 0)) drop-shadow(0 0 0 5px rgba(47, 73, 104, 0.14));
}

.graph-node-card-svg:focus-visible .graph-node-card-svg__panel {
  stroke: color-mix(in srgb, var(--ua-accent-bright) 86%, white);
  stroke-width: 1.8px;
}

.graph-node-card-svg.is-current .graph-node-card-svg__panel {
  stroke: var(--ua-text);
}

.graph-node-card-svg.is-search-match .graph-node-card-svg__panel {
  stroke: var(--ua-accent-bright);
}

.graph-node-card-svg.is-dimmed {
  opacity: 0.18;
  filter: saturate(0.4);
}

.graph-label,
.graph-edge-label {
  fill: var(--graph-label);
  font-family: 'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.01em;
  paint-order: stroke;
  pointer-events: none;
  stroke: color-mix(in srgb, var(--ua-root) 86%, white);
  stroke-linejoin: round;
  stroke-width: 4px;
  text-anchor: middle;
  transition: opacity 180ms ease;
}

.graph-edge-label {
  fill: color-mix(in srgb, var(--ua-accent) 82%, white);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.graph-label.is-dimmed,
.graph-edge-label.is-dimmed {
  opacity: 0;
}

.graph-tooltip {
  position: absolute;
  z-index: 4;
  display: grid;
  gap: 0.18rem;
  max-width: 260px;
  padding: 0.72rem 0.85rem;
  border: 1px solid var(--ua-border-strong);
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 72%),
    linear-gradient(135deg, color-mix(in srgb, var(--ua-accent) 9%, transparent), transparent 65%),
    var(--ua-elevated);
  color: var(--ua-text);
  box-shadow: 0 10px 22px rgba(72, 59, 43, 0.12);
  backdrop-filter: blur(8px);
  pointer-events: none;
}

.graph-tooltip strong,
.graph-tooltip span,
.graph-tooltip small {
  margin: 0;
}

.graph-tooltip span,
.graph-tooltip small {
  color: var(--ua-text-secondary);
}

.graph-loading {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  gap: 0.8rem;
  color: var(--ua-text-secondary);
  background: color-mix(in srgb, var(--ua-root) 74%, transparent);
  backdrop-filter: blur(4px);
}

.graph-loading span {
  width: 52px;
  height: 52px;
  border: 2px solid var(--ua-border);
  border-top-color: var(--ua-accent);
  border-radius: 999px;
  animation: graph-spin 1s linear infinite;
}

.graph-side {
  display: grid;
  align-content: start;
  gap: 0;
  max-height: calc(100vh - 10rem);
  overflow: auto;
  border-left: 1px solid var(--ua-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 76%),
    color-mix(in srgb, var(--ua-surface) 90%, black);
}

.graph-panel {
  display: grid;
  gap: 1rem;
  padding: 1.1rem;
  border-bottom: 1px solid var(--ua-border);
}

.graph-side--dense .graph-panel {
  gap: 0.72rem;
  padding: 0.78rem 0.82rem;
}

.graph-panel__header {
  display: grid;
  gap: 0.25rem;
}

.graph-panel__header strong {
  color: var(--ua-text);
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 0.98rem;
  font-weight: 500;
}

.graph-control-grid,
.graph-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.graph-side--dense .graph-control-grid,
.graph-side--dense .graph-stat-grid,
.graph-side--dense .graph-search__results,
.graph-side--dense .graph-inspector,
.graph-side--dense .graph-relations {
  gap: 0.55rem;
}

.graph-field {
  display: grid;
  gap: 0.35rem;
}

.graph-field--wide {
  grid-column: 1 / -1;
}

.graph-field input,
.graph-field select {
  width: 100%;
  min-height: 34px;
  padding: 0.46rem 0.55rem;
  border-radius: 10px;
}

.graph-switches label {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 28px;
  padding: 0.26rem 0.48rem;
  border: 1px solid var(--ua-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--ua-text-secondary);
  font-size: 0.68rem;
  font-weight: 700;
}

.graph-switches input {
  margin: 0;
  accent-color: var(--ua-accent);
}

.graph-stat {
  display: grid;
  gap: 0.24rem;
  padding: 0.62rem 0.7rem;
  border: 1px solid var(--ua-border);
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 70%),
    var(--ua-elevated);
}

.graph-stat span {
  color: var(--ua-text-muted);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.graph-stat strong {
  color: var(--ua-text);
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 1.38rem;
  font-weight: 500;
}

.context-card,
.graph-node-card,
.graph-relation-card,
.graph-search__item {
  border: 1px solid var(--ua-border);
  background: var(--ua-elevated);
}

.context-card {
  padding: 0.7rem 0.75rem;
  border-radius: 10px;
}

.context-card p,
.graph-node-card p,
.graph-search__hint,
.graph-search__item small,
.graph-relation-card__header p,
.graph-relation-card__meta span {
  margin: 0;
  color: var(--ua-text-secondary);
  line-height: 1.55;
}

.knowledge-card__header,
.graph-relation-card__header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: start;
}

.inline-badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0.18rem 0.48rem;
  border: 1px solid color-mix(in srgb, var(--ua-accent) 22%, transparent);
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 65%),
    color-mix(in srgb, var(--ua-accent) 11%, transparent);
  color: color-mix(in srgb, var(--ua-accent-bright) 78%, white);
  font-size: 0.65rem;
  font-weight: 760;
  letter-spacing: 0.08em;
}

.graph-search__results,
.graph-inspector,
.graph-relations {
  display: grid;
  gap: 0.75rem;
}

.graph-search__item {
  display: grid;
  gap: 0.25rem;
  padding: 0.56rem 0.62rem;
  border-radius: 10px;
  text-align: left;
}

.graph-search__item strong {
  color: var(--ua-text);
  font-weight: 650;
}

.graph-search__item[data-active='true'],
.graph-search__item:hover {
  border-color: color-mix(in srgb, var(--ua-accent) 42%, transparent);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--ua-accent) 9%, transparent), transparent 70%),
    var(--ua-elevated);
}

.graph-node-card {
  display: grid;
  gap: 0.45rem;
  padding: 0.72rem 0.76rem;
  border-radius: 10px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 72%),
    linear-gradient(135deg, color-mix(in srgb, var(--node-card-color, var(--ua-accent)) 7%, transparent), transparent 62%),
    var(--ua-elevated);
}

.graph-node-card[data-type='knowledge_base'] {
  --node-card-color: #2f4968;
}

.graph-node-card[data-type='document'] {
  --node-card-color: #6d879b;
}

.graph-node-card[data-type='user'] {
  --node-card-color: #83798d;
}

.graph-node-card span {
  color: var(--node-card-color, var(--ua-accent));
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.graph-node-card strong {
  color: var(--ua-text);
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 1rem;
  font-weight: 500;
}

.graph-metadata {
  display: grid;
  grid-template-columns: minmax(0, 0.72fr) minmax(0, 1fr);
  gap: 0.7rem 0.85rem;
  margin: 0;
}

.graph-metadata dt {
  color: var(--ua-text-muted);
  font-size: 0.76rem;
  text-transform: capitalize;
}

.graph-metadata dd {
  margin: 0;
  color: var(--ua-text-secondary);
  font-size: 0.78rem;
  font-weight: 650;
  word-break: break-word;
}

.graph-relation-card {
  display: grid;
  gap: 0.75rem;
  padding: 0.68rem 0.74rem;
  border-color: var(--relation-border, var(--ua-border));
  border-radius: 9px;
  background: var(--relation-bg, var(--ua-elevated));
}

.graph-relation-card__header strong {
  color: var(--ua-text);
}

.graph-relation-card__meta,
.graph-relation-card__memory {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.memory-chip {
  display: inline-flex;
  padding: 0.18rem 0.42rem;
  border: 1px solid color-mix(in srgb, white 7%, var(--ua-border));
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 70%),
    rgba(255, 255, 255, 0.03);
  color: var(--ua-text-secondary);
  font-size: 0.64rem;
  font-weight: 650;
}

:deep(.empty-state) {
  color: var(--ua-text);
}

:deep(.empty-state p) {
  color: var(--ua-text-secondary);
}

/* Editorial cartography override: warm paper, restrained ink, no neon cast. */
.graph-explorer,
:global(:root[data-theme='light'] .graph-explorer),
:global(:root[data-theme='dark'] .graph-explorer) {
  --ua-root: #f8f3eb;
  --ua-surface: #f0e9de;
  --ua-elevated: #fffaf3;
  --ua-panel: #f5eee4;
  --ua-accent: #2f4968;
  --ua-accent-dim: #6d879b;
  --ua-accent-bright: #172c45;
  --ua-text: #25211d;
  --ua-text-secondary: #62584d;
  --ua-text-muted: #8a7f70;
  --ua-border: rgba(54, 58, 64, 0.12);
  --ua-border-strong: rgba(54, 58, 64, 0.22);
  --ua-glass: rgba(255, 252, 246, 0.9);
  --ua-edge: rgba(47, 73, 104, 0.24);
  --ua-edge-dim: rgba(47, 73, 104, 0.08);
  --ua-dot: rgba(47, 73, 104, 0.055);
  --ua-shadow: 0 18px 44px rgba(72, 59, 43, 0.08);
  background:
    radial-gradient(circle at 18% 0%, rgba(109, 135, 155, 0.14), transparent 24rem),
    radial-gradient(circle at 84% 22%, rgba(131, 121, 141, 0.08), transparent 28rem),
    linear-gradient(180deg, rgba(255, 255, 255, 0.68), transparent 10rem),
    var(--ua-root);
  color-scheme: light;
}

.graph-brand__mark,
.graph-explorer .primary-button {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.16), transparent),
    var(--ua-accent-bright);
  color: #fffaf3;
}

.graph-explorer .primary-button {
  border-color: var(--ua-border-strong);
}

.graph-stage {
  background:
    radial-gradient(circle at 32% 22%, rgba(47, 73, 104, 0.06), transparent 20rem),
    radial-gradient(circle at 68% 68%, rgba(131, 121, 141, 0.045), transparent 20rem),
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), transparent 14rem),
    var(--graph-bg);
}

.graph-stage::before {
  background-image:
    radial-gradient(circle, var(--graph-grid) 1px, transparent 1.5px),
    linear-gradient(180deg, transparent 0, transparent 31px, rgba(47, 73, 104, 0.028) 31px, rgba(47, 73, 104, 0.028) 32px);
}

.graph-band rect,
.graph-band[data-type='knowledge_base'] rect,
.graph-band[data-type='document'] rect,
.graph-group[data-type='knowledge_base'] rect,
.graph-group[data-type='document'] rect {
  stroke: rgba(214, 219, 228, 0.14);
}

.graph-edge[data-type='extracts'],
.graph-edge--related {
  stroke: rgba(47, 73, 104, 0.24);
}

.graph-node-card[data-type='knowledge_base'] {
  --node-card-color: #2f4968;
}

.graph-node-card[data-type='document'] {
  --node-card-color: #6d879b;
}

.graph-node-card[data-type='user'] {
  --node-card-color: #83798d;
}

@keyframes graph-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .graph-explorer {
    min-height: calc(100vh - 2rem);
    border-radius: 18px;
  }

  .graph-shell-header,
  .graph-search-rail,
  .graph-nav-strip {
    align-items: stretch;
    flex-direction: column;
  }

  .graph-brand {
    min-width: 0;
  }

  .graph-board {
    grid-template-columns: 1fr;
  }

  .graph-main {
    min-height: 560px;
  }

  .graph-search-dropdown {
    left: 1rem;
  }

  .graph-focus-chip {
    right: 1rem;
    max-width: none;
    flex-wrap: wrap;
  }

  .graph-stage {
    min-height: 560px;
  }

  .knowledge-graph {
    height: 560px;
    min-height: 560px;
  }

  .graph-side {
    max-height: none;
    border-top: 1px solid var(--ua-border);
    border-left: 0;
  }

  .graph-control-grid,
  .graph-stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
