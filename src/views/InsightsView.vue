<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import EmptyState from '@/components/common/EmptyState.vue';
import InsightColumn from '@/components/insights/InsightColumn.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import SurfacePanel from '@/components/common/SurfacePanel.vue';
import { mergeQuery, readQueryString } from '@/lib/route-query';
import { useSessionStore } from '@/stores/session';
import { useWorkspaceStore } from '@/stores/workspace';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const workspace = useWorkspaceStore();
const focusGoal = ref('');

async function refreshSignals() {
  if (!session.token) {
    return;
  }
  await workspace.refreshKnowledgeOutputs(session.token);
}

async function rebuildMemory() {
  if (!session.token) {
    return;
  }
  await workspace.rebuildKnowledgeMemory(session.token);
}

async function generateAdvice() {
  if (!session.token) {
    return;
  }
  await workspace.generateAdvice(session.token, focusGoal.value);
}

watch(
  () => route.query,
  (query) => {
    focusGoal.value = readQueryString(query, 'focus');
  },
  { immediate: true, deep: true },
);

watch(
  focusGoal,
  async (value) => {
    const nextQuery = mergeQuery(route.query, {
      focus: value || undefined,
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
      eyebrow="Review"
      title="Read the current thread."
      description="Review stable patterns from the notebook, then turn them into a tighter next-step plan."
    />

    <SurfacePanel eyebrow="Refresh" title="Review controls">
      <div class="chat-composer__footer review-toolbar">
        <button
          class="ghost-button"
          type="button"
          :disabled="workspace.knowledgeRefreshLoading"
          @click="refreshSignals"
        >
          {{ workspace.knowledgeRefreshLoading ? 'Refreshing...' : 'Refresh Review' }}
        </button>

        <button
          class="primary-button"
          type="button"
          :disabled="workspace.memoryRebuildLoading"
          @click="rebuildMemory"
        >
          {{ workspace.memoryRebuildLoading ? 'Rebuilding...' : 'Rebuild Notes First' }}
        </button>

        <p v-if="workspace.lastMemoryRebuild" class="section-header__description">
          Latest rebuild wrote {{ workspace.lastMemoryRebuild.entry_count }} entries across
          {{ workspace.lastMemoryRebuild.processed_document_count }} docs.
        </p>
      </div>
    </SurfacePanel>

    <div class="retrieve-layout">
      <SurfacePanel eyebrow="Review Deck" title="Current reading">
        <InsightColumn
          v-if="workspace.profile || workspace.growth"
          :growth="workspace.growth"
          :profile="workspace.profile"
        />
        <EmptyState
          v-else
          title="No review yet"
          description="Once profile and growth analysis are stable, the latest reading will appear here."
        />
      </SurfacePanel>

      <SurfacePanel eyebrow="Advice" title="Action notes">
        <form class="chat-composer" @submit.prevent="generateAdvice">
          <label>
              <span>Focus Goal</span>
              <input
                v-model="focusGoal"
                type="text"
                placeholder="Optional. Example: turn scattered notes into a weekly plan"
              />
            </label>

          <div class="chat-composer__footer">
            <button class="primary-button" type="submit" :disabled="workspace.adviceLoading">
              {{ workspace.adviceLoading ? 'Generating...' : 'Generate Plan' }}
            </button>
          </div>
        </form>

        <div v-if="workspace.advice" class="advice-board advice-board--dense">
          <div class="advice-board__main">
            <article class="growth-card growth-card--feature review-item review-item--summary">
              <header>
                <strong>Summary</strong>
                <span class="growth-card__trend" data-trend="up">Live</span>
              </header>
              <p>{{ workspace.advice.advice_summary }}</p>
            </article>

            <article
              v-for="item in workspace.advice.action_suggestions"
              :key="`${item.area}-${item.action}`"
              class="growth-card review-item"
            >
              <header>
                <strong>{{ item.area }}</strong>
                <span class="growth-card__trend" data-trend="steady">Action</span>
              </header>
              <p>{{ item.action }}</p>
              <p><strong>Why now:</strong> {{ item.why_now }}</p>
              <p><strong>First step:</strong> {{ item.first_step }}</p>
              <div v-if="item.evidence_entries.length" class="chip-wrap">
                <span v-for="entry in item.evidence_entries" :key="entry" class="memory-chip">
                  {{ entry }}
                </span>
              </div>
            </article>
          </div>

          <aside class="advice-board__rail">
            <article v-if="workspace.advice.current_priorities.length" class="context-card review-item">
              <strong>Priorities</strong>
              <div class="chip-wrap">
                <span v-for="item in workspace.advice.current_priorities" :key="item" class="memory-chip">
                  {{ item }}
                </span>
              </div>
            </article>

            <article v-if="workspace.advice.one_week_plan.length" class="context-card review-item">
              <strong>One Week</strong>
              <p>{{ workspace.advice.one_week_plan.join(' / ') }}</p>
            </article>

            <article v-if="workspace.advice.avoid_list.length" class="context-card review-item">
              <strong>Avoid</strong>
              <p>{{ workspace.advice.avoid_list.join(' / ') }}</p>
            </article>

            <article v-if="workspace.advice.reflection_questions.length" class="context-card review-item">
              <strong>Reflect</strong>
              <p>{{ workspace.advice.reflection_questions.join(' / ') }}</p>
            </article>
          </aside>
        </div>

        <EmptyState
          v-else
          title="No action plan yet"
          description="Generate a plan after the review view has data."
        />
      </SurfacePanel>
    </div>
  </div>
</template>
