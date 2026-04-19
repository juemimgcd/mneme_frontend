<script setup lang="ts">
import DocumentsTable from '@/components/documents/DocumentsTable.vue';
import UploadZone from '@/components/documents/UploadZone.vue';
import { useWorkspaceStore } from '@/stores/workspace';

const workspace = useWorkspaceStore();
</script>

<template>
  <div class="flex flex-col gap-10 max-w-7xl mx-auto">
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]"></div>
        <span class="text-xs font-semibold tracking-widest text-blue-400 uppercase">Document Processing</span>
      </div>
      <h2 class="text-3xl font-light text-slate-100 mt-2">所见即所得的文件处理流程</h2>
      <p class="text-slate-400 text-sm max-w-2xl leading-relaxed">
        文件被切片（Chunking）、生成嵌入（Embedding）并持久化的过程可完整追溯，提供即时的处理状态反馈。
      </p>
    </div>

    <div class="flex flex-col gap-6">
      <div class="rounded-2xl border border-white/5 bg-slate-900/50 backdrop-blur-md p-6">
        <UploadZone />
      </div>

      <div class="rounded-2xl border border-white/5 bg-slate-900/50 backdrop-blur-md p-6">
        <DocumentsTable :items="workspace.filteredDocuments" />
      </div>
    </div>
  </div>
</template>
