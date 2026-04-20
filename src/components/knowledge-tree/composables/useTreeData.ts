import { ref } from 'vue'
import { api } from '@/lib/api'
import { useSessionStore } from '@/stores/session'
import { useWorkspaceStore } from '@/stores/workspace'
import type { GraphResult } from '@/lib/types'
import type { TreeNode, TreeEdge } from '../types'

export function useTreeData() {
  const session = useSessionStore()
  const workspace = useWorkspaceStore()
  const nodes = ref<TreeNode[]>([])
  const edges = ref<TreeEdge[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const expandingNodeIds = ref(new Set<string>())

  /**
   * 从后端加载完整树数据
   */
  async function loadTree() {
    loading.value = true
    error.value = null

    try {
      const token = session.token ?? ''
      const response =
        workspace.activeKnowledgeBaseId && token
          ? await api.knowledgeBaseGraph(token, workspace.activeKnowledgeBaseId, {
              includeMemory: true,
              includeRelationships: true,
            })
          : await api.userGraph(token, {
              includeMemory: true,
              includeRelationships: true,
            })

      nodes.value = response.nodes.map(mapGraphNode)
      edges.value = response.edges.map(mapGraphEdge)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载树数据失败'
      console.error('Failed to load tree:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 展开节点并加载子节点
   */
  async function expandNode(nodeId: string) {
    const node = nodes.value.find(n => n.id === nodeId)
    if (!node) return

    // 防止并发请求：如果已在加载中，直接返回
    if (expandingNodeIds.value.has(nodeId)) {
      return
    }

    // 如果已加载过子节点，直接展开
    if (node.childrenLoaded) {
      node.isExpanded = true
      return
    }

    expandingNodeIds.value.add(nodeId)
    node.state = 'loading'

    try {
      const token = session.token ?? ''
      let childResponse: GraphResult | null = null

      if (!token) {
        childResponse = null
      } else if (node.nodeType === 'knowledge_base') {
        childResponse = await api.knowledgeBaseGraph(token, nodeId, {
          includeMemory: true,
          includeRelationships: true,
        })
      } else if (node.nodeType === 'document') {
        childResponse = await api.documentGraph(token, nodeId, {
          includeMemory: true,
          includeRelationships: true,
        })
      }

      if (childResponse) {
        const newNodes = childResponse.nodes.map(mapGraphNode)

        // 使用 Map 去重，避免竞态条件
        const nodeMap = new Map(nodes.value.map(n => [n.id, n]))
        newNodes.forEach(n => {
          if (!nodeMap.has(n.id)) {
            nodeMap.set(n.id, n)
          }
        })
        nodes.value = Array.from(nodeMap.values())

        const newEdges = childResponse.edges.map(mapGraphEdge)

        const edgeMap = new Map(edges.value.map(e => [e.id, e]))
        newEdges.forEach(e => {
          if (!edgeMap.has(e.id)) {
            edgeMap.set(e.id, e)
          }
        })
        edges.value = Array.from(edgeMap.values())
      }

      node.childrenLoaded = true
      node.isExpanded = true
      node.state = 'default'
    } catch (err) {
      node.state = 'error'
      console.error(`Failed to expand node ${nodeId}:`, err)
    } finally {
      expandingNodeIds.value.delete(nodeId)
    }
  }

  /**
   * 折叠节点
   */
  function collapseNode(nodeId: string) {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node) {
      node.isExpanded = false
    }
  }

  /**
   * 获取节点的所有子节点
   */
  function getChildren(nodeId: string): TreeNode[] {
    return nodes.value.filter(n => n.parentId === nodeId)
  }

  /**
   * 获取节点的所有祖先节点
   */
  function getAncestors(nodeId: string): TreeNode[] {
    const ancestors: TreeNode[] = []
    let current = nodes.value.find(n => n.id === nodeId)

    while (current?.parentId) {
      const parentId = current.parentId
      const parent = nodes.value.find(n => n.id === parentId)
      if (!parent) break
      ancestors.unshift(parent)
      current = parent
    }

    return ancestors
  }

  /**
   * 展开节点的所有祖先
   */
  function expandAncestors(nodeId: string) {
    const ancestors = getAncestors(nodeId)
    ancestors.forEach(ancestor => {
      ancestor.isExpanded = true
    })
  }

  return {
    nodes,
    edges,
    loading,
    error,
    loadTree,
    expandNode,
    collapseNode,
    getChildren,
    getAncestors,
    expandAncestors
  }
}

function mapGraphNode(node: GraphResult['nodes'][number]): TreeNode {
  const metadata = node.metadata ?? {}
  const rawDescription = metadata.description
  const rawChildrenCount = metadata.children_count
  const rawImportance = metadata.importance_score
  const rawEntryType = metadata.entry_type

  return {
    id: node.entity_id || node.id,
    nodeType: node.node_type,
    label: node.label,
    description: typeof rawDescription === 'string' ? rawDescription : undefined,
    parentId: node.parent_id ?? undefined,
    depth: node.depth,
    state: 'default',
    isExpanded: node.depth === 0,
    hasChildren: typeof rawChildrenCount === 'number' ? rawChildrenCount > 0 : false,
    childrenCount: typeof rawChildrenCount === 'number' ? rawChildrenCount : undefined,
    childrenLoaded: false,
    importance: typeof rawImportance === 'number' ? rawImportance : undefined,
    entryType: typeof rawEntryType === 'string' ? rawEntryType : undefined,
    metadata: metadata as TreeNode['metadata'],
  }
}

function mapGraphEdge(edge: GraphResult['edges'][number]): TreeEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    edgeType: edge.edge_type,
    metadata: edge.metadata as TreeEdge['metadata'],
  }
}
