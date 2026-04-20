import { ref, computed } from 'vue'
import { api } from '@/lib/api'
import type { TreeNode, TreeEdge, GraphResponse } from '../types'

export function useTreeData() {
  const nodes = ref<TreeNode[]>([])
  const edges = ref<TreeEdge[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const expandingNodeIds = ref(new Set<string>())

  /**
   * 从后端加载完整树数据
   */
  async function loadTree(userId?: string) {
    loading.value = true
    error.value = null

    try {
      const response = await api.get<GraphResponse>(
        '/graph?include_memory=true&include_relationships=true'
      )

      // 转换后端数据格式到前端树节点格式
      nodes.value = response.nodes.map(node => ({
        id: node.entity_id,
        nodeType: node.node_type,
        label: node.label,
        description: node.metadata?.description,
        parentId: node.parent_id,
        depth: node.depth,
        state: 'default' as const,
        isExpanded: node.depth === 0, // 根节点默认展开
        hasChildren: (node.metadata?.children_count || 0) > 0,
        childrenCount: node.metadata?.children_count,
        childrenLoaded: false,
        importance: node.metadata?.importance_score,
        entryType: node.metadata?.entry_type,
        metadata: node.metadata
      }))

      edges.value = response.edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        edgeType: edge.edge_type,
        metadata: edge.metadata
      }))
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
      let childResponse: GraphResponse | null = null

      if (node.nodeType === 'knowledge_base') {
        childResponse = await api.get<GraphResponse>(
          `/graph/knowledge-bases/${nodeId}?include_memory=true&include_relationships=true`
        )
      } else if (node.nodeType === 'document') {
        childResponse = await api.get<GraphResponse>(
          `/graph/documents/${nodeId}?include_memory=true&include_relationships=true`
        )
      }

      if (childResponse) {
        // 合并新节点和边
        const newNodes = childResponse.nodes.map(n => ({
          id: n.entity_id,
          nodeType: n.node_type,
          label: n.label,
          description: n.metadata?.description,
          parentId: n.parent_id,
          depth: n.depth,
          state: 'default' as const,
          isExpanded: false,
          hasChildren: (n.metadata?.children_count || 0) > 0,
          childrenCount: n.metadata?.children_count,
          childrenLoaded: false,
          importance: n.metadata?.importance_score,
          entryType: n.metadata?.entry_type,
          metadata: n.metadata
        }))

        // 使用 Map 去重，避免竞态条件
        const nodeMap = new Map(nodes.value.map(n => [n.id, n]))
        newNodes.forEach(n => {
          if (!nodeMap.has(n.id)) {
            nodeMap.set(n.id, n)
          }
        })
        nodes.value = Array.from(nodeMap.values())

        const newEdges = childResponse.edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          edgeType: e.edge_type,
          metadata: e.metadata
        }))

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
      const parent = nodes.value.find(n => n.id === current.parentId)
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
