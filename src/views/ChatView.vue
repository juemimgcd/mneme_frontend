<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FileUp, Sparkles } from 'lucide-vue-next';
import ChatComposer from '@/components/chat/ChatComposer.vue';
import SourceCard from '@/components/chat/SourceCard.vue';
import SurfacePanel from '@/components/common/SurfacePanel.vue';
import { mergeQuery, readQueryNumber, readQueryString } from '@/lib/route-query';
import { useSessionStore } from '@/stores/session';
import { useWorkspaceStore } from '@/stores/workspace';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const workspace = useWorkspaceStore();

const question = ref('');
const topK = ref(4);
const companionQuestion = ref('');
const companionTopK = ref(4);
const answerLoading = ref(false);
const toolsOpen = ref(false);
const uploadKnowledgeBaseId = ref('');
const uploadFiles = ref<File[]>([]);
const uploadLoading = ref(false);
const pendingQuestion = ref('');
const threadRef = ref<HTMLElement | null>(null);
const uploadInputRef = ref<HTMLInputElement | null>(null);

const promptSuggestions = [
  'Summarize the strongest themes from my recent notes.',
  'What documents should I review next if I want better retrieval quality?',
  'Turn the latest notes into one concise weekly synthesis.',
];

const activeKnowledgeBaseName = computed(
  () => workspace.currentKnowledgeBase?.name ?? 'No shelf selected',
);

const orderedChats = computed(() =>
  [...workspace.chats].sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
  ),
);

const selectedUploadKnowledgeBase = computed(
  () => workspace.knowledgeBases.find((item) => item.id === uploadKnowledgeBaseId.value) ?? null,
);

watch(
  () => route.query,
  (query) => {
    question.value = readQueryString(query, 'q');
    topK.value = readQueryNumber(query, 'topk', 4);
  },
  { immediate: true, deep: true },
);

watch(
  [question, topK],
  async ([nextQuestion, nextTopK]) => {
    const nextQuery = mergeQuery(route.query, {
      q: nextQuestion || undefined,
      topk: nextTopK !== 4 ? nextTopK : undefined,
    });

    if (JSON.stringify(nextQuery) === JSON.stringify(route.query)) {
      return;
    }

    await router.replace({
      path: route.path,
      query: nextQuery,
    });
  },
);

watch(
  () => [workspace.activeKnowledgeBaseId, workspace.knowledgeBases.length] as const,
  () => {
    if (
      !uploadKnowledgeBaseId.value ||
      !workspace.knowledgeBases.some((item) => item.id === uploadKnowledgeBaseId.value)
    ) {
      uploadKnowledgeBaseId.value = workspace.activeKnowledgeBaseId || workspace.knowledgeBases[0]?.id || '';
    }
  },
  { immediate: true },
);

watch(
  [orderedChats, pendingQuestion, answerLoading],
  async () => {
    await nextTick();
    scrollThreadToBottom();
  },
  { deep: true, immediate: true },
);

async function submit(payload: { question: string; topK: number }) {
  if (!session.token) {
    return;
  }

  const nextQuestion = payload.question.trim();
  pendingQuestion.value = nextQuestion;
  question.value = '';
  answerLoading.value = true;
  try {
    await workspace.ask(session.token, {
      question: nextQuestion,
      topK: payload.topK,
    });
  } catch (error) {
    question.value = nextQuestion;
    console.warn('Unable to submit chat question:', error);
  } finally {
    pendingQuestion.value = '';
    answerLoading.value = false;
  }
}

async function submitCompanion() {
  if (!session.token || !companionQuestion.value.trim()) {
    return;
  }

  await workspace.askCompanion(session.token, {
    question: companionQuestion.value.trim(),
    topK: companionTopK.value,
  });
}

function pickPrompt(prompt: string) {
  question.value = prompt;
}

function handleFileSelection(event: Event) {
  uploadFiles.value = Array.from((event.target as HTMLInputElement).files ?? []);
}

function scrollThreadToBottom() {
  const container = threadRef.value;
  if (!container) {
    return;
  }

  container.scrollTop = container.scrollHeight;
}

async function uploadFromChat() {
  if (!session.token || !uploadFiles.value.length || !uploadKnowledgeBaseId.value) {
    return;
  }

  uploadLoading.value = true;
  try {
    const uploaded = await workspace.uploadDocuments(
      session.token,
      uploadFiles.value,
      uploadKnowledgeBaseId.value,
    );
    await Promise.all(uploaded.map((item) => workspace.indexDocument(session.token as string, item.id)));
    uploadFiles.value = [];
    if (uploadInputRef.value) {
      uploadInputRef.value.value = '';
    }
  } finally {
    uploadLoading.value = false;
  }
}
</script>

<template>
  <div class="view-stack chat-page">
    <div class="chat-page__header">
      <div class="chat-page__heading">
        <p class="chat-page__eyebrow">Notebook chat</p>
        <div class="chat-page__title-row">
          <h1>Grounded answers in one thread</h1>
          <span class="inline-badge">{{ activeKnowledgeBaseName }}</span>
        </div>
        <p class="chat-page__description">
          Keep the main canvas for dialogue. Open the right rail only when you need uploads,
          draft tools, or extra controls.
        </p>
      </div>

      <button class="ghost-button chat-page__tools-trigger" type="button" @click="toolsOpen = true">
        Open Tools
      </button>
    </div>

    <SurfacePanel class="chat-page__surface">
      <div class="chat-room">
        <div ref="threadRef" class="chat-room__thread">
          <template v-if="orderedChats.length || pendingQuestion">
            <article v-for="exchange in orderedChats" :key="exchange.id" class="chat-turn">
              <div class="chat-turn__question">
                <span class="chat-turn__eyebrow">You</span>
                <p>{{ exchange.question }}</p>
              </div>

              <div class="chat-turn__answer">
                <div class="chat-turn__answer-main">
                  <span class="chat-turn__eyebrow">Notebook</span>
                  <p>{{ exchange.answer }}</p>
                </div>

                <div v-if="exchange.sources.length" class="chat-turn__sources">
                  <SourceCard
                    v-for="source in exchange.sources"
                    :key="`${source.document_id}-${source.chunk_id}`"
                    :source="source"
                  />
                </div>
              </div>
            </article>

            <article v-if="pendingQuestion" class="chat-turn chat-turn--pending">
              <div class="chat-turn__question">
                <span class="chat-turn__eyebrow">You</span>
                <p>{{ pendingQuestion }}</p>
              </div>

              <div class="chat-turn__answer">
                <div class="chat-turn__answer-main chat-turn__answer-main--thinking">
                  <span class="chat-turn__eyebrow">Notebook</span>
                  <p>Thinking through your notes and building a grounded answer...</p>
                </div>
              </div>
            </article>
          </template>

          <div v-else class="chat-empty">
            <div class="chat-empty__hero">
              <p class="chat-empty__eyebrow">Notebook dialogue</p>
              <h2>Answers stay above. Your composer stays below.</h2>
              <p>
                This shelf is currently set to <strong>{{ activeKnowledgeBaseName }}</strong>. Ask a grounded
                question or use the tools rail to upload more material into a target knowledge base.
              </p>
            </div>

            <div class="chat-empty__suggestions">
              <button
                v-for="item in promptSuggestions"
                :key="item"
                class="chat-empty__chip"
                type="button"
                @click="pickPrompt(item)"
              >
                {{ item }}
              </button>
            </div>
          </div>
        </div>

        <div class="chat-room__composer">
          <ChatComposer
            v-model:question="question"
            v-model:top-k="topK"
            :knowledge-base-name="activeKnowledgeBaseName"
            :loading="answerLoading"
            @submit="submit"
            @open-tools="toolsOpen = true"
          />
        </div>
      </div>
    </SurfacePanel>

    <div v-if="toolsOpen" class="chat-tools__backdrop" @click="toolsOpen = false" />
    <aside class="chat-tools" :data-open="toolsOpen">
      <div class="chat-tools__panel">
        <div class="chat-tools__header">
          <div>
            <p class="chat-tools__eyebrow">Tools rail</p>
            <h2>Upload, scope, and draft</h2>
          </div>
          <button class="ghost-button chat-page__tools-trigger" type="button" @click="toolsOpen = false">
            Close
          </button>
        </div>

        <div class="chat-tools__content">
          <article class="context-card chat-tools__card">
            <header class="knowledge-card__header">
              <strong>Ask from</strong>
              <span class="inline-badge">{{ activeKnowledgeBaseName }}</span>
            </header>
            <p>The main conversation always queries the currently active shelf from the top bar.</p>
          </article>

          <article class="context-card chat-tools__card">
            <header class="knowledge-card__header">
              <strong>
                <FileUp :size="15" />
                Upload in chat
              </strong>
              <span class="inline-badge">{{ uploadFiles.length }} files</span>
            </header>
            <p>Choose a target knowledge base here, upload files, and they will start indexing immediately.</p>

            <label class="chat-tools__field">
              <span>Target knowledge base</span>
              <select v-model="uploadKnowledgeBaseId">
                <option v-for="item in workspace.knowledgeBases" :key="item.id" :value="item.id">
                  {{ item.name }}
                </option>
              </select>
            </label>

            <label class="chat-tools__field">
              <span>Files</span>
              <input ref="uploadInputRef" type="file" multiple @change="handleFileSelection" />
            </label>

            <button
              class="primary-button chat-tools__submit"
              type="button"
              :disabled="uploadLoading || !uploadFiles.length || !selectedUploadKnowledgeBase"
              @click="uploadFromChat"
            >
              {{ uploadLoading ? 'Uploading...' : 'Upload and index' }}
            </button>
          </article>

          <article class="context-card chat-tools__card">
            <header class="knowledge-card__header">
              <strong>
                <Sparkles :size="15" />
                Draft from notes
              </strong>
              <span class="inline-badge">Companion</span>
            </header>

            <form class="chat-tools__draft" @submit.prevent="submitCompanion">
              <label class="chat-tools__field">
                <span>Question</span>
                <textarea
                  v-model="companionQuestion"
                  rows="4"
                  placeholder="Turn the strongest recent notes into a clean draft answer."
                />
              </label>

              <div class="chat-tools__draft-footer">
                <label class="chat-tools__field">
                  <span>Top-K</span>
                  <input v-model.number="companionTopK" min="1" max="10" type="number" />
                </label>
                <button class="primary-button" type="submit" :disabled="workspace.companionLoading">
                  {{ workspace.companionLoading ? 'Thinking...' : 'Draft reply' }}
                </button>
              </div>
            </form>
          </article>

          <template v-if="workspace.companion">
            <article class="chat-bubble chat-bubble--answer chat-tools__card">
              <strong>Direct answer</strong>
              <p>{{ workspace.companion.direct_answer }}</p>
            </article>

            <article class="context-card chat-tools__card">
              <header class="knowledge-card__header">
                <strong>Notebook draft</strong>
                <span class="inline-badge">Synthesized</span>
              </header>
              <p>{{ workspace.companion.companion_message }}</p>
            </article>

            <article v-if="workspace.companion.next_step_hint" class="context-card chat-tools__card">
              <strong>Next step</strong>
              <p>{{ workspace.companion.next_step_hint }}</p>
            </article>
          </template>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.chat-page {
  gap: 0.85rem;
}

.chat-page__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: start;
}

.chat-page__heading {
  display: grid;
  gap: 0.3rem;
}

.chat-page__eyebrow {
  margin: 0;
  color: var(--app-ink-muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.chat-page__title-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.chat-page__title-row h1 {
  margin: 0;
  color: var(--app-ink);
  font-family: 'Fraunces', serif;
  font-size: clamp(1.55rem, 2vw, 2.1rem);
  font-weight: 500;
  line-height: 1.05;
}

.chat-page__description {
  max-width: 72ch;
  margin: 0;
  color: var(--app-ink-soft);
  line-height: 1.55;
}

.chat-page__tools-trigger {
  white-space: nowrap;
}

.chat-page__surface {
  min-height: min(84vh, 1040px);
}

.chat-room {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-height: min(76vh, 960px);
}

.chat-room__thread {
  overflow-y: auto;
  padding-right: 0.2rem;
  scroll-behavior: smooth;
}

.chat-room__composer {
  position: sticky;
  bottom: 0;
  padding-top: 1rem;
  background: linear-gradient(
    180deg,
    rgba(7, 9, 13, 0),
    color-mix(in srgb, var(--app-paper) 94%, transparent) 24%
  );
}

.chat-turn {
  display: grid;
  gap: 0.9rem;
  padding: 1rem 0;
  border-bottom: 1px solid color-mix(in srgb, var(--app-line) 72%, transparent);
}

.chat-turn:first-child {
  padding-top: 0;
}

.chat-turn__question,
.chat-turn__answer-main {
  display: grid;
  gap: 0.45rem;
  max-width: min(78ch, 100%);
  padding: 1rem 1.05rem;
  border-radius: 20px;
}

.chat-turn__question {
  justify-self: end;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 78%),
    color-mix(in srgb, var(--app-panel-muted) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--app-line) 80%, transparent);
}

.chat-turn__answer {
  display: grid;
  gap: 0.85rem;
}

.chat-turn__answer-main {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 78%),
    color-mix(in srgb, var(--app-panel) 94%, transparent);
  border: 1px solid color-mix(in srgb, var(--app-line) 84%, transparent);
}

.chat-turn__answer-main--thinking {
  border-style: dashed;
  animation: thinkingPulse 1.6s ease-in-out infinite;
}

.chat-turn__question p,
.chat-turn__answer-main p {
  margin: 0;
  color: var(--app-ink);
  font-family: 'Newsreader', 'Fraunces', serif;
  font-size: 1.02rem;
  line-height: 1.7;
}

.chat-turn__eyebrow,
.chat-empty__eyebrow,
.chat-tools__eyebrow,
.chat-tools__field span {
  color: var(--app-ink-muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.chat-turn__sources {
  display: grid;
  gap: 0.75rem;
  padding-left: 0.5rem;
}

.chat-empty {
  display: grid;
  gap: 1.5rem;
  align-content: center;
  min-height: 100%;
}

.chat-empty__hero {
  display: grid;
  gap: 0.5rem;
  max-width: 72ch;
}

.chat-empty__hero h2 {
  margin: 0;
  color: var(--app-ink);
  font-family: 'Fraunces', serif;
  font-size: clamp(2rem, 2.8vw, 3rem);
  font-weight: 500;
  line-height: 1.02;
}

.chat-empty__hero p {
  margin: 0;
  color: var(--app-ink-soft);
  font-size: 1rem;
  line-height: 1.7;
}

.chat-empty__suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.chat-empty__chip {
  padding: 0.7rem 1rem;
  border: 1px solid var(--app-line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--app-ink);
  cursor: pointer;
  transition: transform 180ms ease, border-color 180ms ease, background-color 180ms ease;
}

.chat-empty__chip:hover {
  transform: translateY(-1px);
  border-color: var(--app-line-strong);
  background: rgba(255, 255, 255, 0.08);
}

.chat-tools__backdrop {
  position: fixed;
  inset: 0;
  z-index: 35;
  background: rgba(4, 6, 10, 0.5);
  backdrop-filter: blur(2px);
}

.chat-tools {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  width: min(460px, 92vw);
  pointer-events: none;
}

.chat-tools__panel {
  position: absolute;
  top: 0;
  right: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: 100%;
  height: 100%;
  padding: 1.15rem;
  border-left: 1px solid var(--app-line);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 20%),
    color-mix(in srgb, var(--app-paper-strong) 96%, transparent);
  box-shadow: -16px 0 40px rgba(0, 0, 0, 0.32);
  transform: translateX(104%);
  transition: transform 240ms ease;
  pointer-events: auto;
}

.chat-tools[data-open='true'] .chat-tools__panel {
  transform: translateX(0);
}

.chat-tools__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: start;
  padding-bottom: 1rem;
  border-bottom: 1px solid color-mix(in srgb, var(--app-line) 78%, transparent);
}

.chat-tools__header h2 {
  margin: 0.2rem 0 0;
  color: var(--app-ink);
  font-family: 'Fraunces', serif;
  font-size: 1.3rem;
  font-weight: 500;
}

.chat-tools__content {
  display: grid;
  gap: 0.9rem;
  align-content: start;
  overflow-y: auto;
  padding-top: 1rem;
}

.chat-tools__card {
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 74%),
    color-mix(in srgb, var(--app-panel) 92%, transparent);
}

.chat-tools__card p {
  margin: 0;
  color: var(--app-ink-soft);
  line-height: 1.65;
}

.chat-tools__card strong {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.chat-tools__field {
  display: grid;
  gap: 0.35rem;
}

.chat-tools__field select,
.chat-tools__field input,
.chat-tools__field textarea {
  min-height: 44px;
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--app-line);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--app-ink);
}

.chat-tools__field textarea {
  min-height: 110px;
  resize: vertical;
  font-family: 'Newsreader', 'Fraunces', serif;
}

.chat-tools__submit {
  width: 100%;
}

.chat-tools__draft {
  display: grid;
  gap: 0.85rem;
}

.chat-tools__draft-footer {
  display: flex;
  gap: 0.75rem;
  align-items: end;
}

.chat-tools__draft-footer .chat-tools__field {
  flex: 1;
}

@keyframes thinkingPulse {
  0%,
  100% {
    opacity: 0.7;
  }

  50% {
    opacity: 1;
  }
}

@media (max-width: 900px) {
  .chat-page__header {
    align-items: stretch;
    flex-direction: column;
  }

  .chat-room {
    min-height: 76vh;
  }
}

@media (max-width: 720px) {
  .chat-tools__draft-footer {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
