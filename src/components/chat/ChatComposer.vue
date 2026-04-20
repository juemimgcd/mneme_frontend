<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { ArrowUp, LibraryBig, PanelRightOpen, Search } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    question?: string;
    topK?: number;
    loading?: boolean;
    knowledgeBaseName?: string;
  }>(),
  {
    question: '',
    topK: 4,
    loading: false,
    knowledgeBaseName: 'No shelf selected',
  },
);

const emit = defineEmits<{
  (event: 'submit', payload: { question: string; topK: number }): void;
  (event: 'update:question', value: string): void;
  (event: 'update:topK', value: number): void;
  (event: 'open-tools'): void;
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);

const question = computed({
  get: () => props.question,
  set: (value: string) => emit('update:question', value),
});

const topK = computed({
  get: () => props.topK,
  set: (value: number) => emit('update:topK', value),
});

watch(
  () => question.value,
  async () => {
    await nextTick();
    adjustHeight();
  },
);

onMounted(() => {
  adjustHeight(true);
});

function adjustHeight(reset = false) {
  const textarea = textareaRef.value;
  if (!textarea) {
    return;
  }

  if (reset) {
    textarea.style.height = '64px';
  }

  textarea.style.height = '64px';
  const nextHeight = Math.max(64, Math.min(textarea.scrollHeight, 220));
  textarea.style.height = `${nextHeight}px`;
}

function submit() {
  if (!question.value.trim() || props.loading) {
    return;
  }

  emit('submit', {
    question: question.value.trim(),
    topK: topK.value,
  });
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    submit();
  }
}
</script>

<template>
  <form class="chat-dock" @submit.prevent="submit">
    <div class="chat-dock__body">
      <div class="chat-dock__lead">
        <div class="chat-dock__badge">
          <LibraryBig :size="14" />
          <span>{{ knowledgeBaseName }}</span>
        </div>
        <div class="chat-dock__badge">
          <Search :size="14" />
          <span>Top-K {{ topK }}</span>
        </div>
      </div>

      <textarea
        ref="textareaRef"
        v-model="question"
        class="chat-dock__textarea"
        rows="1"
        placeholder="Ask grounded questions about this shelf. Shift+Enter for a new line."
        @keydown="handleKeydown"
      />
    </div>

    <div class="chat-dock__footer">
      <button class="chat-dock__tool" type="button" @click="$emit('open-tools')">
        <PanelRightOpen :size="14" />
        <span>Tools</span>
      </button>

      <label class="chat-dock__stepper">
        <span>Passages</span>
        <input v-model.number="topK" min="1" max="8" type="number" />
      </label>

      <button class="chat-dock__send" type="submit" :disabled="!question.trim() || loading">
        <ArrowUp :size="16" />
        <span>{{ loading ? 'Searching' : 'Send' }}</span>
      </button>
    </div>
  </form>
</template>

<style scoped>
.chat-dock {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid var(--app-line);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 62%),
    color-mix(in srgb, var(--app-panel) 90%, transparent);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22);
}

.chat-dock__body {
  display: grid;
  gap: 0.75rem;
}

.chat-dock__lead {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.chat-dock__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 30px;
  padding: 0.25rem 0.7rem;
  border: 1px solid var(--app-line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--app-ink-soft);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
}

.chat-dock__textarea {
  width: 100%;
  min-height: 64px;
  max-height: 220px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-ink);
  font-family: 'Newsreader', 'Fraunces', serif;
  font-size: 1.08rem;
  line-height: 1.55;
  resize: none;
  outline: none;
}

.chat-dock__textarea::placeholder {
  color: var(--app-ink-muted);
}

.chat-dock__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.85rem;
  align-items: center;
}

.chat-dock__tool,
.chat-dock__send {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 38px;
  padding: 0.5rem 0.85rem;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
}

.chat-dock__tool {
  border: 1px solid var(--app-line);
  background: rgba(255, 255, 255, 0.05);
  color: var(--app-ink);
}

.chat-dock__send {
  border: 1px solid color-mix(in srgb, var(--app-accent) 30%, transparent);
  background: linear-gradient(135deg, var(--app-accent), var(--app-accent-strong));
  color: #081019;
}

.chat-dock__send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.chat-dock__stepper {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--app-ink-soft);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
}

.chat-dock__stepper input {
  width: 68px;
  min-height: 38px;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--app-line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--app-ink);
}

@media (max-width: 720px) {
  .chat-dock__footer {
    align-items: stretch;
    flex-direction: column;
  }

  .chat-dock__tool,
  .chat-dock__send,
  .chat-dock__stepper {
    width: 100%;
    justify-content: center;
  }
}
</style>
