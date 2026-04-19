<script setup lang="ts">
import { ref } from 'vue';
import AppIcon from '@/components/common/AppIcon.vue';

const emit = defineEmits<{
  (event: 'upload', files: File[]): void;
}>();

const files = ref<File[]>([]);

function handleFiles(event: Event) {
  const nextFiles = Array.from((event.target as HTMLInputElement).files ?? []);
  files.value = nextFiles;
}

function submit() {
  if (!files.value.length) {
    return;
  }
  emit('upload', files.value);
  files.value = [];
}
</script>

<template>
  <div class="upload-zone">
    <div class="upload-zone__icon">
      <AppIcon name="upload" />
    </div>
    <div>
      <h3>Upload source material</h3>
      <p>Supports `.pdf`, `.txt`, and `.md`. Files enter the ingest queue before you trigger indexing.</p>
    </div>
    <input aria-label="Upload documents" type="file" multiple @change="handleFiles" />
    <button class="primary-button" type="button" @click="submit">Add to queue</button>
  </div>
</template>
