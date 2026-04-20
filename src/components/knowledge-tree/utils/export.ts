import type { TreeData, TreeNode, TreeEdge } from '../types'

/**
 * 将树数据导出为 Mermaid 图表语法
 */
export function exportToMermaid(treeData: TreeData): string {
  let mermaid = 'graph TD\n'

  // 创建 ID 映射表以处理重复
  const idMap = new Map<string, string>()
  let idCounter = 0

  function getSafeId(originalId: string): string {
    if (!idMap.has(originalId)) {
      idMap.set(originalId, `node_${idCounter++}`)
    }
    return idMap.get(originalId)!
  }

  // 添加节点定义
  treeData.nodes.forEach(node => {
    const icon = getNodeIcon(node.nodeType)
    const label = `${icon} ${node.label}<br/><small>${formatNodeType(node.nodeType)}</small>`
    const nodeId = getSafeId(node.id)

    // 根据节点类型设置样式
    const style = getNodeStyle(node)
    mermaid += `  ${nodeId}["${label}"]${style}\n`
  })

  mermaid += '\n'

  // 添加边定义
  treeData.edges.forEach(edge => {
    const sourceId = getSafeId(edge.source)
    const targetId = getSafeId(edge.target)

    if (edge.edgeType === 'related') {
      // 关联边使用虚线
      mermaid += `  ${sourceId} -.->|related| ${targetId}\n`
    } else {
      // 其他边使用实线
      mermaid += `  ${sourceId} --> ${targetId}\n`
    }
  })

  return mermaid
}

/**
 * 将树数据导出为 JSON
 */
export function exportToJSON(treeData: TreeData): string {
  return JSON.stringify(treeData, null, 2)
}

/**
 * 将树数据导出为 CSV（平铺格式）
 */
export function exportToCSV(treeData: TreeData): string {
  const headers = ['ID', '类型', '标签', '描述', '深度', '父节点', '重要度']
  const rows = treeData.nodes.map(node => [
    node.id,
    node.nodeType,
    node.label,
    node.description || '',
    node.depth,
    node.parentId || '',
    node.metadata?.importance_score || ''
  ])

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  return csv
}

/**
 * 将树数据导出为 Markdown 大纲
 */
export function exportToMarkdown(treeData: TreeData): string {
  const nodeMap = new Map(treeData.nodes.map(n => [n.id, n]))
  const rootNodes = treeData.nodes.filter(n => n.depth === 0)

  let markdown = '# 知识库树形结构\n\n'

  function renderNode(node: TreeNode, depth: number): string {
    const indent = '  '.repeat(depth)
    const icon = getNodeIcon(node.nodeType)
    const importance = node.metadata?.importance_score
      ? ` ${renderImportance(node.metadata.importance_score)}`
      : ''

    let content = `${indent}- ${icon} **${node.label}**${importance}\n`

    if (node.description) {
      content += `${indent}  > ${node.description}\n`
    }

    // 添加子节点
    const children = treeData.nodes.filter(n => n.parentId === node.id)
    for (const child of children) {
      content += renderNode(child, depth + 1)
    }

    return content
  }

  for (const rootNode of rootNodes) {
    markdown += renderNode(rootNode, 0)
  }

  return markdown
}

/**
 * 下载文件
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// 辅助函数

function getNodeIcon(nodeType: string): string {
  const icons: Record<string, string> = {
    user: '👤',
    knowledge_base: '📚',
    document: '📄',
    memory_entry: '💡'
  }
  return icons[nodeType] || '◆'
}

function formatNodeType(nodeType: string): string {
  const names: Record<string, string> = {
    user: '用户',
    knowledge_base: '知识库',
    document: '文档',
    memory_entry: '记忆条目'
  }
  return names[nodeType] || nodeType
}

function getNodeStyle(node: TreeNode): string {
  const styles: Record<string, string> = {
    user: 'fill:#f0f0f0,stroke:#1a1a1a,stroke-width:2px',
    knowledge_base: 'fill:#ffffff,stroke:#d0d0d0,stroke-width:1px',
    document: 'fill:#ffffff,stroke:#d0d0d0,stroke-width:1px',
    memory_entry: 'fill:#ffffff,stroke:#0066cc,stroke-width:1px'
  }

  const baseStyle = styles[node.nodeType] || 'fill:#ffffff,stroke:#d0d0d0'

  // 根据重要度调整颜色
  if (node.metadata?.importance_score) {
    const score = node.metadata.importance_score
    if (score > 0.7) {
      return `style ${node.id} ${baseStyle},stroke-width:2px`
    }
  }

  return ''
}

function renderImportance(score: number): string {
  const stars = Math.round(score * 5)
  return '⭐'.repeat(Math.max(1, stars))
}
