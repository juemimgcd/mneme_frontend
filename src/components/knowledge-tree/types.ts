export type NodeType = 'user' | 'knowledge_base' | 'document' | 'memory_entry'
export type NodeState = 'default' | 'expanded' | 'collapsed' | 'loading' | 'error' | 'highlighted'
export type EdgeType = 'owns' | 'contains' | 'extracts' | 'related'

export interface TreeNode {
  // 标识
  id: string
  nodeType: NodeType

  // 显示
  label: string
  description?: string
  icon?: string

  // 层级
  parentId?: string
  depth: number

  // 状态
  state: NodeState
  isExpanded: boolean
  hasChildren: boolean
  childrenCount?: number
  childrenLoaded?: boolean

  // 样式
  importance?: number
  entryType?: string

  // 元数据
  metadata?: {
    fileSize?: number
    createdAt?: string
    updatedAt?: string
    status?: string
    importance_score?: number
    evidence_text?: string
  }
}

export interface TreeEdge {
  id: string
  source: string
  target: string
  edgeType: EdgeType

  metadata?: {
    relationship_score?: number
    shared_memory_count?: number
    shared_memory_types?: string[]
  }
}

export interface TreeData {
  nodes: TreeNode[]
  edges: TreeEdge[]
  rootId: string
}

export interface GraphNodeData {
  id: string
  entity_id: string
  node_type: NodeType
  label: string
  parent_id?: string
  depth: number
  metadata?: Record<string, any>
}

export interface GraphEdgeData {
  id: string
  source: string
  target: string
  edge_type: EdgeType
  metadata?: Record<string, any>
}

export interface GraphResponse {
  nodes: GraphNodeData[]
  edges: GraphEdgeData[]
}
