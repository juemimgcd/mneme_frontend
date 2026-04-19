<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue';
import InsightColumn from '@/components/insights/InsightColumn.vue';
import { useWorkspaceStore } from '@/stores/workspace';

const workspace = useWorkspaceStore();
</script>

<template>
  <div class="flex flex-col h-full gap-8 max-w-7xl mx-auto pb-8">
    <div class="flex flex-col gap-3 shrink-0">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]"></div>
        <span class="text-xs font-semibold tracking-widest text-rose-400 uppercase">Profile & Growth Insights</span>
      </div>
      <h2 class="text-3xl font-light text-slate-100 mt-2">把画像和成长分析收敛成可读、可比较的洞察面板</h2>
      <p class="text-slate-400 text-sm max-w-2xl leading-relaxed">
        这部分针对 Mneme 的增强能力做了独立的信息层，让未来 advice / companion 也能顺滑挂进来。
      </p>
    </div>

    <!-- Insights Canvas -->
    <div class="flex-1 flex flex-col rounded-2xl bg-white/5 border border-white/5 backdrop-blur-md overflow-hidden">
      <div class="p-6 border-b border-white/5 bg-slate-950/40">
        <h3 class="text-sm font-semibold tracking-widest text-cyan-400 uppercase mb-1">Insight Deck</h3>
        <h4 class="text-lg font-medium text-slate-200">当前洞察</h4>
      </div>
      
      <div class="flex-1 p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        <InsightColumn
          v-if="workspace.profile || workspace.growth"
          :growth="workspace.growth"
          :profile="workspace.profile"
        />
        <EmptyState
          v-else
          title="还没有洞察结果"
          description="等画像和成长分析接口输出稳定后，这里会展示最新分析。"
        />
      </div>
    </div>
  </div>
</template>
