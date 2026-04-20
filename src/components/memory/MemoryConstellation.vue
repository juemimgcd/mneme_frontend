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
import { PanelRightOpen } from 'lucide-vue-next';
import type { KnowledgeBase, MemoryLibrary, MemoryThemeGroup, MemoryTimelineEntry } from '@/lib/types';
import type { MemoryGraphFocus, MemoryGraphFocusKind } from '@/components/memory/types';

type GraphNodeKind = MemoryGraphFocusKind | 'knowledge_base';

interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  kind: GraphNodeKind;
  radius: number;
  targetX: number;
  targetY: number;
  summary: string;
  count: number;
  entryNames: string[];
  strokeColor: string;
  coreColor: string;
  textColor: string;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  weight: number;
  stroke: string;
}

const props = defineProps<{
  library: MemoryLibrary;
  knowledgeBases: KnowledgeBase[];
  activeKnowledgeBaseId?: string;
}>();

const emit = defineEmits<{
  (event: 'focus-change', value: MemoryGraphFocus | null): void;
  (event: 'request-rail'): void;
}>();

const stageWidth = 1280;
const stageHeight = 840;
const minScale = 0.64;
const maxScale = 2.5;
const rootNodeId = 'memory-root';
const palette = ['#6d8dff', '#5fd0b1', '#64d2ff', '#a78bfa', '#f59e0b', '#fb7185'];

const stageRef = ref<HTMLDivElement | null>(null);
const selectedNodeId = ref('');
const hoveredNodeId = ref('');
const layoutNodes = ref<GraphNode[]>([]);
const layoutLinks = ref<GraphLink[]>([]);
const simulation = shallowRef<Simulation<GraphNode, GraphLink> | null>(null);

const viewport = reactive({
  scale: 1,
  x: 0,
  y: 0,
  isPanning: false,
  pointerId: -1,
  startClientX: 0,
  startClientY: 0,
  originX: 0,
  originY: 0,
  moved: false,
});

const drag = reactive({
  nodeId: '',
  pointerId: -1,
  moved: false,
});

const stageTransform = computed(() => `translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`);
const zoomLabel = computed(() => `${Math.round(viewport.scale * 100)}%`);
const selectedNode = computed(() => layoutNodes.value.find((node) => node.id === selectedNodeId.value) ?? null);
const hoveredNode = computed(() => layoutNodes.value.find((node) => node.id === hoveredNodeId.value) ?? null);

const highlightedIds = computed(() => {
  if (!selectedNode.value) {
    return new Set<string>();
  }

  const ids = new Set<string>([selectedNode.value.id]);
  for (const link of layoutLinks.value) {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    if (sourceId === selectedNode.value.id) {
      ids.add(targetId);
    }
    if (targetId === selectedNode.value.id) {
      ids.add(sourceId);
    }
  }
  return ids;
});

watch(
  () => [props.library, props.knowledgeBases, props.activeKnowledgeBaseId],
  () => {
    const graph = buildGraphModel();
    restartSimulation(graph.nodes, graph.links);
    resetViewport();
    if (selectedNodeId.value && !graph.nodes.some((node) => node.id === selectedNodeId.value)) {
      selectedNodeId.value = '';
      emit('focus-change', null);
    }
  },
  { deep: true, immediate: true },
);

onBeforeUnmount(() => {
  simulation.value?.stop();
  simulation.value = null;
});

function buildGraphModel() {
  const timelineByName = new Map<string, MemoryTimelineEntry>();
  for (const entry of props.library.timeline) {
    timelineByName.set(entry.entry_name, entry);
  }

  const themeByName = new Map(props.library.by_theme.map((theme) => [theme.theme_name, theme]));
  const orderedEntryNames = collectEntryNames().sort((left, right) => {
    const leftStamp = timelineByName.get(left)?.created_at ?? '';
    const rightStamp = timelineByName.get(right)?.created_at ?? '';
    return rightStamp.localeCompare(leftStamp) || left.localeCompare(right);
  });

  const activeKnowledgeBaseId = props.activeKnowledgeBaseId || props.knowledgeBases[0]?.id || 'active';
  const activeKnowledgeBase =
    props.knowledgeBases.find((item) => item.id === activeKnowledgeBaseId) ?? props.knowledgeBases[0];
  const knowledgeBases = props.knowledgeBases.length ? props.knowledgeBases : activeKnowledgeBase ? [activeKnowledgeBase] : [];
  const colorByKnowledgeBase = new Map(
    knowledgeBases.map((item, index) => [item.id, palette[index % palette.length]]),
  );
  const activeColor = colorByKnowledgeBase.get(activeKnowledgeBaseId) ?? palette[0];

  const nodes: GraphNode[] = [
    {
      id: rootNodeId,
      label: 'AI Knowledge Base',
      kind: 'root',
      radius: 14,
      targetX: stageWidth / 2,
      targetY: 104,
      summary: `${orderedEntryNames.length} extracted notes are mapped in the current workspace.`,
      count: orderedEntryNames.length,
      entryNames: orderedEntryNames,
      strokeColor: '#8fb2ff',
      coreColor: '#8fb2ff',
      textColor: '#eff5ff',
    },
  ];
  const links: GraphLink[] = [];

  const sortedKnowledgeBases = [...knowledgeBases].sort((left, right) => {
    if (left.id === activeKnowledgeBaseId) return -1;
    if (right.id === activeKnowledgeBaseId) return 1;
    return left.name.localeCompare(right.name);
  });

  sortedKnowledgeBases.forEach((item, index) => {
    const color = colorByKnowledgeBase.get(item.id) ?? palette[index % palette.length];
    nodes.push({
      id: `kb:${item.id}`,
      label: item.name,
      kind: 'knowledge_base',
      radius: 8,
      targetX: distributedX(index, sortedKnowledgeBases.length, stageWidth, 180),
      targetY: 238,
      summary: `${item.document_count} docs and ${item.memory_count} notes in ${item.name}.`,
      count: item.memory_count,
      entryNames: item.id === activeKnowledgeBaseId ? orderedEntryNames : [],
      strokeColor: color,
      coreColor: color,
      textColor: '#eff5ff',
    });

    links.push({
      id: `link:root:${item.id}`,
      source: rootNodeId,
      target: `kb:${item.id}`,
      weight: 0.9,
      stroke: color,
    });
  });

  if (!activeKnowledgeBase) {
    return { nodes, links };
  }

  const typeNames = Object.keys(props.library.by_type).sort((left, right) => left.localeCompare(right));
  const themeNames = props.library.by_theme.map((item) => item.theme_name);
  const clusters = [
    ...typeNames.map((typeName, index) => ({
      id: `type:${typeName}`,
      label: typeName,
      kind: 'type' as const,
      targetX: distributedX(index, Math.max(typeNames.length, 1), stageWidth, 160),
      targetY: 392,
      summary: `${uniqueNames(props.library.by_type[typeName] ?? []).length} notes currently grouped as ${typeName}.`,
      count: uniqueNames(props.library.by_type[typeName] ?? []).length,
      entryNames: uniqueNames(props.library.by_type[typeName] ?? []),
    })),
    ...themeNames.map((themeName, index) => {
      const theme = themeByName.get(themeName) as MemoryThemeGroup;
      return {
        id: `theme:${themeName}`,
        label: themeName,
        kind: 'theme' as const,
        targetX: distributedX(index, Math.max(themeNames.length, 1), stageWidth, 160),
        targetY: 516,
        summary: `${theme.count} notes reinforce the theme ${themeName}.`,
        count: theme.count,
        entryNames: uniqueNames(theme.entries),
      };
    }),
  ];

  clusters.forEach((cluster) => {
    nodes.push({
      ...cluster,
      radius: 5,
      strokeColor: activeColor,
      coreColor: activeColor,
      textColor: '#eff5ff',
    });

    links.push({
      id: `link:kb:${cluster.id}`,
      source: `kb:${activeKnowledgeBaseId}`,
      target: cluster.id,
      weight: 0.76,
      stroke: activeColor,
    });
  });

  orderedEntryNames.forEach((entryName, index) => {
    const timelineEntry = timelineByName.get(entryName);
    const entryType = resolveEntryType(entryName, props.library.by_type, timelineEntry?.entry_type);
    const preferredCluster = clusters.find((item) => item.id === `type:${entryType}`) ??
      clusters.find((item) => item.entryNames.includes(entryName)) ??
      clusters[index % Math.max(clusters.length, 1)];

    const columnX = preferredCluster?.targetX ?? stageWidth / 2;
    const columnEntries = orderedEntryNames.filter((item) => {
      const itemType = resolveEntryType(item, props.library.by_type, timelineByName.get(item)?.entry_type);
      return (
        (preferredCluster?.id === `type:${itemType}`) ||
        (preferredCluster && props.library.by_theme.some((theme) => theme.theme_name === preferredCluster.label && theme.entries.includes(item)))
      );
    });
    const localIndex = Math.max(columnEntries.indexOf(entryName), 0);

    nodes.push({
      id: `entry:${entryName}`,
      label: entryName,
      kind: 'entry',
      radius: 4,
      targetX: columnX + ((localIndex % 2 === 0 ? -1 : 1) * Math.min(18 + (localIndex % 3) * 10, 44)),
      targetY: 664 + localIndex * 40,
      summary:
        timelineEntry?.summary ??
        `Referenced in the ${entryType} layer, but the full timeline summary is not available yet.`,
      count: 1,
      entryNames: [entryName],
      strokeColor: activeColor,
      coreColor: activeColor,
      textColor: '#eff5ff',
    });

    if (entryType && typeNames.includes(entryType)) {
      links.push({
        id: `link:type-entry:${entryType}:${entryName}`,
        source: `type:${entryType}`,
        target: `entry:${entryName}`,
        weight: 0.68,
        stroke: activeColor,
      });
    }

    for (const theme of props.library.by_theme) {
      if (theme.entries.includes(entryName)) {
        links.push({
          id: `link:theme-entry:${theme.theme_name}:${entryName}`,
          source: `theme:${theme.theme_name}`,
          target: `entry:${entryName}`,
          weight: 0.56,
          stroke: activeColor,
        });
      }
    }
  });

  return { nodes, links };
}

function collectEntryNames() {
  const names = new Set<string>();
  for (const entry of props.library.timeline) {
    names.add(entry.entry_name);
  }
  for (const entries of Object.values(props.library.by_type)) {
    for (const entryName of entries) {
      names.add(entryName);
    }
  }
  for (const theme of props.library.by_theme) {
    for (const entryName of theme.entries) {
      names.add(entryName);
    }
  }
  return Array.from(names);
}

function distributedX(index: number, total: number, width: number, padding: number) {
  if (total <= 1) {
    return width / 2;
  }
  const usable = width - padding * 2;
  return padding + (usable * index) / (total - 1);
}

function uniqueNames(values: string[]) {
  return Array.from(new Set(values));
}

function resolveEntryType(
  entryName: string,
  byType: MemoryLibrary['by_type'],
  fallbackType?: string,
) {
  if (fallbackType) {
    return fallbackType;
  }

  for (const [typeName, entries] of Object.entries(byType)) {
    if (entries.includes(entryName)) {
      return typeName;
    }
  }

  return 'memory';
}

function restartSimulation(nodes: GraphNode[], links: GraphLink[]) {
  simulation.value?.stop();

  const nextNodes = nodes.map((node) => ({
    ...node,
    x: node.targetX,
    y: node.targetY,
    fx: null,
    fy: null,
  }));
  const nextLinks = links.map((link) => ({ ...link }));

  simulation.value = forceSimulation<GraphNode, GraphLink>(nextNodes)
    .force(
      'link',
      forceLink<GraphNode, GraphLink>(nextLinks)
        .id((node) => node.id)
        .distance((link) => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          if (sourceId === rootNodeId) return 132;
          if (sourceId.startsWith('kb:')) return 118;
          if (sourceId.startsWith('type:') || sourceId.startsWith('theme:')) return 84;
          return 76;
        })
        .strength((link) => link.weight),
    )
    .force('charge', forceManyBody<GraphNode>().strength((node) => (node.kind === 'root' ? -420 : -140)))
    .force('center', forceCenter(stageWidth / 2, stageHeight / 2))
    .force('collide', forceCollide<GraphNode>().radius((node) => node.radius + 12).iterations(3))
    .force('x', forceX<GraphNode>((node) => node.targetX).strength(0.22))
    .force('y', forceY<GraphNode>((node) => node.targetY).strength(0.46))
    .alpha(0.94)
    .alphaDecay(0.08)
    .on('tick', () => {
      layoutNodes.value = [...nextNodes];
      layoutLinks.value = [...nextLinks];
    });
}

function buildFocus(node: GraphNode): MemoryGraphFocus {
  return {
    id: node.id,
    kind: node.kind === 'knowledge_base' ? 'root' : node.kind,
    label: node.label,
    summary: node.summary,
    count: node.count,
    entryNames: node.entryNames,
  };
}

function selectNode(node: GraphNode) {
  selectedNodeId.value = node.id;
  emit('focus-change', buildFocus(node));
}

function focusNode(node: GraphNode) {
  const targetScale = clampScale(1.5);
  viewport.scale = targetScale;
  viewport.x = stageWidth / 2 - (node.x ?? node.targetX) * targetScale;
  viewport.y = stageHeight / 2 - (node.y ?? node.targetY) * targetScale;
  selectNode(node);
}

function clearSelection() {
  selectedNodeId.value = '';
  emit('focus-change', null);
}

function resetViewport() {
  viewport.scale = 1;
  viewport.x = 0;
  viewport.y = 0;
}

function clampScale(value: number) {
  return Math.min(maxScale, Math.max(minScale, value));
}

function handleWheel(event: WheelEvent) {
  const stage = stageRef.value;
  if (!stage) {
    return;
  }

  const rect = stage.getBoundingClientRect();
  const scaleX = stageWidth / rect.width;
  const scaleY = stageHeight / rect.height;
  const anchorX = (event.clientX - rect.left) * scaleX;
  const anchorY = (event.clientY - rect.top) * scaleY;
  const factor = event.deltaY > 0 ? 0.92 : 1.08;
  const nextScale = clampScale(viewport.scale * factor);

  if (nextScale === viewport.scale) {
    return;
  }

  viewport.x = anchorX - ((anchorX - viewport.x) / viewport.scale) * nextScale;
  viewport.y = anchorY - ((anchorY - viewport.y) / viewport.scale) * nextScale;
  viewport.scale = nextScale;
}

function pointerToGraphPoint(event: PointerEvent) {
  const stage = stageRef.value;
  if (!stage) {
    return null;
  }

  const rect = stage.getBoundingClientRect();
  const scaleX = stageWidth / rect.width;
  const scaleY = stageHeight / rect.height;
  const svgX = (event.clientX - rect.left) * scaleX;
  const svgY = (event.clientY - rect.top) * scaleY;
  return {
    x: (svgX - viewport.x) / viewport.scale,
    y: (svgY - viewport.y) / viewport.scale,
  };
}

function handleStagePointerDown(event: PointerEvent) {
  const target = event.target;
  if (target instanceof Element && target.closest('.memory-node')) {
    return;
  }

  const currentTarget = event.currentTarget;
  if (!(currentTarget instanceof HTMLDivElement)) {
    return;
  }

  viewport.isPanning = true;
  viewport.pointerId = event.pointerId;
  viewport.startClientX = event.clientX;
  viewport.startClientY = event.clientY;
  viewport.originX = viewport.x;
  viewport.originY = viewport.y;
  viewport.moved = false;
  currentTarget.setPointerCapture(event.pointerId);
}

function handleStagePointerMove(event: PointerEvent) {
  if (!viewport.isPanning || viewport.pointerId !== event.pointerId) {
    return;
  }

  const stage = stageRef.value;
  if (!stage) {
    return;
  }

  const rect = stage.getBoundingClientRect();
  const scaleX = stageWidth / rect.width;
  const scaleY = stageHeight / rect.height;
  const deltaX = (event.clientX - viewport.startClientX) * scaleX;
  const deltaY = (event.clientY - viewport.startClientY) * scaleY;

  viewport.x = viewport.originX + deltaX;
  viewport.y = viewport.originY + deltaY;
  if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
    viewport.moved = true;
  }
}

function stopStagePanning(event?: PointerEvent) {
  if (!viewport.isPanning) {
    return;
  }

  const currentTarget = event?.currentTarget;
  if (event && currentTarget instanceof HTMLDivElement && currentTarget.hasPointerCapture(event.pointerId)) {
    currentTarget.releasePointerCapture(event.pointerId);
  }

  viewport.isPanning = false;
  viewport.pointerId = -1;
}

function handleStageClick(event: MouseEvent) {
  if (viewport.moved) {
    viewport.moved = false;
    return;
  }

  const target = event.target;
  if (target instanceof Element && target.closest('.memory-node')) {
    return;
  }

  clearSelection();
}

function handleNodePointerDown(event: PointerEvent, node: GraphNode) {
  const currentTarget = event.currentTarget;
  if (!(currentTarget instanceof SVGGElement)) {
    return;
  }

  drag.nodeId = node.id;
  drag.pointerId = event.pointerId;
  drag.moved = false;
  currentTarget.setPointerCapture(event.pointerId);

  node.fx = node.x ?? node.targetX;
  node.fy = node.y ?? node.targetY;
  simulation.value?.alphaTarget(0.24).restart();
}

function handleNodePointerMove(event: PointerEvent, node: GraphNode) {
  if (drag.nodeId !== node.id || drag.pointerId !== event.pointerId) {
    return;
  }

  const point = pointerToGraphPoint(event);
  if (!point) {
    return;
  }

  node.fx = point.x;
  node.fy = point.y;
  drag.moved = true;
}

function handleNodePointerUp(event: PointerEvent, node: GraphNode) {
  if (drag.nodeId !== node.id || drag.pointerId !== event.pointerId) {
    return;
  }

  const currentTarget = event.currentTarget;
  if (currentTarget instanceof SVGGElement && currentTarget.hasPointerCapture(event.pointerId)) {
    currentTarget.releasePointerCapture(event.pointerId);
  }

  node.fx = null;
  node.fy = null;
  simulation.value?.alphaTarget(0);
  drag.nodeId = '';
  drag.pointerId = -1;
}

function handleNodeClick(node: GraphNode) {
  if (drag.moved) {
    drag.moved = false;
    return;
  }

  selectNode(node);
}

function isHighlighted(node: GraphNode) {
  return highlightedIds.value.size === 0 || highlightedIds.value.has(node.id);
}

function isLinkActive(link: GraphLink) {
  if (!selectedNode.value) {
    return true;
  }

  const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
  const targetId = typeof link.target === 'string' ? link.target : link.target.id;
  return sourceId === selectedNode.value.id || targetId === selectedNode.value.id;
}

function nodeTransform(node: GraphNode) {
  return `translate(${node.x ?? node.targetX}, ${node.y ?? node.targetY})`;
}

function linkCoords(link: GraphLink) {
  const sourceNode = typeof link.source === 'string' ? null : link.source;
  const targetNode = typeof link.target === 'string' ? null : link.target;
  return {
    x1: sourceNode?.x ?? stageWidth / 2,
    y1: sourceNode?.y ?? stageHeight / 2,
    x2: targetNode?.x ?? stageWidth / 2,
    y2: targetNode?.y ?? stageHeight / 2,
  };
}

function formatKind(kind: GraphNodeKind) {
  if (kind === 'root') return 'Atlas';
  if (kind === 'knowledge_base') return 'KB';
  if (kind === 'type') return 'Type';
  if (kind === 'theme') return 'Theme';
  return 'Entry';
}
</script>

<template>
  <div class="memory-constellation">
    <div
      ref="stageRef"
      class="memory-stage"
      :data-panning="viewport.isPanning"
      @click="handleStageClick"
      @pointerdown="handleStagePointerDown"
      @pointermove="handleStagePointerMove"
      @pointerup="stopStagePanning"
      @pointerleave="stopStagePanning"
      @pointercancel="stopStagePanning"
      @wheel.prevent="handleWheel"
    >
      <div class="memory-stage__title">Memory Atlas</div>
      <div class="memory-stage__tip">Drag background | Drag nodes | Zoom wheel | Double click focus</div>

      <div class="memory-stage__controls">
        <button class="memory-stage__button" type="button" @click.stop="emit('request-rail')">
          <PanelRightOpen :size="14" />
          Rail
        </button>
        <span>{{ zoomLabel }}</span>
        <button class="memory-stage__button" type="button" @click.stop="resetViewport">Reset</button>
      </div>

      <svg class="memory-stage__svg" :viewBox="`0 0 ${stageWidth} ${stageHeight}`" role="img" aria-label="Memory graph">
        <g :transform="stageTransform">
          <g class="memory-stage__guides">
            <line x1="90" :x2="stageWidth - 90" y1="104" y2="104" />
            <line x1="120" :x2="stageWidth - 120" y1="238" y2="238" />
            <line x1="120" :x2="stageWidth - 120" y1="392" y2="392" />
            <line x1="120" :x2="stageWidth - 120" y1="516" y2="516" />
            <line x1="120" :x2="stageWidth - 120" y1="664" y2="664" />
          </g>

          <g class="memory-stage__lane-labels">
            <text :x="stageWidth / 2" y="72">Root</text>
            <text :x="stageWidth / 2" y="206">Knowledge Bases</text>
            <text :x="stageWidth / 2" y="360">Type Groups</text>
            <text :x="stageWidth / 2" y="484">Theme Groups</text>
            <text :x="stageWidth / 2" y="632">Entries</text>
          </g>

          <g class="memory-stage__links">
            <line
              v-for="link in layoutLinks"
              :key="link.id"
              v-bind="linkCoords(link)"
              :data-active="isLinkActive(link)"
              :stroke="link.stroke"
            />
          </g>

          <g class="memory-stage__nodes">
            <g
              v-for="node in layoutNodes"
              :key="node.id"
              class="memory-node"
              :data-kind="node.kind"
              :data-selected="selectedNodeId === node.id"
              :data-muted="!isHighlighted(node)"
              :transform="nodeTransform(node)"
              tabindex="0"
              role="button"
              @click.stop="handleNodeClick(node)"
              @dblclick.stop="focusNode(node)"
              @focus="hoveredNodeId = node.id"
              @blur="hoveredNodeId = ''"
              @mouseenter="hoveredNodeId = node.id"
              @mouseleave="hoveredNodeId = ''"
              @keydown.enter.prevent="selectNode(node)"
              @keydown.space.prevent="selectNode(node)"
              @pointerdown.stop="handleNodePointerDown($event, node)"
              @pointermove.stop="handleNodePointerMove($event, node)"
              @pointerup.stop="handleNodePointerUp($event, node)"
              @pointercancel.stop="handleNodePointerUp($event, node)"
            >
              <circle class="memory-node__ring" :r="node.radius" :stroke="node.strokeColor" />
              <circle class="memory-node__shell" :r="Math.max(node.radius - 1, 2)" />
              <circle class="memory-node__core" :r="Math.max(node.radius / 2.4, 2)" :fill="node.coreColor" />
              <text class="memory-node__label" :dx="node.radius + 6" dy="0.32em" :fill="node.textColor">
                {{ node.label }}
              </text>
            </g>
          </g>
        </g>
      </svg>
    </div>

    <article class="memory-focus-card">
      <header>
        <span>{{ formatKind((hoveredNode ?? selectedNode)?.kind ?? 'root') }}</span>
        <strong>{{ (hoveredNode ?? selectedNode)?.label ?? 'AI Knowledge Base' }}</strong>
      </header>
      <p>
        {{
          (hoveredNode ?? selectedNode)?.summary ??
          'The memory tree now opens as a vertical atlas, with the background free for panning and the rail moved out of the main canvas.'
        }}
      </p>
    </article>
  </div>
</template>

<style scoped>
.memory-constellation {
  display: grid;
  gap: 1rem;
  min-height: 100%;
}

.memory-stage {
  position: relative;
  overflow: hidden;
  min-height: 100%;
  border-radius: 24px;
  background:
    radial-gradient(circle at 18% 12%, rgba(109, 141, 255, 0.14), transparent 20rem),
    radial-gradient(circle at 82% 18%, rgba(95, 208, 177, 0.08), transparent 18rem),
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 12rem),
    #0f1620;
  cursor: grab;
  touch-action: none;
}

.memory-stage[data-panning='true'] {
  cursor: grabbing;
}

.memory-stage__title,
.memory-stage__tip,
.memory-stage__controls {
  position: absolute;
  z-index: 1;
}

.memory-stage__title {
  top: 20px;
  left: 20px;
  color: #eff5ff;
  font-size: 16px;
  opacity: 0.85;
  pointer-events: none;
}

.memory-stage__tip {
  bottom: 20px;
  left: 20px;
  color: #76859b;
  font-size: 11px;
  opacity: 0.7;
  pointer-events: none;
}

.memory-stage__controls {
  top: 18px;
  right: 18px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border: 1px solid rgba(49, 66, 88, 0.72);
  border-radius: 999px;
  background: rgba(19, 27, 38, 0.84);
  color: #76859b;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
}

.memory-stage__button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #eff5ff;
  cursor: pointer;
  font: inherit;
}

.memory-stage__svg {
  display: block;
  width: 100%;
  min-height: min(82vh, 1040px);
  user-select: none;
}

.memory-stage__guides line {
  stroke: rgba(118, 133, 155, 0.14);
  stroke-dasharray: 4 10;
}

.memory-stage__lane-labels text {
  fill: rgba(118, 133, 155, 0.72);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-anchor: middle;
  text-transform: uppercase;
}

.memory-stage__links line {
  stroke-linecap: round;
  stroke-opacity: 0.45;
  stroke-width: 0.9;
  transition: opacity 180ms ease, stroke-width 180ms ease;
}

.memory-stage__links line[data-active='false'] {
  opacity: 0.14;
}

.memory-stage__links line[data-active='true'] {
  stroke-width: 1.05;
}

.memory-node {
  cursor: grab;
  transition: opacity 180ms ease;
}

.memory-node[data-muted='true'] {
  opacity: 0.18;
}

.memory-node:focus-visible {
  outline: none;
}

.memory-node__ring {
  fill: transparent;
  stroke-width: 1;
}

.memory-node__shell {
  fill: rgba(15, 22, 32, 0.96);
}

.memory-node__label {
  font-size: 11px;
  font-weight: 400;
  opacity: 0.9;
  pointer-events: none;
  user-select: none;
}

.memory-node[data-selected='true'] .memory-node__ring,
.memory-node:hover .memory-node__ring {
  stroke-width: 1.2;
}

.memory-node[data-selected='true'] .memory-node__label,
.memory-node:hover .memory-node__label {
  opacity: 1;
}

.memory-focus-card {
  display: grid;
  gap: 0.5rem;
  padding: 1rem 1.1rem;
  border: 1px solid rgba(49, 66, 88, 0.72);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 74%),
    rgba(19, 27, 38, 0.9);
}

.memory-focus-card span {
  margin: 0;
  color: #76859b;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.memory-focus-card strong {
  margin: 0.25rem 0 0;
  color: #eff5ff;
  font-family: 'Fraunces', serif;
  font-size: 1.2rem;
  font-weight: 500;
}

.memory-focus-card p {
  margin: 0;
  color: #b3bfd0;
  line-height: 1.65;
}

@media (max-width: 900px) {
  .memory-stage__svg {
    min-height: 74vh;
  }
}

@media (max-width: 720px) {
  .memory-stage {
    border-radius: 18px;
  }

  .memory-stage__controls {
    top: 16px;
    right: 16px;
  }
}
</style>
