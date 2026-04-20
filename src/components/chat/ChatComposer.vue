<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    question?: string;
    topK?: number;
  }>(),
  {
    question: '',
    topK: 4,
  },
);

const emit = defineEmits<{
  (event: 'submit', payload: { question: string; topK: number }): void;
  (event: 'update:question', value: string): void;
  (event: 'update:topK', value: number): void;
}>();

const question = computed({
  get: () => props.question,
  set: (value: string) => emit('update:question', value),
});

const topK = computed({
  get: () => props.topK,
  set: (value: number) => emit('update:topK', value),
});

function submit() {
  if (!question.value.trim()) {
    return;
  }

  emit('submit', {
    question: question.value.trim(),
    topK: topK.value,
  });
}
</script>

<template>
  <form class="chat-composer" @submit.prevent="submit">
    <label>
      <span>Question</span>
      <textarea
        v-model="question"
        rows="4"
        placeholder="Summarize the main themes from my recent notes and cite the most relevant passages."
      />
    </label>

    <div class="chat-composer__footer">
      <label>
        <span>Passages</span>
        <input v-model.number="topK" min="1" max="8" type="number" />
      </label>
      <button class="primary-button" type="submit">Search Notes</button>
    </div>
  </form>
</template>
