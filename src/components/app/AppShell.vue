<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import AppIcon from '@/components/common/AppIcon.vue';
import { useSessionStore } from '@/stores/session';
import { useWorkspaceStore } from '@/stores/workspace';
import { useTheme } from '@/composables/useTheme';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const workspace = useWorkspaceStore();
const { theme, toggleTheme } = useTheme();

const navigation = [
  { name: 'dashboard', label: '总览', icon: 'vault' as const },
  { name: 'knowledge-bases', label: '知识库', icon: 'spark' as const },
  { name: 'documents', label: '文档', icon: 'upload' as const },
  { name: 'chat', label: '问答', icon: 'chat' as const },
  { name: 'memory', label: '记忆库', icon: 'memory' as const },
  { name: 'insights', label: '洞察', icon: 'insight' as const },
];

const routeTitle = computed(() => {
  const current = navigation.find((item) => item.name === route.name);
  return current?.label ?? '工作台';
});

onMounted(async () => {
  if (session.user && session.token && !workspace.knowledgeBases.length) {
    await workspace.initialize(session.user.id, session.token);
  }
});

async function handleKnowledgeBaseChange(event: Event) {
  const nextId = (event.target as HTMLSelectElement).value;
  if (session.token) {
    await workspace.selectKnowledgeBase(nextId, session.token);
  }
}

function logout() {
  session.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <div class="flex h-screen w-screen bg-slate-950 text-slate-300 overflow-hidden font-sans selection:bg-purple-500/30 selection:text-purple-200">
    <!-- Dynamic Background Elements -->
    <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div class="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-purple-900/20 blur-[120px]"></div>
      <div class="absolute top-[40%] -right-[20%] w-[60%] h-[60%] rounded-full bg-cyan-900/10 blur-[150px]"></div>
      <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20"></div>
    </div>

    <!-- Sidebar -->
    <aside class="relative z-10 w-72 flex flex-col border-r border-white/5 bg-slate-950/50 backdrop-blur-2xl transition-all duration-300">
      <div class="p-6">
        <RouterLink class="flex items-center gap-4 group" :to="{ name: 'dashboard' }">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-400 text-white font-bold text-xl shadow-[0_0_20px_rgba(168,85,247,0.4)] group-hover:shadow-[0_0_25px_rgba(168,85,247,0.6)] group-hover:scale-105 transition-all duration-300">
            M
          </div>
          <div class="flex flex-col">
            <span class="text-slate-100 font-semibold tracking-wide text-lg">Mneme</span>
            <span class="text-xs text-slate-500 font-medium tracking-wider uppercase">Workspace</span>
          </div>
        </RouterLink>
      </div>

      <nav class="flex-1 px-4 py-6 flex flex-col gap-2">
        <RouterLink
          v-for="item in navigation"
          :key="item.name"
          :to="{ name: item.name }"
          class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium hover:bg-white/5 hover:text-white"
          exact-active-class="bg-purple-500/15 text-purple-300 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.2)]"
        >
          <AppIcon :name="item.icon" class="w-5 h-5 opacity-80" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="p-4 mx-4 mb-4 rounded-xl bg-white/5 border border-white/5 backdrop-blur-md">
        <p class="text-[11px] leading-relaxed text-slate-400">
          <span class="inline-block w-2 h-2 rounded-full bg-cyan-400 mr-1 animate-pulse"></span>
          Mock 演示模式已启用。接入后端时可在 .env 跨越数据层。
        </p>
      </div>
    </aside>

    <!-- Main Content Area -->
    <div class="relative z-10 flex-1 flex flex-col min-w-0">
      <header class="h-20 flex items-center justify-between px-10 border-b border-white/5 bg-slate-950/30 backdrop-blur-xl">
        <div class="flex flex-col">
          <span class="text-xs font-semibold tracking-widest text-purple-400 uppercase">Intelligent Layer</span>
          <h1 class="text-2xl font-light text-slate-100">{{ routeTitle }}</h1>
        </div>

        <div class="flex items-center gap-6">
          <div class="flex items-center gap-3 px-4 py-2 rounded-full border border-white/10 bg-black/40 backdrop-blur-md focus-within:border-purple-500/50 transition-colors">
            <span class="text-xs font-medium text-slate-400">上下文</span>
            <select
              :value="workspace.activeKnowledgeBaseId"
              class="bg-transparent text-sm text-slate-200 outline-none cursor-pointer appearance-none pr-4"
              @change="handleKnowledgeBaseChange"
            >
              <option
                v-for="item in workspace.knowledgeBases"
                :key="item.id"
                :value="item.id"
                class="bg-slate-900"
              >
                {{ item.name }}
              </option>
            </select>
            <div class="pointer-events-none w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-slate-400"></div>
          </div>

          <button @click="toggleTheme" class="p-2.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all">
            <AppIcon :name="theme === 'dark' ? 'sun' : 'moon'" class="w-5 h-5" />
          </button>

          <div class="h-6 w-px bg-white/10"></div>

          <button @click="logout" class="flex items-center gap-2 group">
            <div class="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 p-[2px]">
              <div class="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                <span class="text-xs font-bold text-white">{{ session.user?.username?.charAt(0).toUpperCase() || 'U' }}</span>
              </div>
            </div>
          </button>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto overflow-x-hidden p-8">
        <router-view v-slot="{ Component }">
          <transition 
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="opacity-0 translate-y-4 filter blur-sm"
            enter-to-class="opacity-100 translate-y-0 filter blur-0"
            leave-active-class="transition-all duration-200 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-4"
            mode="out-in"
          >
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<style scoped>
select {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}
</style>
