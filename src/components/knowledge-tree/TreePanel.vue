<template>
  <div class="tree-panel">
    <!-- 面板头部 -->
    <div class="tree-panel__header">
      <div class="tree-panel__title">
        <span class="tree-panel__icon">{{ getNodeIcon(node.nodeType) }}</span>
        <span class="tree-panel__label">{{ node.label }}</span>
      </div>
      <button class="tree-panel__close" @click="$emit('close')" aria-label="关闭">
        ✕
      </button>
    </div>

    <!-- 面板内容 -->
    <div class="tree-panel__content">
      <!-- 基本信息 -->
      <section class="tree-panel__section">
        <h3 class="tree-panel__section-title">基本信息</h3>
        <div class="tree-panel__info">
          <div class="tree-panel__info-item">
            <span class="tree-panel__info-label">类型</span>
            <span class="tree-panel__info-value">{{ formatNodeType(node.nodeType) }}</span>
          </div>
          <div v-if="node.description" class="tree-panel__info-item">
            <span class="tree-panel__info-label">描述</span>
            <span class="tree-panel__info-value">{{ node.description }}</span>
          </div>
          <div v-if="node.metadata?.createdAt" class="tree-panel__info-item">
            <span class="tree-panel__info-label">创建时间</span>
            <span class="tree-panel__info-value">{{ formatDate(node.metadata.createdAt) }}</span>
          </div>
          <div v-if="node.metadata?.fileSize" class="tree-panel__info-item">
            <span class="tree-panel__info-label">文件大小</span>
            <span class="tree-panel__info-value">{{ formatFileSize(node.metadata.fileSize) }}</span>
          </div>
          <div v-if="node.metadata?.importance_score" class="tree-panel__info-item">
            <span class="tree-panel__info-label">重要度</span>
            <span class="tree-panel__info-value">
              {{ renderImportance(node.metadata.importance_score) }}
            </span>
          </div>
        </div>
      </section>

      <!-- 证据文本 -->
      <section v-if="node.metadata?.evidence_text" class="tree-panel__section">
        <h3 class="tree-panel__section-title">证据文本</h3>
        <div class="tree-panel__evidence">
          {{ node.metadata.evidence_text }}
        </div>
      </section>

      <!-- 关联节点 -->
      <section v-if="relatedNodes.length > 0" class="tree-panel__section">
        <h3 class="tree-panel__section-title">
          关联节点 ({{ relatedNodes.length }})
        </h3>
        <div class="tree-panel__related">
          <div
            v-for="relatedNode in relatedNodes"
            :key="relatedNode.id"
            class="tree-panel__related-item"
          >
            <span class="tree-panel__related-icon">{{ getNodeIcon(relatedNode.nodeType) }}</span>
            <span class="tree-panel__related-label">{{ relatedNode.label }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TreeNode } from './types'

interface Props {
  node: TreeNode
  relatedNodes?: TreeNode[]
}

interface Emits {
  (e: 'close'): void
}

withDefaults(defineProps<Props>(), {
  relatedNodes: () => []
})

defineEmits<Emits>()

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

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('zh-CN')
  } catch {
    return dateString
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

function renderImportance(score: number): string {
  const stars = Math.round(score * 5)
  return '⭐'.repeat(Math.max(1, stars)) + ` (${(score * 100).toFixed(0)}%)`
}
</script>

<style scoped>
.tree-panel {
  width: 320px;
  border-left: 1px solid var(--node-border, #d0d0d0);
  background: var(--bg-secondary, #f8f8f8);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tree-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--node-border, #d0d0d0);
  background: var(--bg-primary, #ffffff);
}

.tree-panel__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  min-width: 0;
}

.tree-panel__icon {
  font-size: 16px;
  flex-shrink: 0;
}

.tree-panel__label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-panel__close {
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
  flex-shrink: 0;
}

.tree-panel__close:hover {
  color: var(--text-primary, #1a1a1a);
}

.tree-panel__content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.tree-panel__section {
  margin-bottom: 24px;
}

.tree-panel__section:last-child {
  margin-bottom: 0;
}

.tree-panel__section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #666666);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px 0;
}

.tree-panel__info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tree-panel__info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tree-panel__info-label {
  font-size: 11px;
  color: var(--text-tertiary, #999999);
  font-weight: 500;
}

.tree-panel__info-value {
  font-size: 13px;
  color: var(--text-primary, #1a1a1a);
  word-break: break-word;
}

.tree-panel__evidence {
  padding: 12px;
  background: var(--node-bg, #ffffff);
  border: 1px solid var(--node-border, #d0d0d0);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-primary, #1a1a1a);
  line-height: 1.5;
  max-height: 200px;
  overflow-y: auto;
}

.tree-panel__related {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tree-panel__related-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--node-bg, #ffffff);
  border: 1px solid var(--node-border, #d0d0d0);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-primary, #1a1a1a);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tree-panel__related-item:hover {
  border-color: var(--node-border-hover, #808080);
  background: var(--bg-tertiary, #f0f0f0);
}

.tree-panel__related-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.tree-panel__related-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
