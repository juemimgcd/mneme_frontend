<script setup lang="ts">
import { reactive } from 'vue';
import KnowledgeBaseGrid from '@/components/knowledge/KnowledgeBaseGrid.vue';
import { useSessionStore } from '@/stores/session';
import { useWorkspaceStore } from '@/stores/workspace';

const session = useSessionStore();
const workspace = useWorkspaceStore();
const form = reactive({
  name: '',
  description: '',
});

async function createKnowledgeBase() {
  if (!session.user || !session.token) return;
  await workspace.createKnowledgeBase(form, session.user.id, session.token);
  form.name = '';
  form.description = '';
}

async function selectKnowledgeBase(id: string) {
  if (!session.token) return;
  await workspace.selectKnowledgeBase(id, session.token);
}
</script>

<template>
  <div class="flex flex-col gap-10 max-w-7xl mx-auto pb-10">
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
        <span class="text-xs font-semibold tracking-widest text-emerald-400 uppercase">Knowledge Bases</span>
      </div>
      <h2 class="text-3xl font-light text-slate-100 mt-2">为不同的人生主题建立独立上下文</h2>
      <p class="text-slate-400 text-sm max-w-2xl leading-relaxed">
        前端将知识库作为所有索引、问答和分析动作的顶层上下文，实现多知识库隔离。
      </p>
    </div>

    <!-- Create PB Form -->
    <div class="rounded-2xl border border-white/5 bg-slate-900/50 backdrop-blur-md p-6">
      <div class="pb-4 border-b border-white/5 mb-6">
        <h3 class="text-xs font-semibold tracking-widest text-cyan-400 uppercase mb-1">Create</h3>
        <h4 class="text-lg font-medium text-slate-200">新建知识库</h4>
      </div>
      
      <form class="flex flex-col md:flex-row gap-4 items-end" @submit.prevent="createKnowledgeBase">
        <div class="flex-1 flex flex-col gap-2 w-full">
          <label class="text-xs font-semibold text-slate-400 uppercase tracking-widest">名称</label>
          <input 
            v-model="form.name" 
            maxlength="24" 
            required 
            class="px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-slate-200 outline-none focus:border-emerald-500/50 focus:bg-white/5 transition-all text-sm w-full"
            placeholder="知识库名称"
          />
        </div>
        <div class="flex-[2] flex flex-col gap-2 w-full">
          <label class="text-xs font-semibold text-slate-400 uppercase tracking-widest">说明</label>
          <input 
            v-model="form.description" 
            maxlength="120" 
            required 
            class="px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-slate-200 outline-none focus:border-emerald-500/50 focus:bg-white/5 transition-all text-sm w-full"
            placeholder="简短描述内容"
          />
        </div>
        <button 
          type="submit"
          class="w-full md:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:shadow-[0_0_20px_rgba(52,211,153,0.4)] transition-all hover:scale-[1.02] active:scale-95 text-sm"
        >
          创建
        </button>
      </form>
    </div>

    <!-- Grid -->
    <div class="bg-white/5 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
      <KnowledgeBaseGrid
        :active-id="workspace.activeKnowledgeBaseId"
        :items="workspace.knowledgeBases"
        @select="selectKnowledgeBase"
      />
    </div>
  </div>
</template>
