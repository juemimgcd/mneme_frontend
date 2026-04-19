<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue';
import TimelineList from '@/components/memory/TimelineList.vue';
import { useWorkspaceStore } from '@/stores/workspace';

const workspace = useWorkspaceStore();
</script>

<template>
  <div class="flex flex-col gap-10 max-w-7xl mx-auto pb-8">
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.8)]"></div>
        <span class="text-xs font-semibold tracking-widest text-orange-400 uppercase">Memory Extraction</span>
      </div>
      <h2 class="text-3xl font-light text-slate-100 mt-2">不仅检索，还从对话中提取新事实</h2>
      <p class="text-slate-400 text-sm max-w-2xl leading-relaxed">
        Graph/Memory 模型将问答过程中产生的新的有效结论，按时间线沉淀入库，建立持续生长的护城河。
      </p>
    </div>

    <div class="rounded-2xl border border-white/5 bg-slate-900/50 backdrop-blur-md p-6">
      <div class="pb-4 border-b border-white/5 mb-6">
        <h3 class="text-xs font-semibold tracking-widest text-cyan-400 uppercase mb-1">Structured Memory</h3>
        <h4 class="text-lg font-medium text-slate-200">知识库记忆视图</h4>
      </div>
      
      <TimelineList v-if="workspace.memoryLibrary" :library="workspace.memoryLibrary" />
      <EmptyState
        v-else
        class="my-10"
        title="记忆库暂为空"
        description="等文档索引和记忆提取接通后，这里会显示主题化结果。"
      />
    </div>
  </div>
</template>
