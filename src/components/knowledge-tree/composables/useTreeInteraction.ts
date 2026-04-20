import { ref } from 'vue'

export function useTreeInteraction() {
  const selectedNodeId = ref<string | null>(null)
  const highlightedNodeIds = ref(new Set<string>())
  const expandedNodeIds = ref(new Set<string>())
  const highlightedEdgeIds = ref(new Set<string>())

  function handleToggleNode(nodeId: string) {
    if (expandedNodeIds.value.has(nodeId)) {
      expandedNodeIds.value.delete(nodeId)
    } else {
      expandedNodeIds.value.add(nodeId)
    }
  }

  function handleSelectNode(nodeId: string) {
    selectedNodeId.value = selectedNodeId.value === nodeId ? null : nodeId
  }

  function handleHoverNode(nodeId: string) {
    highlightedNodeIds.value.add(nodeId)
  }

  function handleUnhoverNode(nodeId: string) {
    highlightedNodeIds.value.delete(nodeId)
  }

  function highlightEdge(edgeId: string) {
    highlightedEdgeIds.value.add(edgeId)
  }

  function unhighlightEdge(edgeId: string) {
    highlightedEdgeIds.value.delete(edgeId)
  }

  function clearSelection() {
    selectedNodeId.value = null
    highlightedNodeIds.value.clear()
  }

  return {
    selectedNodeId,
    highlightedNodeIds,
    expandedNodeIds,
    highlightedEdgeIds,
    handleToggleNode,
    handleSelectNode,
    handleHoverNode,
    handleUnhoverNode,
    highlightEdge,
    unhighlightEdge,
    clearSelection
  }
}
