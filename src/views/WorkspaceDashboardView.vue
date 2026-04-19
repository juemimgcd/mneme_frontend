<script setup lang="ts">
import ActivityFeed from '@/components/dashboard/ActivityFeed.vue';
import { useWorkspaceStore } from '@/stores/workspace';

const workspace = useWorkspaceStore();
</script>

<template>
  <div class="flex flex-col gap-10 max-w-7xl mx-auto">
    <!-- Header Section -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"></div>
        <span class="text-xs font-semibold tracking-widest text-cyan-400 uppercase">Workspace Overview</span>
      </div>
      <h2 class="text-3xl font-light text-slate-100 mt-2">智能 RAG 主链路一目了然</h2>
      <p class="text-slate-400 text-sm max-w-2xl leading-relaxed">
        总览页优先展示当前上下文、索引状态、近期活动和可追踪的增长指标，保持信息的极简与聚焦。
      </p>
    </div>

    <!-- Metrics Grid -->
    <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        v-for="metric in workspace.dashboardMetrics"
        :key="metric.label"
        class="relative overflow-hidden rounded-2xl bg-white/5 border border-white/5 p-6 backdrop-blur-md group hover:bg-white/10 transition-colors"
      >
        <div class="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-purple-500/10 blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
        <h3 class="text-sm font-medium text-slate-400 mb-2">{{ metric.label }}</h3>
        <div class="flex items-end gap-3 pointer-events-none">
          <span class="text-3xl font-light text-slate-100">{{ metric.value }}</span>
          <span 
            class="text-xs font-medium mb-1 px-2 py-0.5 rounded-full"
            :class="[
              metric.tone === 'teal' ? 'bg-emerald-500/10 text-emerald-400' : 
              metric.tone === 'coral' ? 'bg-red-500/10 text-red-400' : 'bg-slate-500/10 text-slate-400'
            ]"
          >
            {{ metric.change }}
          </span>
        </div>
      </div>
    </section>

    <!-- Main Content Grid -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-1 flex flex-col gap-6">
        <div class="rounded-2xl border border-white/5 bg-slate-900/50 backdrop-blur-md p-6">
          <div class="pb-4 border-b border-white/5 mb-6">
            <h3 class="text-xs font-semibold tracking-widest text-purple-400 uppercase mb-1">Current Context</h3>
            <h4 class="text-lg font-medium text-slate-200">当前知识库</h4>
          </div>
          
          <div v-if="workspace.currentKnowledgeBase" class="flex flex-col gap-6 relative">
            <div class="absolute -left-2 -top-2 w-12 h-12 bg-purple-500/20 rounded-full blur-xl pointer-events-none"></div>
            <div>
              <strong class="block text-xl font-light text-white mb-2">{{ workspace.currentKnowledgeBase.name }}</strong>
              <p class="text-sm text-slate-400 leading-relaxed">{{ workspace.currentKnowledgeBase.description }}</p>
            </div>
            
            <dl class="grid grid-cols-2 gap-4">
              <div class="p-4 rounded-xl bg-black/40 border border-white/5">
                <dt class="text-xs text-slate-500 mb-1">文档数量</dt>
                <dd class="text-lg font-medium text-slate-200">{{ workspace.currentKnowledgeBase.document_count }}</dd>
              </div>
              <div class="p-4 rounded-xl bg-black/40 border border-white/5">
                <dt class="text-xs text-slate-500 mb-1">记忆条目</dt>
                <dd class="text-lg font-medium text-slate-200">{{ workspace.currentKnowledgeBase.memory_count }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div class="lg:col-span-2 rounded-2xl border border-white/5 bg-slate-900/50 backdrop-blur-md p-6">
        <div class="pb-4 border-b border-white/5 mb-6">
          <h3 class="text-xs font-semibold tracking-widest text-cyan-400 uppercase mb-1">Recent Activity</h3>
          <h4 class="text-lg font-medium text-slate-200">最近动态</h4>
        </div>
        <ActivityFeed :items="workspace.activityFeed" />
      </div>
    </section>
  </div>
</template>
