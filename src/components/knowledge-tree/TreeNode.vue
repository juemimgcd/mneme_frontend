<template>
  <div
    :key="node.id"
    :data-node-id="node.id"
    :class="[
      'tree-node',
      `tree-node--${node.nodeType}`,
      `tree-level-${node.depth}`,
      {
        'tree-node--expanded': isExpanded,
        'tree-node--selected': isSelected,
        'tree-node--highlighted': isHighlighted,
        'tree-node--search-match': isSearchMatch,
        'tree-node--loading': node.state === 'loading',
        'tree-node--error': node.state === 'error'
      }
    ]"
    @click="handleClick"
    @keydown.enter="handleClick"
    @keydown.space="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    role="treeitem"
    :aria-selected="isSelected"
    tabindex="0"
  >
    <!-- 展开/折叠按钮 -->
    <button
      v-if="node.hasChildren"
      class="tree-node__toggle"
      @click.stop="handleToggle"
      @keydown.enter.stop="handleToggle"
      @keydown.space.stop="handleToggle"
      :aria-label="`${isExpanded ? '折叠' : '展开'} ${node.label}`"
      :aria-expanded="isExpanded"
    >
      <span class="tree-node__toggle-icon">▶</span>
    </button>
    <div v-else class="tree-node__toggle tree-node__toggle--empty" />

    <!-- 节点图标 -->
    <div class="tree-node__icon">
      {{ getNodeIcon(node.nodeType) }}
    </div>

    <!-- 节点标签 -->
    <div class="tree-node__content">
      <div class="tree-node__label">{{ node.label }}</div>
      <div v-if="node.description" class="tree-node__description">
        {{ node.description }}
      </div>
    </div>

    <!-- 元数据 -->
    <div class="tree-node__meta">
      <span v-if="node.metadata?.importance_score" class="tree-node__importance">
        {{ renderImportance(node.metadata.importance_score) }}
      </span>
      <span v-if="node.childrenCount" class="tree-node__count">
        {{ node.childrenCount }}
      </span>
    </div>

    <!-- 加载状态 -->
    <div v-if="node.state === 'loading'" class="tree-node__spinner" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TreeNode as TreeNodeType } from '../types'

interface Props {
  node: TreeNodeType
  isSelected?: boolean
  isHighlighted?: boolean
  isSearchMatch?: boolean
}

interface Emits {
  (e: 'toggle', nodeId: string): void
  (e: 'select', nodeId: string): void
  (e: 'hover', nodeId: string): void
  (e: 'unhover', nodeId: string): void
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  isHighlighted: false,
  isSearchMatch: false
})

const emit = defineEmits<Emits>()

const isExpanded = computed(() => props.node.isExpanded)

function handleToggle() {
  emit('toggle', props.node.id)
}

function handleClick() {
  emit('select', props.node.id)
}

function handleMouseEnter() {
  emit('hover', props.node.id)
}

function handleMouseLeave() {
  emit('unhover', props.node.id)
}

function getNodeIcon(nodeType: string): string {
  const icons: Record<string, string> = {
    user: '👤',
    knowledge_base: '📚',
    document: '📄',
    memory_entry: '💡'
  }
  return icons[nodeType] || '◆'
}

function renderImportance(score: number): string {
  const stars = Math.round(score * 5)
  return '⭐'.repeat(Math.max(1, stars))
}
</script>

<style scoped>
.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin: 4px 0;
  border-radius: 6px;
  border: 1px solid var(--node-border, #d0d0d0);
  background: var(--node-bg, #ffffff);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, #1a1a1a);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px var(--edge-shadow, rgba(0, 0, 0, 0.08));
  user-select: none;
}

.tree-node:hover {
  border-color: var(--node-border-hover, #808080);
  box-shadow: 0 2px 4px var(--edge-shadow, rgba(0, 0, 0, 0.08));
}

.tree-node.tree-node--selected {
  border-color: var(--node-border-selected, #1a1a1a);
  background: var(--bg-tertiary, #f0f0f0);
  font-weight: 600;
}

.tree-node.tree-node--highlighted {
  border-color: var(--node-border-selected, #1a1a1a);
  box-shadow: 0 0 0 2px rgba(26, 26, 26, 0.1);
}

.tree-node.tree-node--search-match {
  background: rgba(0, 102, 204, 0.05);
  border-color: #0066cc;
}

.tree-node.tree-node--loading {
  opacity: 0.6;
  pointer-events: none;
}

.tree-node.tree-node--error {
  border-color: #cc0000;
  background: rgba(204, 0, 0, 0.05);
}

/* 层级缩进 */
.tree-level-0 {
  margin-left: 0;
}

.tree-level-1 {
  margin-left: 24px;
}

.tree-level-2 {
  margin-left: 48px;
}

.tree-level-3 {
  margin-left: 72px;
}

/* 展开/折叠按钮 */
.tree-node__toggle {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-secondary, #666666);
  cursor: pointer;
  font-size: 10px;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.tree-node__toggle:hover {
  color: var(--text-primary, #1a1a1a);
}

.tree-node.tree-node--expanded .tree-node__toggle {
  transform: rotate(90deg);
}

.tree-node__toggle--empty {
  cursor: default;
}

.tree-node__toggle-icon {
  display: inline-block;
}

/* 节点图标 */
.tree-node__icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

/* 节点内容 */
.tree-node__content {
  flex: 1;
  min-width: 0;
}

.tree-node__label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.tree-node__description {
  font-size: 11px;
  color: var(--text-tertiary, #999999);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

/* 元数据 */
.tree-node__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  font-size: 11px;
  color: var(--text-tertiary, #999999);
  flex-shrink: 0;
}

.tree-node__importance {
  font-size: 10px;
  letter-spacing: 1px;
}

.tree-node__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: var(--bg-tertiary, #f0f0f0);
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
}

/* 加载状态 */
.tree-node__spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--bg-tertiary, #f0f0f0);
  border-top-color: var(--state-loading, #0066cc);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 记忆条目特殊样式 */
.tree-node--memory_entry {
  font-size: calc(12px + var(--importance, 0) * 2px);
  padding: calc(6px + var(--importance, 0) * 2px)
    calc(10px + var(--importance, 0) * 2px);
}

.tree-node--memory_entry[data-type='concept'] {
  border-color: #0066cc;
}

.tree-node--memory_entry[data-type='insight'] {
  border-color: #009900;
}

.tree-node--memory_entry[data-type='question'] {
  border-color: #cc6600;
}

.tree-node--memory_entry[data-type='action'] {
  border-color: #cc0066;
}
</style>
