<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
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

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  radius: number;
}

interface PositionedEdge extends GraphEdge {
  sourceNode: PositionedNode;
  targetNode: PositionedNode;
  path: string;
}

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const workspace = useWorkspaceStore();

const stageRef = ref<HTMLDivElement | null>(null);
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
const layoutMode = ref<GraphLayoutMode>('constellation');
const graphFilter = ref<GraphFilter>('all');
const searchQuery = ref('');
const viewportTween = ref<gsap.core.Tween | null>(null);
const hoveredNodeId = ref('');
const viewport = reactive({
  scale: 1,
  x: 0,
  y: 0,
  panning: false,
  lastClientX: 0,
  lastClientY: 0,
});

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
const selectedNeighborhood = computed(() => {
  const nodeId = selectedNodeId.value;
  const payload = visibleGraph.value;
  const related = new Set<string>();
  if (!payload || !nodeId) {
    return related;
  }

  related.add(nodeId);
  for (const edge of payload.edges) {
    if (edge.source === nodeId) {
      related.add(edge.target);
    }
    if (edge.target === nodeId) {
      related.add(edge.source);
    }
  }

  const selected = payload.nodes.find((node) => node.id === nodeId);
  if (selected?.parent_id) {
    related.add(selected.parent_id);
  }

  for (const node of payload.nodes) {
    if (node.parent_id === nodeId) {
      related.add(node.id);
    }
  }

  return related;
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

function relatedEdgeStyle(edge: GraphEdge) {
  const strength = relationshipStrength(
    typeof edge.metadata.relationship_score === 'number' ? edge.metadata.relationship_score : null,
  );
  const strokeWidth = 1.8 + strength * 3.2;
  const opacity = 0.26 + strength * 0.64;
  const dash = 10 - strength * 4;
  const gap = 10 - strength * 3;

  return {
    strokeWidth: `${strokeWidth}px`,
    strokeOpacity: String(opacity),
    stroke: `color-mix(in srgb, #5eead4 ${Math.round(44 + strength * 40)}%, #f59e0b)`,
    strokeDasharray: `${dash} ${gap}`,
  };
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

function createPositionedNode(node: GraphNode, x: number, y: number): PositionedNode {
  const radiusMap = {
    user: 25,
    knowledge_base: 30,
    document: 19,
    memory_entry: 11,
  } satisfies Record<GraphNode['node_type'], number>;

  return {
    ...node,
    x,
    y,
    radius: radiusMap[node.node_type],
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

      const midX = (sourceNode.x + targetNode.x) / 2;
      const curve = edge.edge_type === 'related' ? Math.max(70, Math.abs(sourceNode.y - targetNode.y) * 0.28) : 0;
      const path =
        edge.edge_type === 'related'
          ? `M ${sourceNode.x} ${sourceNode.y} C ${midX} ${sourceNode.y - curve}, ${midX} ${targetNode.y + curve}, ${targetNode.x} ${targetNode.y}`
          : `M ${sourceNode.x} ${sourceNode.y} C ${midX} ${sourceNode.y}, ${midX} ${targetNode.y}, ${targetNode.x} ${targetNode.y}`;

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

function buildTreeLayout(payload: GraphResult) {
  const width = 1240;
  const baseHeight = 680;
  const byDepth = new Map<number, GraphNode[]>();
  for (const node of payload.nodes) {
    const depthNodes = byDepth.get(node.depth) ?? [];
    depthNodes.push(node);
    byDepth.set(node.depth, depthNodes);
  }

  const maxDepth = Math.max(...payload.nodes.map((node) => node.depth), 1);
  const maxDepthSize = Math.max(...Array.from(byDepth.values()).map((items) => items.length), 1);
  const height = Math.max(baseHeight, maxDepthSize * 82 + 180);
  const depthGap = (width - 240) / maxDepth;
  const positioned = new Map<string, PositionedNode>();

  for (const [depth, nodes] of byDepth) {
    const ordered = [...nodes].sort((a, b) => {
      const parentCompare = (a.parent_id ?? '').localeCompare(b.parent_id ?? '');
      return parentCompare || a.label.localeCompare(b.label);
    });
    const laneGap = (height - 180) / Math.max(ordered.length, 1);
    ordered.forEach((node, index) => {
      positioned.set(node.id, createPositionedNode(node, 120 + depth * depthGap, 90 + laneGap * (index + 0.5)));
    });
  }

  return finalizeLayout(width, height, positioned, payload);
}

function buildConstellationLayout(payload: GraphResult) {
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
  positioned.set(rootNode.id, createPositionedNode(rootNode, centerX, centerY));

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
        ),
      );
    });
  }

  return finalizeLayout(width, height, positioned, payload);
}

function buildLayout(payload: GraphResult | null) {
  const width = 1240;
  const baseHeight = 680;
  if (!payload || !payload.nodes.length) {
    return {
      width,
      height: baseHeight,
      nodes: [] as PositionedNode[],
      edges: [] as PositionedEdge[],
      treeEdges: [] as PositionedEdge[],
      relatedEdges: [] as PositionedEdge[],
    };
  }

  return layoutMode.value === 'constellation' ? buildConstellationLayout(payload) : buildTreeLayout(payload);
}

const layout = computed(() => buildLayout(visibleGraph.value));

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

function handleWheel(event: WheelEvent) {
  event.preventDefault();
  zoomTo(viewport.scale + (event.deltaY < 0 ? 0.12 : -0.12), false);
}

function startPan(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) {
    return;
  }

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
  if (!focusMode.value || !selectedNodeId.value) {
    return false;
  }

  return !selectedNeighborhood.value.has(nodeId);
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
  if (!focusMode.value || !selectedNodeId.value) {
    return false;
  }

  return edge.source !== selectedNodeId.value && edge.target !== selectedNodeId.value;
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
    resetViewport(false);
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

onBeforeUnmount(() => {
  stopViewportAnimation();
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
    layoutMode.value = nextLayout === 'tree' || nextLayout === 'constellation' ? nextLayout : 'constellation';
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
            class="knowledge-graph"
            :viewBox="`0 0 ${layout.width} ${layout.height}`"
            role="img"
            aria-label="Knowledge graph"
          >
            <defs>
              <linearGradient id="graphRootFill" x1="0%" x2="100%" y1="0%" y2="100%">
                <stop offset="0%" stop-color="#f8fafc" />
                <stop offset="100%" stop-color="#93c5fd" />
              </linearGradient>
              <filter id="graphGlow" height="180%" width="180%" x="-40%" y="-40%">
                <feGaussianBlur result="coloredBlur" stdDeviation="5" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <g :transform="graphTransform">
              <g v-if="layoutMode === 'constellation'" class="knowledge-graph__rings">
                <circle :cx="layout.width / 2" :cy="layout.height / 2" r="185" />
                <circle :cx="layout.width / 2" :cy="layout.height / 2" r="335" />
                <circle :cx="layout.width / 2" :cy="layout.height / 2" r="485" />
              </g>

              <path
                v-for="edge in layout.relatedEdges"
                :key="edge.id"
                class="knowledge-graph__edge knowledge-graph__edge--related"
                :d="edge.path"
                :data-active="edge.source === selectedNodeId || edge.target === selectedNodeId"
                :data-muted="isEdgeMuted(edge)"
                :style="relatedEdgeStyle(edge)"
              />

              <path
                v-for="edge in layout.treeEdges"
                :key="edge.id"
                class="knowledge-graph__edge"
                :d="edge.path"
                :data-type="edge.edge_type"
                :data-active="edge.source === selectedNodeId || edge.target === selectedNodeId"
                :data-muted="isEdgeMuted(edge)"
              />

              <template v-for="edge in layout.relatedEdges" :key="`label-${edge.id}`">
                <g
                  v-if="selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId)"
                  class="knowledge-graph__edge-label"
                  :transform="`translate(${(edge.sourceNode.x + edge.targetNode.x) / 2}, ${(edge.sourceNode.y + edge.targetNode.y) / 2})`"
                >
                  <text>{{ edgeLabel(edge) }}</text>
                </g>
              </template>

              <g
                v-for="node in layout.nodes"
                :key="node.id"
                class="knowledge-graph__node"
                :class="`knowledge-graph__node--${node.node_type}`"
                :data-selected="node.id === selectedNodeId"
                :data-muted="isNodeMuted(node.id)"
                :data-match="isNodeSearchMatch(node.id)"
                :data-current="isCurrentWorkspaceDocument(node.id)"
                :transform="`translate(${node.x}, ${node.y})`"
                tabindex="0"
                role="button"
                @pointerdown.stop
                @mouseenter="setHoveredNode(node.id)"
                @mouseleave="clearHoveredNode"
                @focus="setHoveredNode(node.id)"
                @blur="clearHoveredNode"
                @click.stop="selectNode(node.id)"
                @dblclick.stop="selectNode(node.id); centerOnNode(node.id)"
                @keydown.enter="selectNode(node.id)"
              >
                <circle :r="node.radius + 12" class="knowledge-graph__halo" />
                <circle :r="node.radius" class="knowledge-graph__dot" />
                <text
                  v-if="node.node_type !== 'memory_entry' || node.id === selectedNodeId"
                  class="knowledge-graph__label"
                  :x="node.radius + 14"
                  y="-5"
                >
                  {{ truncateLabel(node.label) }}
                </text>
                <text
                  v-if="node.node_type !== 'memory_entry' || node.id === selectedNodeId"
                  class="knowledge-graph__sub"
                  :x="node.radius + 14"
                  y="15"
                >
                  {{ nodeDescription(node) }}
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
