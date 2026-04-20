# Karpathy 知识库树形可视化 - 集成指南

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 导入组件

在你的 Vue 页面中导入 `KnowledgeTree` 组件：

```vue
<template>
  <div class="page">
    <KnowledgeTree />
  </div>
</template>

<script setup lang="ts">
import KnowledgeTree from '@/components/knowledge-tree/KnowledgeTree.vue'
</script>

<style scoped>
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
```

### 3. 配置 CSS 变量

在你的全局样式文件中定义颜色变量：

```css
:root {
  /* 背景 */
  --bg-primary: #ffffff;
  --bg-secondary: #f8f8f8;
  --bg-tertiary: #f0f0f0;

  /* 文字 */
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --text-tertiary: #999999;

  /* 节点 */
  --node-bg: #ffffff;
  --node-border: #d0d0d0;
  --node-border-hover: #808080;
  --node-border-selected: #1a1a1a;

  /* 边 */
  --edge-stroke: #cccccc;
  --edge-stroke-hover: #666666;
  --edge-shadow: rgba(0, 0, 0, 0.08);

  /* 状态 */
  --state-loading: #0066cc;
  --state-error: #cc0000;
  --state-success: #009900;
}
```

---

## 文件结构

```
src/components/knowledge-tree/
├── KnowledgeTree.vue              # 主容器组件
├── TreeNode.vue                   # 单个节点组件
├── TreePanel.vue                  # 侧边栏详情面板
├── types.ts                       # TypeScript 类型定义
├── composables/
│   ├── useTreeData.ts            # 数据管理 Composable
│   └── useTreeInteraction.ts     # 交互管理 Composable
└── utils/
    └── export.ts                 # 导出工具（Mermaid、JSON、CSV、Markdown）
```

---

## 核心 API

### KnowledgeTree 组件

主容器组件，负责整体布局和协调。

**Props**: 无

**Events**: 无

**Slots**: 无

**使用示例**:

```vue
<KnowledgeTree />
```

### useTreeData Composable

管理树数据的加载和更新。

```typescript
const {
  nodes,              // 所有节点
  edges,              // 所有边
  loading,            // 加载状态
  error,              // 错误信息
  loadTree,           // 加载完整树
  expandNode,         // 展开节点（异步加载子节点）
  collapseNode,       // 折叠节点
  getChildren,        // 获取子节点
  getAncestors,       // 获取祖先节点
  expandAncestors     // 展开所有祖先
} = useTreeData()
```

**示例**:

```typescript
// 加载树
await loadTree()

// 展开知识库节点
await expandNode('kb_123')

// 获取子节点
const children = getChildren('kb_123')

// 展开所有祖先
expandAncestors('memory_entry_456')
```

### useTreeInteraction Composable

管理用户交互状态。

```typescript
const {
  selectedNodeId,      // 选中的节点 ID
  highlightedNodeIds,  // 高亮的节点 ID 集合
  expandedNodeIds,     // 展开的节点 ID 集合
  highlightedEdgeIds,  // 高亮的边 ID 集合
  handleToggleNode,    // 切换展开/折叠
  handleSelectNode,    // 选择节点
  handleHoverNode,     // 悬停节点
  handleUnhoverNode,   // 取消悬停
  highlightEdge,       // 高亮边
  unhighlightEdge,     // 取消高亮边
  clearSelection       // 清除所有选择
} = useTreeInteraction()
```

### 导出工具

```typescript
import {
  exportToMermaid,
  exportToJSON,
  exportToCSV,
  exportToMarkdown,
  downloadFile
} from '@/components/knowledge-tree/utils/export'

// 导出为 Mermaid 图表
const mermaidCode = exportToMermaid(treeData)

// 导出为 JSON
const jsonCode = exportToJSON(treeData)

// 导出为 CSV
const csvCode = exportToCSV(treeData)

// 导出为 Markdown
const markdownCode = exportToMarkdown(treeData)

// 下载文件
downloadFile(mermaidCode, 'knowledge-tree.md', 'text/markdown')
```

---

## 数据结构

### TreeNode

```typescript
interface TreeNode {
  id: string                    // 节点唯一标识
  nodeType: 'user' | 'knowledge_base' | 'document' | 'memory_entry'
  label: string                 // 显示标签
  description?: string          // 简短描述
  parentId?: string             // 父节点 ID
  depth: number                 // 深度（0-3）
  state: 'default' | 'loading' | 'error' | ...
  isExpanded: boolean           // 是否展开
  hasChildren: boolean          // 是否有子节点
  childrenCount?: number        // 子节点数量
  childrenLoaded?: boolean      // 子节点是否已加载
  importance?: number           // 重要度（0-1）
  entryType?: string            // 记忆条目类型
  metadata?: {
    fileSize?: number
    createdAt?: string
    updatedAt?: string
    status?: string
    importance_score?: number
    evidence_text?: string
  }
}
```

### TreeEdge

```typescript
interface TreeEdge {
  id: string
  source: string               // 源节点 ID
  target: string               // 目标节点 ID
  edgeType: 'owns' | 'contains' | 'extracts' | 'related'
  metadata?: {
    relationship_score?: number
    shared_memory_count?: number
    shared_memory_types?: string[]
  }
}
```

---

## 后端 API 集成

### 必需的后端端点

#### 1. 获取完整树

```
GET /graph?include_memory=true&include_relationships=true
```

**响应**:

```json
{
  "nodes": [
    {
      "id": "user_123",
      "entity_id": "user_123",
      "node_type": "user",
      "label": "John Doe",
      "parent_id": null,
      "depth": 0,
      "metadata": {
        "display_name": "John Doe"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "source": "user_123",
      "target": "kb_456",
      "edge_type": "owns",
      "metadata": {}
    }
  ]
}
```

#### 2. 获取知识库子树

```
GET /graph/knowledge-bases/{knowledge_base_id}?include_memory=true&include_relationships=true
```

#### 3. 获取文档详情与关联

```
GET /graph/documents/{document_id}?include_memory=true&include_relationships=true
```

#### 4. 获取记忆库分组视图

```
GET /memory/knowledge-bases/{knowledge_base_id}/library
```

---

## 高级用法

### 自定义搜索

```typescript
import { ref, computed } from 'vue'
import { useTreeData } from '@/components/knowledge-tree/composables/useTreeData'

const { nodes, expandAncestors } = useTreeData()
const searchQuery = ref('')

const searchResults = computed(() => {
  if (!searchQuery.value) return []

  const query = searchQuery.value.toLowerCase()
  return nodes.value.filter(node =>
    node.label.toLowerCase().includes(query) ||
    node.description?.toLowerCase().includes(query)
  )
})

function handleSearch() {
  searchResults.value.forEach(node => {
    expandAncestors(node.id)
  })
}
```

### 自定义节点样式

在 `TreeNode.vue` 中添加自定义样式类：

```vue
<div
  :class="[
    'tree-node',
    {
      'tree-node--custom': node.metadata?.customFlag
    }
  ]"
>
  <!-- ... -->
</div>
```

```css
.tree-node--custom {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: #667eea;
}
```

### 性能优化 - 虚拟滚动

对于大量节点，使用虚拟滚动：

```bash
npm install @vueuse/core
```

```typescript
import { useVirtualList } from '@vueuse/core'

const { list, containerProps, wrapperProps } = useVirtualList(
  visibleNodes,
  { itemHeight: 40 }
)
```

### 性能优化 - 节点缓存

```typescript
const nodeCache = new Map<string, TreeNode>()

function getCachedNode(nodeId: string): TreeNode | undefined {
  if (!nodeCache.has(nodeId)) {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node) nodeCache.set(nodeId, node)
  }
  return nodeCache.get(nodeId)
}
```

---

## 常见问题

### Q: 如何自定义节点图标？

A: 在 `TreeNode.vue` 中修改 `getNodeIcon` 函数：

```typescript
function getNodeIcon(nodeType: string): string {
  const icons: Record<string, string> = {
    user: '👤',
    knowledge_base: '📚',
    document: '📄',
    memory_entry: '💡',
    custom_type: '🎯'  // 添加自定义类型
  }
  return icons[nodeType] || '◆'
}
```

### Q: 如何改变颜色主题？

A: 修改 CSS 变量：

```css
:root {
  --bg-primary: #1a1a1a;
  --text-primary: #ffffff;
  --node-border: #404040;
  /* ... 其他变量 */
}
```

### Q: 如何处理大量节点的性能问题？

A: 
1. 使用虚拟滚动
2. 启用懒加载（默认已启用）
3. 减少边线数量（使用 `include_relationships=false`）
4. 使用 Canvas 而非 SVG 绘制边线

### Q: 如何导出树数据？

A: 使用导出工具：

```typescript
import { exportToMermaid, downloadFile } from '@/components/knowledge-tree/utils/export'

const mermaidCode = exportToMermaid(treeData)
downloadFile(mermaidCode, 'tree.md', 'text/markdown')
```

---

## 扩展方向

### 1. 时间线视图

按创建时间展示记忆条目演进。

### 2. 主题聚类视图

按 `entry_type` 聚类显示。

### 3. 关联强度热力图

显示文档间的关联强度。

### 4. 全文搜索

集成全文搜索引擎（如 Elasticsearch）。

### 5. 协作编辑

支持多用户实时编辑树结构。

---

## 故障排除

### 节点不显示

1. 检查后端 `/graph` API 是否返回数据
2. 检查浏览器控制台是否有错误
3. 确保 `loadTree()` 已被调用

### 边线不显示

1. 检查 SVG 容器是否有正确的高度
2. 确保 `include_relationships=true`
3. 检查边线 CSS 是否被正确应用

### 性能缓慢

1. 启用虚拟滚动
2. 减少节点数量（使用过滤）
3. 禁用关联边线（`include_relationships=false`）
4. 使用 Canvas 而非 SVG

---

## 许可证

MIT
