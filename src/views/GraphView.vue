<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue';
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
import SectionHeader from '@/components/common/SectionHeader.vue';
import SurfacePanel from '@/components/common/SurfacePanel.vue';
import { api } from '@/lib/api';
import { mergeQuery, readQueryBoolean, readQueryFloat, readQueryNumber, readQueryString } from '@/lib/route-query';
import { useSessionStore } from '@/stores/session';
import { useWorkspaceStore } from '@/stores/workspace';
import type { GraphEdge, GraphNode, GraphQueryOptions, GraphResult } from '@/lib/types';

type GraphScope = 'knowledge_base' | 'user' | 'document';
type GraphLayoutMode = 'tree' | 'constellation';
type GraphFilter = 'all' | 'documents' | 'memory';

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
}

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const workspace = useWorkspaceStore();

const stageRef = ref<HTMLDivElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const graph = ref<GraphResult | null>(null);
const loading = ref(false);
const error = ref('');
const selectedNodeId = ref('');
const scope = ref<GraphScope>('knowledge_base');
const includeMemory = ref(false);
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

const selectedNode = computed(() =>
  graph.value?.nodes.find((node) => node.id === selectedNodeId.value) ?? null,
);

const currentDocumentId = computed(() => {
  if (graphDocumentId.value && workspace.filteredDocuments.some((item) => item.id === graphDocumentId.value)) {
    return graphDocumentId.value;
  }
  return workspace.selectedDocumentId || workspace.filteredDocuments[0]?.id || '';
});

const graphOptions = computed<GraphQueryOptions>(() => ({
  includeMemory: includeMemory.value,
  includeRelationships: includeRelationships.value,
  minSharedMemoryCount: minSharedMemoryCount.value,
  minRelationshipScore: minRelationshipScore.value,
  maxRelatedEdges: maxRelatedEdges.value,
  relationshipScope: scope.value === 'document' ? 'knowledge_base' : undefined,
}));

const visibleGraph = computed<GraphResult | null>(() => {
  const payload = graph.value;
  if (!payload || graphFilter.value === 'all') {
    return payload;
  }

  let nodes = payload.nodes.filter((node) => node.node_type !== 'memory_entry');
  if (graphFilter.value === 'memory') {
    const relatedNodeIds = new Set<string>();
    for (const node of payload.nodes) {
      if (node.node_type !== 'memory_entry') {
        continue;
      }
      relatedNodeIds.add(node.id);
      if (node.parent_id) {
        relatedNodeIds.add(node.parent_id);
      }
    }

    for (const node of payload.nodes) {
      if (relatedNodeIds.has(node.id) && node.parent_id) {
        relatedNodeIds.add(node.parent_id);
      }
    }

    nodes = payload.nodes.filter((node) => relatedNodeIds.has(node.id) || node.id === payload.root_node_id);
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
    { label: 'Memory', value: payload?.node_type_counts.memory_entry ?? 0 },
  ];
});

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

  if (selectedNode.value.node_type === 'document' || selectedNode.value.node_type === 'memory_entry') {
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

  if (selectedNode.value.node_type === 'memory_entry') {
    const documentId = selectedNode.value.parent_id;
    return typeof documentId === 'string' ? documentId : '';
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
        metadataText(node.metadata.entry_type),
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
          : node.node_type === 'memory_entry'
            ? metadataText(node.metadata.entry_type)
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
    return `${sharedCount} shared · ${Math.round(score * 100)}%`;
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
    '--relation-border': `rgba(94, 234, 212, ${0.14 + strength * 0.34})`,
    '--relation-bg': `linear-gradient(135deg, rgba(94, 234, 212, ${0.04 + strength * 0.12}), rgba(245, 158, 11, ${0.02 + strength * 0.08}) 82%), var(--bg-strong)`,
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

  if (node.node_type === 'memory_entry') {
    const entryType = typeof node.metadata.entry_type === 'string' ? node.metadata.entry_type : 'memory';
    return entryType;
  }

  if (node.node_type === 'knowledge_base') {
    const documentCount = typeof node.metadata.document_count === 'number' ? node.metadata.document_count : 0;
    return `${documentCount} docs`;
  }

  return 'workspace root';
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
    user: '#7dd3fc',
    knowledge_base: '#c4b5fd',
    document: '#f59e0b',
    memory_entry: '#22d3ee',
  } satisfies Record<GraphNode['node_type'], string>;

  return palette[nodeType];
}

function nodeStyle(node: PositionedNode) {
  const color = nodeColor(node.node_type);
  return {
    '--node-color': color,
    '--node-glow': `${color}66`,
  };
}

function createPositionedNode(node: GraphNode, x: number, y: number, degree = 0): PositionedNode {
  const radius = nodeRadius(node, degree);
  const metricsMap = {
    user: { width: 172, height: 52 },
    knowledge_base: { width: 188, height: 56 },
    document: { width: 176, height: 52 },
    memory_entry: { width: 156, height: 44 },
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

function createPositionedEdges(payload: GraphResult, positioned: Map<string, PositionedNode>) {
  return payload.edges
    .map((edge) => {
      const sourceNode = positioned.get(edge.source);
      const targetNode = positioned.get(edge.target);
      if (!sourceNode || !targetNode) {
        return null;
      }

      const direction = targetNode.x >= sourceNode.x ? 1 : -1;
      const sourceX = sourceNode.x + direction * (sourceNode.width / 2);
      const targetX = targetNode.x - direction * (targetNode.width / 2);
      const sourceY = sourceNode.y;
      const targetY = targetNode.y;
      const deltaX = Math.abs(targetX - sourceX);
      const curveOffset = Math.min(Math.max(deltaX * 0.35, 36), 96);
      const path = `M ${sourceX} ${sourceY} C ${sourceX + direction * curveOffset} ${sourceY}, ${targetX - direction * curveOffset} ${targetY}, ${targetX} ${targetY}`;

      return {
        ...edge,
        sourceNode,
        targetNode,
        path,
      };
    })
    .filter((edge): edge is PositionedEdge => Boolean(edge));
}

function finalizeLayout(width: number, height: number, positioned: Map<string, PositionedNode>, payload: GraphResult) {
  const edges = createPositionedEdges(payload, positioned);
  return {
    width,
    height,
    nodes: Array.from(positioned.values()),
    edges,
    treeEdges: edges.filter((edge) => edge.edge_type !== 'related'),
    relatedEdges: edges.filter((edge) => edge.edge_type === 'related'),
  };
}

function buildTreeLayout(payload: GraphResult, degreeMap: Map<string, number>) {
  const width = 1600;
  const baseHeight = 900;
  const centerX = width / 2;

  const byDepth = new Map<number, GraphNode[]>();
  for (const node of payload.nodes) {
    const depthNodes = byDepth.get(node.depth) ?? [];
    depthNodes.push(node);
    byDepth.set(node.depth, depthNodes);
  }

  const maxDepth = Math.max(...payload.nodes.map((node) => node.depth), 1);
  const maxDepthSize = Math.max(...Array.from(byDepth.values()).map((items) => items.length), 1);
  const height = Math.max(baseHeight, maxDepthSize * 110 + 220);
  const horizontalGap = Math.max(180, Math.floor((width / 2 - 170) / Math.max(maxDepth, 1)));
  const positioned = new Map<string, PositionedNode>();

  for (const [depth, nodes] of [...byDepth.entries()].sort((a, b) => a[0] - b[0])) {
    const ordered = [...nodes].sort((a, b) => {
      const parentCompare = (a.parent_id ?? '').localeCompare(b.parent_id ?? '');
      return parentCompare || a.label.localeCompare(b.label);
    });

    if (depth === 0) {
      const rootY = height / 2;
      ordered.forEach((node) => {
        positioned.set(node.id, createPositionedNode(node, centerX, rootY, degreeMap.get(node.id) ?? 0));
      });
      continue;
    }

    const leftNodes: GraphNode[] = [];
    const rightNodes: GraphNode[] = [];
    ordered.forEach((node, index) => {
      if (index % 2 === 0) {
        rightNodes.push(node);
      } else {
        leftNodes.push(node);
      }
    });

    const positionSide = (sideNodes: GraphNode[], direction: -1 | 1) => {
      if (!sideNodes.length) {
        return;
      }
      const verticalGap = Math.max(84, (height - 180) / Math.max(sideNodes.length, 1));
      const startY = height / 2 - ((sideNodes.length - 1) * verticalGap) / 2;
      const x = centerX + direction * depth * horizontalGap;
      sideNodes.forEach((node, index) => {
        positioned.set(
          node.id,
          createPositionedNode(node, x, startY + index * verticalGap, degreeMap.get(node.id) ?? 0),
        );
      });
    };

    positionSide(leftNodes, -1);
    positionSide(rightNodes, 1);
  }

  return finalizeLayout(width, height, positioned, payload);
}

function buildConstellationLayout(payload: GraphResult, degreeMap: Map<string, number>) {
  const width = 1240;
  const height = Math.max(760, Math.ceil(payload.nodes.length / 18) * 180 + 580);
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

  const ringBaseRadius = 185;
  for (const [ringIndex, nodes] of rings) {
    const ordered = [...nodes].sort((a, b) => {
      const typeCompare = a.node_type.localeCompare(b.node_type);
      return typeCompare || a.label.localeCompare(b.label);
    });
    const radius = ringBaseRadius + (Math.min(ringIndex, 4) - 1) * 150;
    const angleStart = ringIndex % 2 === 0 ? -Math.PI / 4 : -Math.PI / 2;
    ordered.forEach((node, index) => {
      const angle = angleStart + (Math.PI * 2 * index) / Math.max(ordered.length, 1);
      const orbitRadius = radius + Math.min(ordered.length, 10) * 4 + node.depth * 8;
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

function forceDistance(edge: ForceEdge) {
  const weight = edgeWeight(edge);
  if (edge.edge_type === 'related') {
    return 170 - weight * 42;
  }
  if (edge.edge_type === 'extracts') {
    return 92;
  }
  return 132 - weight * 24;
}

function forceStrength(edge: ForceEdge) {
  const weight = edgeWeight(edge);
  if (edge.edge_type === 'related') {
    return 0.14 + weight * 0.18;
  }
  return 0.38 + weight * 0.22;
}

function stopGraphSimulation() {
  graphSimulation.value?.stop();
  graphSimulation.value = null;
}

function clampNodeToBounds(node: PositionedNode) {
  const padding = node.radius + 18;
  node.x = Math.min(Math.max(node.x ?? layout.value.width / 2, padding), layout.value.width - padding);
  node.y = Math.min(Math.max(node.y ?? layout.value.height / 2, padding), layout.value.height - padding);
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
    .force('charge', forceManyBody<PositionedNode>().strength((node) => -150 - Math.sqrt(node.degree) * 38))
    .force('center', forceCenter<PositionedNode>(layout.value.width / 2, layout.value.height / 2).strength(0.035))
    .force(
      'collide',
      forceCollide<PositionedNode>()
        .radius((node) => node.radius + 5)
        .strength(0.78)
        .iterations(2),
    )
    .force('x', forceX<PositionedNode>(layout.value.width / 2).strength(layoutMode.value === 'tree' ? 0.024 : 0.012))
    .force('y', forceY<PositionedNode>(layout.value.height / 2).strength(layoutMode.value === 'tree' ? 0.018 : 0.01))
    .alpha(0.95)
    .alphaDecay(0.035)
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

    selectedNodeId.value = graph.value.root_node_id || graph.value.nodes[0]?.id || '';
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Unable to load graph.';
    graph.value = null;
  } finally {
    loading.value = false;
  }
}

function selectNode(nodeId: string) {
  selectedNodeId.value = nodeId;
}

function locateNode(nodeId: string) {
  selectedNodeId.value = nodeId;
  centerOnNode(nodeId, true);
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

  const targetDocumentId =
    selectedNode.value.node_type === 'memory_entry'
      ? typeof selectedNode.value.metadata.document_id === 'string'
        ? selectedNode.value.metadata.document_id
        : ''
      : selectedNode.value.entity_id;

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

  const targetDocumentId =
    targetNode.node_type === 'memory_entry'
      ? typeof targetNode.metadata.document_id === 'string'
        ? targetNode.metadata.document_id
        : ''
      : targetNode.node_type === 'document'
        ? targetNode.entity_id
        : '';

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
  if (!nodeId) {
    return;
  }
  centerOnNode(nodeId, true);
  if (hoveredNodeId.value && hoveredNodeId.value !== nodeId) {
    clearHoveredNode();
  }
});

watch(graphFilter, (nextFilter) => {
  if (nextFilter === 'memory' && !includeMemory.value) {
    includeMemory.value = true;
  }
});

watch(searchResults, (results) => {
  if (!results.length || selectedNodeId.value) {
    return;
  }
  selectedNodeId.value = results[0].id;
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
      selectedNodeId.value = layout.value.nodes[0]?.id ?? '';
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
      selectedNodeId.value = payload.root_node_id || payload.nodes[0]?.id || '';
    }
    resetViewport(false);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  stopViewportAnimation();
  stopGraphSimulation();
  clearHoveredNode();
  endPan();
});

watch(
  () => route.query,
  (query) => {
    const nextScope = readQueryString(query, 'scope');
    scope.value =
      nextScope === 'user' || nextScope === 'document' || nextScope === 'knowledge_base'
        ? nextScope
        : 'knowledge_base';
    includeMemory.value = readQueryBoolean(query, 'memory', false);
    includeRelationships.value = readQueryBoolean(query, 'relationships', true);
    minSharedMemoryCount.value = readQueryNumber(query, 'shared', 2);
    minRelationshipScore.value = readQueryFloat(query, 'score', 0.35);
    maxRelatedEdges.value = readQueryNumber(query, 'edges', 80);
    graphDocumentId.value = readQueryString(query, 'graphDoc');
    searchQuery.value = readQueryString(query, 'find');
    const nextLayout = readQueryString(query, 'layout');
    layoutMode.value = nextLayout === 'tree' || nextLayout === 'constellation' ? nextLayout : 'tree';
    const nextFilter = readQueryString(query, 'filter');
    graphFilter.value = nextFilter === 'documents' || nextFilter === 'memory' || nextFilter === 'all' ? nextFilter : 'all';
  },
  { immediate: true, deep: true },
);

watch(
  [
    scope,
    includeMemory,
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
      memory: includeMemory.value ? '1' : undefined,
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
      includeMemory.value,
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
  <div class="view-stack">
    <SectionHeader
      eyebrow="Graph"
      title="Knowledge map."
      description="A local Obsidian-style view for collections, documents, extracted memory, and shared signals."
    />

    <section class="graph-board">
      <SurfacePanel eyebrow="Map" title="Structure">
        <div class="graph-toolbar">
          <label class="graph-field">
            <span>Scope</span>
            <select v-model="scope">
              <option value="knowledge_base">Collection</option>
              <option value="document">Document</option>
              <option value="user">Workspace</option>
            </select>
          </label>

          <label v-if="scope === 'document'" class="graph-field">
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

          <label class="graph-toggle">
            <input v-model="includeRelationships" type="checkbox" />
            <span>Relations</span>
          </label>

          <label class="graph-toggle">
            <input v-model="includeMemory" type="checkbox" />
            <span>Memory</span>
          </label>

          <label class="graph-toggle">
            <input v-model="focusMode" type="checkbox" />
            <span>Focus</span>
          </label>

          <label class="graph-field">
            <span>Layout</span>
            <select v-model="layoutMode">
              <option value="constellation">Constellation</option>
              <option value="tree">Tree</option>
            </select>
          </label>

          <label class="graph-field">
            <span>Layer</span>
            <select v-model="graphFilter">
              <option value="all">All</option>
              <option value="documents">Docs</option>
              <option value="memory">Memory</option>
            </select>
          </label>

          <label class="graph-field graph-field--search">
            <span>Find</span>
            <input
              v-model="searchQuery"
              type="search"
              placeholder="Doc, memory, type..."
              @keydown.enter.prevent="locateFirstSearchResult"
            />
          </label>

          <label class="graph-field graph-field--compact">
            <span>Shared</span>
            <input v-model.number="minSharedMemoryCount" min="1" max="20" type="number" />
          </label>

          <label class="graph-field graph-field--compact">
            <span>Score</span>
            <input v-model.number="minRelationshipScore" max="1" min="0" step="0.05" type="number" />
          </label>

          <button class="ghost-button" type="button" :disabled="loading" @click="loadGraph">
            {{ loading ? 'Loading' : 'Refresh' }}
          </button>

          <button class="ghost-button" type="button" @click="zoomOut()">
            -
          </button>

          <button class="ghost-button" type="button" @click="zoomIn()">
            +
          </button>

          <button class="ghost-button" type="button" @click="resetViewport()">
            Reset View
          </button>

          <button
            class="ghost-button"
            type="button"
            :disabled="!searchResults.length"
            @click="locateFirstSearchResult"
          >
            Locate
          </button>
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
              <g class="graph-layer__edges">
                <line
                  v-for="edge in layout.edges"
                  :key="edge.id"
                  class="graph-edge"
                  :class="{
                    'is-highlighted': isEdgeHighlighted(edge),
                    'is-dimmed': isEdgeMuted(edge),
                    'graph-edge--related': edge.edge_type === 'related',
                  }"
                  :x1="edge.sourceNode.x"
                  :y1="edge.sourceNode.y"
                  :x2="edge.targetNode.x"
                  :y2="edge.targetNode.y"
                  :data-type="edge.edge_type"
                  :style="edgeRenderStyle(edge)"
                />
              </g>

              <g class="graph-layer__nodes">
                <circle
                  v-for="node in layout.nodes"
                  :key="node.id"
                  class="graph-node"
                  :class="{
                    'is-selected': node.id === selectedNodeId,
                    'is-dimmed': isNodeMuted(node.id),
                    'is-search-match': isNodeSearchMatch(node.id),
                    'is-current': isCurrentWorkspaceDocument(node.id),
                  }"
                  :cx="node.x"
                  :cy="node.y"
                  :r="node.radius"
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

                <text
                  v-for="node in layout.nodes"
                  v-show="isNodeLabelVisible(node)"
                  :key="`node-label-${node.id}`"
                  class="graph-label"
                  :class="{ 'is-dimmed': isNodeMuted(node.id) }"
                  :x="node.x"
                  :y="node.y + node.radius + 15"
                >
                  {{ truncateLabel(node.label, node.degree >= 5 ? 28 : 20) }}
                </text>
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
      </SurfacePanel>

      <aside class="graph-side">
        <SurfacePanel eyebrow="Search" title="Node finder">
          <div class="graph-search">
            <div class="graph-search__input">
              <input
                v-model="searchQuery"
                type="search"
                placeholder="Search visible nodes"
                @keydown.enter.prevent="locateFirstSearchResult"
              />
              <span>{{ searchResults.length }}</span>
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
                <strong>{{ node.label }}</strong>
                <span>{{ node.node_type.replace('_', ' ') }} · {{ nodeDescription(node) }}</span>
              </button>
            </div>

            <p v-else class="graph-search__hint">
              Search the current graph slice and jump straight to a node.
            </p>
          </div>
        </SurfacePanel>

        <SurfacePanel eyebrow="Snapshot" title="Current graph">
          <div class="graph-stat-grid">
            <article v-for="stat in graphStats" :key="stat.label" class="graph-stat">
              <span>{{ stat.label }}</span>
              <strong>{{ stat.value }}</strong>
            </article>
          </div>

          <article class="context-card">
            <header class="knowledge-card__header">
              <strong>{{ workspace.currentKnowledgeBase?.name ?? 'Workspace' }}</strong>
              <span class="inline-badge">{{ graph?.scope ?? 'idle' }}</span>
            </header>
            <p>{{ relatedEdgeCount }} related edges · {{ layoutMode }} · generated {{ generatedAt }}</p>
          </article>
        </SurfacePanel>

        <SurfacePanel eyebrow="Node" title="Selection">
          <div v-if="selectedNode" class="graph-inspector">
            <article class="graph-node-card" :data-type="selectedNode.node_type">
              <span>{{ selectedNode.node_type.replace('_', ' ') }}</span>
              <strong>{{ selectedNode.label }}</strong>
              <p>{{ nodeDescription(selectedNode) }}</p>
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
        </SurfacePanel>

        <SurfacePanel eyebrow="Relations" title="Why connected">
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
                <span>{{ connection.sharedMemoryCount }} shared</span>
                <span v-if="connection.sharedMemoryTypes.length">
                  {{ connection.sharedMemoryTypes.slice(0, 3).join(' · ') }}
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
        </SurfacePanel>

        <SurfacePanel eyebrow="Legend" title="Reading">
          <div class="graph-legend">
            <span data-type="knowledge_base">Collection</span>
            <span data-type="document">Document</span>
            <span data-type="memory_entry">Memory</span>
            <span data-type="related">Related</span>
          </div>
        </SurfacePanel>
      </aside>
    </section>
  </div>
</template>

<style scoped>
.graph-stage {
  --graph-bg: #111315;
  --graph-bg-elevated: #181b1f;
  --graph-grid: rgba(255, 255, 255, 0.035);
  --graph-edge: rgba(220, 226, 235, 0.28);
  --graph-edge-hot: rgba(248, 250, 252, 0.82);
  --graph-label: #e5e7eb;
  position: relative;
  min-height: 780px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 28px;
  background:
    radial-gradient(circle at 22% 20%, rgba(196, 181, 253, 0.14), transparent 28%),
    radial-gradient(circle at 78% 74%, rgba(34, 211, 238, 0.12), transparent 30%),
    linear-gradient(135deg, #0d0f12 0%, var(--graph-bg) 48%, #17110b 100%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.025),
    0 28px 80px rgba(0, 0, 0, 0.24);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.graph-stage::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--graph-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--graph-grid) 1px, transparent 1px);
  background-size: 34px 34px;
  mask-image: radial-gradient(circle at 50% 50%, #000 0%, transparent 76%);
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
  height: 780px;
  min-width: 0;
  min-height: 780px;
}

.graph-layer__labels {
  pointer-events: none;
}

.graph-edge {
  stroke: var(--graph-edge);
  stroke-width: var(--edge-width, 1px);
  stroke-linecap: round;
  opacity: var(--edge-opacity, 0.28);
  transition:
    opacity 180ms ease,
    stroke 180ms ease,
    stroke-width 180ms ease;
}

.graph-edge[data-type='extracts'] {
  stroke: rgba(245, 158, 11, 0.46);
}

.graph-edge--related {
  stroke: color-mix(in srgb, #22d3ee 62%, #f59e0b);
  stroke-dasharray: 5 8;
}

.graph-edge.is-highlighted {
  stroke: var(--graph-edge-hot);
  stroke-width: max(var(--edge-width, 1px), 2.2px);
  opacity: 0.92;
}

.graph-edge.is-dimmed {
  opacity: 0.05;
}

.graph-node {
  fill: var(--node-color);
  stroke: var(--graph-bg);
  stroke-width: 2.4px;
  cursor: grab;
  filter:
    drop-shadow(0 0 9px var(--node-glow))
    drop-shadow(0 8px 16px rgba(0, 0, 0, 0.28));
  transition:
    opacity 180ms ease,
    fill 180ms ease,
    stroke 180ms ease,
    stroke-width 180ms ease,
    filter 180ms ease;
}

.graph-node:hover,
.graph-node.is-selected {
  stroke: rgba(255, 255, 255, 0.9);
  stroke-width: 3px;
  filter:
    drop-shadow(0 0 16px var(--node-glow))
    drop-shadow(0 14px 26px rgba(0, 0, 0, 0.36));
}

.graph-node.is-current {
  stroke: #f8fafc;
}

.graph-node.is-search-match {
  stroke: #fef08a;
}

.graph-node.is-dimmed {
  opacity: 0.13;
  filter: none;
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
  stroke: rgba(10, 12, 14, 0.82);
  stroke-linejoin: round;
  stroke-width: 4px;
  text-anchor: middle;
  transition: opacity 180ms ease;
}

.graph-edge-label {
  fill: rgba(226, 232, 240, 0.78);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.graph-label.is-dimmed,
.graph-edge-label.is-dimmed {
  opacity: 0;
}

.graph-tooltip {
  border-color: rgba(148, 163, 184, 0.22);
  border-radius: 16px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.08), transparent 60%),
    rgba(17, 19, 21, 0.92);
  color: #f8fafc;
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(14px);
}

.graph-tooltip span,
.graph-tooltip small {
  color: rgba(226, 232, 240, 0.68);
}

.graph-loading {
  color: rgba(226, 232, 240, 0.74);
}

.graph-loading span {
  border-color: rgba(226, 232, 240, 0.18);
  border-top-color: #22d3ee;
}

@media (max-width: 640px) {
  .graph-stage {
    min-height: 560px;
    border-radius: 22px;
  }

  .knowledge-graph {
    height: 560px;
    min-height: 560px;
  }
}
</style>
