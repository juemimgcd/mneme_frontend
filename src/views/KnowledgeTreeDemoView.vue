<template>
  <div class="knowledge-tree-demo">
    <!-- 工具栏 -->
    <div class="demo-toolbar">
      <div class="demo-toolbar__left">
        <h1 class="demo-title">知识库树形结构</h1>
      </div>
      <div class="demo-toolbar__right">
        <button class="demo-btn" @click="handleExportMermaid">
          📊 导出 Mermaid
        </button>
        <button class="demo-btn" @click="handleExportJSON">
          📄 导出 JSON
        </button>
        <button class="demo-btn" @click="handleExportMarkdown">
          📝 导出 Markdown
        </button>
      </div>
    </div>

    <!-- 主容器 -->
    <div class="demo-container">
      <KnowledgeTree />
    </div>

    <!-- 导出预览模态框 -->
    <div v-if="showExportModal" class="demo-modal" @click="closeExportModal">
      <div class="demo-modal__content" @click.stop>
        <div class="demo-modal__header">
          <h2>{{ exportModalTitle }}</h2>
          <button class="demo-modal__close" @click="closeExportModal">✕</button>
        </div>
        <div class="demo-modal__body">
          <pre class="demo-modal__code">{{ exportModalContent }}</pre>
        </div>
        <div class="demo-modal__footer">
          <button class="demo-btn demo-btn--primary" @click="copyToClipboard">
            📋 复制到剪贴板
          </button>
          <button class="demo-btn" @click="downloadExport">
            ⬇️ 下载文件
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import KnowledgeTree from '@/components/knowledge-tree/KnowledgeTree.vue'
import { useTreeData } from '@/components/knowledge-tree/composables/useTreeData'
import {
  exportToMermaid,
  exportToJSON,
  exportToMarkdown,
  downloadFile
} from '@/components/knowledge-tree/utils/export'

const { nodes, edges } = useTreeData()

const showExportModal = ref(false)
const exportModalTitle = ref('')
const exportModalContent = ref('')
const exportModalType = ref<'mermaid' | 'json' | 'markdown'>('mermaid')

function handleExportMermaid() {
  const treeData = { nodes: nodes.value, edges: edges.value, rootId: '' }
  exportModalContent.value = exportToMermaid(treeData)
  exportModalTitle.value = 'Mermaid 图表'
  exportModalType.value = 'mermaid'
  showExportModal.value = true
}

function handleExportJSON() {
  const treeData = { nodes: nodes.value, edges: edges.value, rootId: '' }
  exportModalContent.value = exportToJSON(treeData)
  exportModalTitle.value = 'JSON 数据'
  exportModalType.value = 'json'
  showExportModal.value = true
}

function handleExportMarkdown() {
  const treeData = { nodes: nodes.value, edges: edges.value, rootId: '' }
  exportModalContent.value = exportToMarkdown(treeData)
  exportModalTitle.value = 'Markdown 大纲'
  exportModalType.value = 'markdown'
  showExportModal.value = true
}

function closeExportModal() {
  showExportModal.value = false
}

function copyToClipboard() {
  navigator.clipboard.writeText(exportModalContent.value)
  alert('已复制到剪贴板')
}

function downloadExport() {
  const extensions: Record<string, string> = {
    mermaid: 'md',
    json: 'json',
    markdown: 'md'
  }

  const ext = extensions[exportModalType.value]
  const filename = `knowledge-tree.${ext}`
  const mimeTypes: Record<string, string> = {
    mermaid: 'text/markdown',
    json: 'application/json',
    markdown: 'text/markdown'
  }

  downloadFile(exportModalContent.value, filename, mimeTypes[exportModalType.value])
}
</script>

<style scoped>
.knowledge-tree-demo {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary, #ffffff);
}

.demo-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--node-border, #d0d0d0);
  background: var(--bg-secondary, #f8f8f8);
}

.demo-toolbar__left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.demo-toolbar__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.demo-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.demo-btn {
  padding: 8px 16px;
  border: 1px solid var(--node-border, #d0d0d0);
  border-radius: 6px;
  background: var(--node-bg, #ffffff);
  color: var(--text-primary, #1a1a1a);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.demo-btn:hover {
  border-color: var(--node-border-hover, #808080);
  background: var(--bg-tertiary, #f0f0f0);
}

.demo-btn--primary {
  background: var(--state-loading, #0066cc);
  color: white;
  border-color: var(--state-loading, #0066cc);
}

.demo-btn--primary:hover {
  background: #0052a3;
  border-color: #0052a3;
}

.demo-container {
  flex: 1;
  overflow: hidden;
}

/* 模态框 */
.demo-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.demo-modal__content {
  display: flex;
  flex-direction: column;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  background: var(--node-bg, #ffffff);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.demo-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--node-border, #d0d0d0);
}

.demo-modal__header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.demo-modal__close {
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

.demo-modal__close:hover {
  color: var(--text-primary, #1a1a1a);
}

.demo-modal__body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
}

.demo-modal__code {
  margin: 0;
  padding: 12px;
  background: var(--bg-tertiary, #f0f0f0);
  border: 1px solid var(--node-border, #d0d0d0);
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-primary, #1a1a1a);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.demo-modal__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--node-border, #d0d0d0);
  background: var(--bg-secondary, #f8f8f8);
}
</style>
