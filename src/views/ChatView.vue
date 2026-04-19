<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ChatComposer from '@/components/chat/ChatComposer.vue';
import SourceCard from '@/components/chat/SourceCard.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
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

async function submit(payload: { question: string; topK: number }) {
  if (!session.token) {
    return;
  }
  await workspace.ask(session.token, payload);
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

watch(
  () => route.query,
  (query) => {
    question.value = readQueryString(query, 'q');
    topK.value = readQueryNumber(query, 'topk', 4);
    companionQuestion.value = readQueryString(query, 'cq');
    companionTopK.value = readQueryNumber(query, 'ctopk', 4);
  },
  { immediate: true, deep: true },
);

watch(
  [question, topK, companionQuestion, companionTopK],
  async ([nextQuestion, nextTopK, nextCompanionQuestion, nextCompanionTopK]) => {
    const nextQuery = mergeQuery(route.query, {
      q: nextQuestion || undefined,
      topk: nextTopK !== 4 ? nextTopK : undefined,
      cq: nextCompanionQuestion || undefined,
      ctopk: nextCompanionTopK !== 4 ? nextCompanionTopK : undefined,
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
</script>

<template>
  <div class="view-stack">
    <SectionHeader
      eyebrow="Retrieve"
      title="Retrieve and converse."
      description="Direct RAG on the left. Higher-level companion output on the right."
    />

    <div class="retrieve-layout">
      <SurfacePanel eyebrow="RAG" title="Grounded retrieval">
        <ChatComposer
          v-model:question="question"
          v-model:top-k="topK"
          @submit="submit"
        />
      </SurfacePanel>

      <SurfacePanel eyebrow="Companion" title="Synthesis reply">
        <form class="chat-composer" @submit.prevent="submitCompanion">
          <label>
            <span>Question</span>
            <textarea
              v-model="companionQuestion"
              rows="4"
              placeholder="What should I focus on next based on my current memory and growth?"
            />
          </label>

          <div class="chat-composer__footer">
            <label>
              <span>Top-K</span>
              <input v-model.number="companionTopK" min="1" max="10" type="number" />
            </label>
            <button class="primary-button" type="submit" :disabled="workspace.companionLoading">
              {{ workspace.companionLoading ? 'Thinking...' : 'Ask Companion' }}
            </button>
          </div>
        </form>

        <div v-if="workspace.companion" class="companion-board">
          <div class="companion-board__main">
            <article class="chat-bubble chat-bubble--answer chat-bubble--feature">
              <strong>Answer</strong>
              <p>{{ workspace.companion.direct_answer }}</p>
            </article>

            <article class="context-card">
              <header class="knowledge-card__header">
                <strong>Companion</strong>
                <span class="inline-badge">Synthesized</span>
              </header>
              <p>{{ workspace.companion.companion_message }}</p>
            </article>
          </div>

          <aside class="companion-board__rail">
            <article v-if="workspace.companion.next_step_hint" class="context-card">
              <strong>Next</strong>
              <p>{{ workspace.companion.next_step_hint }}</p>
            </article>

            <article class="context-card">
              <strong>Profile</strong>
              <p>{{ workspace.companion.profile_snapshot }}</p>
            </article>

            <article class="context-card">
              <strong>Growth</strong>
              <p>{{ workspace.companion.growth_snapshot }}</p>
            </article>

            <article v-if="workspace.companion.follow_up_questions.length" class="context-card">
              <strong>Follow-ups</strong>
              <div class="chip-wrap">
                <span
                  v-for="item in workspace.companion.follow_up_questions"
                  :key="item"
                  class="memory-chip"
                >
                  {{ item }}
                </span>
              </div>
            </article>

            <article
              v-for="citation in workspace.companion.citations"
              :key="`${citation.document_id}-${citation.chunk_id}`"
              class="source-card"
            >
              <header>
                <strong>{{ citation.document_id }}</strong>
                <span>{{ citation.page_no ?? 'No page' }}</span>
              </header>
              <p>{{ citation.text }}</p>
              <small>{{ citation.reason }}</small>
            </article>
          </aside>
        </div>
      </SurfacePanel>
    </div>

    <section v-if="workspace.chats.length" class="chat-stack">
      <SurfacePanel
        v-for="exchange in workspace.chats"
        :key="exchange.id"
        eyebrow="Retrieval Run"
        title="Grounded answer"
      >
        <div class="retrieval-run">
          <div class="retrieval-run__main">
            <div class="chat-answer">
              <div class="chat-bubble chat-bubble--question">
                <strong>Q</strong>
                <p>{{ exchange.question }}</p>
              </div>
              <div class="chat-bubble chat-bubble--answer">
                <strong>A</strong>
                <p>{{ exchange.answer }}</p>
              </div>
            </div>
          </div>

          <aside class="retrieval-run__rail">
            <SourceCard
              v-for="source in exchange.sources"
              :key="`${source.document_id}-${source.chunk_id}`"
              :source="source"
            />
          </aside>
        </div>
      </SurfacePanel>
    </section>

    <EmptyState
      v-else
      title="No retrieval history yet"
      description="Run a query and the workspace will keep both the answer and its supporting chunks."
    />
  </div>
</template>
