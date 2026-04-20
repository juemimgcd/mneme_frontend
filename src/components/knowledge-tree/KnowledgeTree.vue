<template>
  <div class="knowledge-tree-container">
    <!-- 错误提示 -->
    <div v-if="error" class="tree-error">
      <div class="tree-error__content">
        <span class="tree-error__icon">⚠️</span>
        <div class="tree-error__message">
          <p class="tree-error__title">加载失败</p>
          <p class="tree-error__text">{{ error }}</p>
        </div>
        <button class="tree-error__retry" @click="handleRetry">重试</button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-else-if="loading" class="tree-loading">
      <div class="tree-loading__spinner"></div>
      <p class="tree-loading__text">加载知识树中...</p>
    </div>

    <!-- 正常内容 -->
    <template v-else>
      <!-- 搜索栏 -->
      <div class="tree-search">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索节点..."
          class="tree-search__input"
          @input="handleSearch"
        />
        <button class="tree-search__clear" @click="clearSearch" v-if="searchQuery">
          ✕
        </button>
      </div>

      <!-- 树形容器 -->
      <div class="tree-wrapper">
        <div class="tree-canvas" ref="treeCanvas">
          <!-- SVG 连接线 -->
          <svg class="tree-edges" ref="edgesSvg">
            <line
              v-for="edge in visibleEdges"
              :key="edge.id"
              :x1="getNodePosition(edge.source).x"
              :y1="getNodePosition(edge.source).y"
              :x2="getNodePosition(edge.target).x"
              :y2="getNodePosition(edge.target).y"
              :class="['tree-edge', `tree-edge--${edge.edgeType}`]"
              @mouseenter="highlightEdge(edge.id)"
              @mouseleave="unhighlightEdge(edge.id)"
            />
          </svg>

          <!-- 树节点 -->
          <div class="tree-nodes">
            <TreeNode
              v-for="node in visibleNodes"
              :key="node.id"
              :node="node"
              :is-selected="selectedNodeId === node.id"
              :is-highlighted="highlightedNodeIds.has(node.id)"
              :is-search-match="searchMatches.has(node.id)"
              @toggle="handleToggle"
              @select="handleSelectNode"
              @hover="handleHoverNode"
              @unhover="handleUnhoverNode"
            />
          </div>
        </div>

        <!-- 侧边栏详情面板 -->
        <TreePanel
          v-if="selectedNode"
          :node="selectedNode"
          :related-nodes="relatedNodes"
          @close="selectedNodeId = null"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import TreeNode from './TreeNode.vue'
import TreePanel from './TreePanel.vue'
import { useTreeData } from './composables/useTreeData'
import { useTreeInteraction } from './composables/useTreeInteraction'
import type { TreeNode as TreeNodeType } from './types'

// 数据管理
const { nodes, edges, loading, error, loadTree, expandNode, collapseNode } = useTreeData()

// 交互管理
const {
  selectedNodeId,
  highlightedNodeIds,
  expandedNodeIds,
  handleSelectNode,
  handleHoverNode,
  handleUnhoverNode,
  highlightEdge,
  unhighlightEdge
} = useTreeInteraction()

// 搜索
const searchQuery = ref('')
const searchMatches = ref(new Set<string>())

// 引用
const treeCanvas = ref<HTMLDivElement>()
const edgesSvg = ref<SVGSVGElement>()

// 计算属性
const selectedNode = computed(() =>
  nodes.value.find(n => n.id === selectedNodeId.value)
)

const relatedNodes = computed(() => {
  if (!selectedNode.value) return []
  
  return edges.value
    .filter(e => 
      e.source === selectedNode.value?.id || 
      e.target === selectedNode.value?.id
    )
    .map(e => {
      const targetId = e.source === selectedNode.value?.id 
        ? e.target 
        : e.source
      return nodes.value.find(n => n.id === targetId)
    })
    .filter(Boolean) as TreeNodeType[]
})

const visibleNodes = computed(() => {
  return nodes.value.filter(node => {
    // 如果节点被折叠，隐藏其子节点
    if (node.parentId) {
      const parent = nodes.value.find(n => n.id === node.parentId)
      if (parent && !expandedNodeIds.value.has(parent.id)) {
        return false
      }
    }
    return true
  })
})

const visibleEdges = computed(() => {
  const visibleNodeIds = new Set(visibleNodes.value.map(n => n.id))
  return edges.value.filter(e =>
    visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
  )
})

// 方法
async function handleToggle(nodeId: string) {
  const node = nodes.value.find(item => item.id === nodeId)
  if (!node) {
    return
  }

  if (expandedNodeIds.value.has(nodeId)) {
    expandedNodeIds.value.delete(nodeId)
    collapseNode(nodeId)
    return
  }

  expandedNodeIds.value.add(nodeId)
  await expandNode(nodeId)
}

function handleSearch() {
  if (!searchQuery.value) {
    searchMatches.value.clear()
    return
  }

  const query = searchQuery.value.toLowerCase()
  const matches = new Set<string>()

  nodes.value.forEach(node => {
    if (
      node.label.toLowerCase().includes(query) ||
      node.description?.toLowerCase().includes(query)
    ) {
      matches.add(node.id)
      
      // 展开所有祖先节点
      let current = node
      while (current.parentId) {
        expandedNodeIds.value.add(current.parentId)
        const parent = nodes.value.find(n => n.id === current.parentId)
        if (!parent) break
        current = parent
      }
    }
  })

  searchMatches.value = matches
}

function clearSearch() {
  searchQuery.value = ''
  searchMatches.value.clear()
}

function getNodePosition(nodeId: string) {
  // 简化实现：根据 DOM 位置获取节点坐标
  const element = document.querySelector(`[data-node-id="${nodeId}"]`)
  if (!element) return { x: 0, y: 0 }
  
  const rect = element.getBoundingClientRect()
  const canvasRect = treeCanvas.value?.getBoundingClientRect()
  
  return {
    x: rect.left - (canvasRect?.left || 0) + rect.width / 2,
    y: rect.top - (canvasRect?.top || 0) + rect.height / 2
  }
}

// 生命周期
onMounted(async () => {
  await loadTree()
  
  // 初始展开根节点
  if (nodes.value.length > 0) {
    expandedNodeIds.value.add(nodes.value[0].id)
  }
})

// 重试加载
async function handleRetry() {
  await loadTree()
}

// 监听展开状态变化，重新绘制边线
watch(expandedNodeIds, () => {
  // 使用 requestAnimationFrame 确保 DOM 已更新
  requestAnimationFrame(() => {
    redrawEdges()
  })
}, { deep: true })

// 监听节点变化，重新绘制边线
watch(visibleNodes, () => {
  requestAnimationFrame(() => {
    redrawEdges()
  })
}, { deep: true })

// 重新绘制边线
function redrawEdges() {
  if (!edgesSvg.value || !treeCanvas.value) return
  
  // 更新 SVG 尺寸
  edgesSvg.value.style.width = treeCanvas.value.scrollWidth + 'px'
  edgesSvg.value.style.height = treeCanvas.value.scrollHeight + 'px'
  
  // 强制重新渲染（触发 Vue 的响应式更新）
  edgesSvg.value.style.display = 'none'
  void edgesSvg.value.getBoundingClientRect().height
  edgesSvg.value.style.display = 'block'
}
</script>

<style scoped>
.knowledge-tree-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary, #ffffff);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 错误提示 */
.tree-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 24px;
  background: var(--bg-primary, #ffffff);
}

.tree-error__content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  background: rgba(204, 0, 0, 0.05);
  border: 1px solid #cc0000;
  border-radius: 8px;
  max-width: 400px;
}

.tree-error__icon {
  font-size: 32px;
  flex-shrink: 0;
}

.tree-error__message {
  flex: 1;
}

.tree-error__title {
  margin: 0 0 4px 0;
  font-weight: 600;
  color: #cc0000;
}

.tree-error__text {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary, #666666);
}

.tree-error__retry {
  padding: 8px 16px;
  border: 1px solid #cc0000;
  border-radius: 4px;
  background: #cc0000;
  color: white;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.tree-error__retry:hover {
  background: #990000;
  border-color: #990000;
}

/* 加载状态 */
.tree-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}

.tree-loading__spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--bg-tertiary, #f0f0f0);
  border-top-color: var(--state-loading, #0066cc);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.tree-loading__text {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary, #666666);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.tree-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--node-border, #d0d0d0);
  background: var(--bg-secondary, #f8f8f8);
}

.tree-search__input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--node-border, #d0d0d0);
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s ease;
}

.tree-search__input:focus {
  border-color: var(--node-border-hover, #808080);
}

.tree-search__clear {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary, #666666);
  cursor: pointer;
  font-size: 14px;
  transition: color 0.2s ease;
}

.tree-search__clear:hover {
  color: var(--text-primary, #1a1a1a);
}

.tree-wrapper {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.tree-canvas {
  flex: 1;
  position: relative;
  overflow: auto;
  padding: 16px;
}

.tree-edges {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  pointer-events: none;
}

.tree-nodes {
  position: relative;
  z-index: 1;
}

.tree-edge {
  stroke: var(--edge-stroke, #cccccc);
  stroke-width: 1px;
  fill: none;
  filter: drop-shadow(0 1px 2px var(--edge-shadow, rgba(0, 0, 0, 0.08)));
  transition: stroke 0.2s ease;
  pointer-events: auto;
}

.tree-edge:hover {
  stroke: var(--edge-stroke-hover, #666666);
  stroke-width: 1.5px;
}

.tree-edge--related {
  stroke-dasharray: 4, 4;
  stroke: var(--text-tertiary, #999999);
}

.tree-edge--related:hover {
  stroke: var(--edge-stroke-hover, #666666);
}
</style>
