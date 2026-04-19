<script setup lang="ts">
import ChatComposer from '@/components/chat/ChatComposer.vue';
import SourceCard from '@/components/chat/SourceCard.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { useSessionStore } from '@/stores/session';
import { useWorkspaceStore } from '@/stores/workspace';

const session = useSessionStore();
const workspace = useWorkspaceStore();

async function submit(payload: { question: string; topK: number }) {
  if (!session.token) return;
  await workspace.ask(session.token, payload);
}
</script>

<template>
  <div class="flex flex-col h-full max-w-5xl mx-auto pb-6 relative">
    
    <!-- Decorative Header -->
    <div class="flex flex-col gap-2 mb-8">
      <div class="flex items-center gap-2">
        <div class="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]"></div>
        <span class="text-[10px] font-bold tracking-widest text-purple-400 uppercase">RAG Query Interface</span>
      </div>
      <h2 class="text-2xl font-light text-slate-100">在答案旁边保留来源，避免信息黑盒</h2>
    </div>

    <!-- Chat History -->
    <div class="flex-1 overflow-y-auto space-y-8 pr-4 -mr-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent mb-6">
      
      <EmptyState
        v-if="!workspace.chats.length"
        class="my-10"
        title="等待发起对话"
        description="输入问题，工作台会把生成回答和来源片段关联在一起。"
      />

      <div
        v-for="(exchange, index) in workspace.chats"
        :key="exchange.id"
        class="flex flex-col gap-6"
      >
        <!-- User Question -->
        <div class="flex flex-col items-end w-full group">
          <div class="flex items-center gap-2 mb-2 px-2">
            <span class="text-xs font-semibold text-slate-500">YOU</span>
          </div>
          <div class="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-tr from-purple-600 to-indigo-500 p-4 text-white shadow-lg shadow-purple-500/20 backdrop-blur-md">
            <p class="leading-relaxed text-sm">{{ exchange.question }}</p>
          </div>
        </div>

        <!-- AI Answer -->
        <div class="flex flex-col items-start w-full gap-4 group">
          <div class="flex items-center gap-2 mb-1 px-2">
             <div class="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center p-[1px]">
               <div class="w-full h-full bg-slate-900 rounded-full flex items-center justify-center">
                 <span class="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"></span>
               </div>
             </div>
             <span class="text-xs font-semibold text-cyan-400">MNEME AI</span>
          </div>
          
          <div class="flex gap-4 max-w-[95%]">
            <!-- Answer Bubble -->
            <div class="flex-1 rounded-2xl rounded-tl-sm bg-slate-900/80 border border-white/10 p-5 text-slate-200 shadow-xl backdrop-blur-md relative overflow-hidden">
              <div class="absolute top-0 left-0 w-1/2 h-[1px] bg-gradient-to-r from-cyan-500 to-transparent"></div>
              <p class="leading-relaxed text-sm whitespace-pre-wrap">{{ exchange.answer }}</p>
            </div>

            <!-- Sources Side Panel -->
            <div class="w-72 shrink-0 flex flex-col gap-3">
              <span class="text-[10px] font-bold tracking-widest text-slate-500 uppercase px-1 flex items-center gap-2">
                 <div class="w-1 h-1 rounded-full bg-slate-500"></div> Sources
              </span>
              <div class="flex flex-col gap-2 rounded-xl bg-black/30 border border-white/5 p-2">
                 <!-- Source Card styling happens within the child component, but standard wrap bounds -->
                 <SourceCard
                   v-for="source in exchange.sources"
                   :key="`${exchange.id}-${source.chunk_id}`"
                   :source="source"
                 />
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="index !== workspace.chats.length - 1" class="h-px w-full bg-gradient-to-r from-transparent via-white/5 to-transparent my-4"></div>
      </div>
    </div>

    <!-- Input Composer at the bottom -->
    <div class="shrink-0 pt-2 relative z-20">
       <div class="absolute inset-x-0 bottom-0 top-[-2rem] bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent pointer-events-none"></div>
       <div class="relative z-10 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl p-2 transition-all focus-within:border-cyan-500/50 focus-within:bg-white/10">
         <ChatComposer @submit="submit" />
       </div>
    </div>
  </div>
</template>
