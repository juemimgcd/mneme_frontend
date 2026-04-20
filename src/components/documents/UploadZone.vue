<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CheckCircle2, FileText, FolderInput, Sparkles, Upload, X } from 'lucide-vue-next';
import type { KnowledgeBase } from '@/lib/types';

interface UploadPayload {
  files: File[];
  knowledgeBaseId: string;
  autoIndex: boolean;
}

const props = withDefaults(
  defineProps<{
    knowledgeBases: KnowledgeBase[];
    activeKnowledgeBaseId?: string;
    loading?: boolean;
    resetKey?: number;
  }>(),
  {
    activeKnowledgeBaseId: '',
    loading: false,
    resetKey: 0,
  },
);

const emit = defineEmits<{
  (event: 'upload', payload: UploadPayload): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const dragActive = ref(false);
const files = ref<File[]>([]);
const selectedKnowledgeBaseId = ref('');
const autoIndex = ref(true);

const acceptedTypesLabel = '.pdf, .txt, .md';
const recommendedSizeLabel = 'Recommended max. size: 20 MB';

const selectedKnowledgeBase = computed(
  () => props.knowledgeBases.find((item) => item.id === selectedKnowledgeBaseId.value) ?? null,
);

const totalSizeLabel = computed(() => formatBytes(files.value.reduce((sum, file) => sum + file.size, 0)));

watch(
  () => [props.activeKnowledgeBaseId, props.knowledgeBases] as const,
  () => {
    if (
      !selectedKnowledgeBaseId.value ||
      !props.knowledgeBases.some((item) => item.id === selectedKnowledgeBaseId.value)
    ) {
      selectedKnowledgeBaseId.value = props.activeKnowledgeBaseId || props.knowledgeBases[0]?.id || '';
    }
  },
  { immediate: true, deep: true },
);

watch(
  () => props.resetKey,
  () => {
    clearFiles();
  },
);

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let size = value / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function isSameFile(left: File, right: File) {
  return (
    left.name === right.name &&
    left.size === right.size &&
    left.type === right.type &&
    left.lastModified === right.lastModified
  );
}

function appendFiles(incoming: File[]) {
  const nextFiles = incoming.filter(
    (file) => !files.value.some((existing) => isSameFile(existing, file)),
  );
  files.value = [...files.value, ...nextFiles];
}

function handleFileSelection(event: Event) {
  appendFiles(Array.from((event.target as HTMLInputElement).files ?? []));
}

function handleDragEnter() {
  dragActive.value = true;
}

function handleDragLeave(event: DragEvent) {
  const currentTarget = event.currentTarget as HTMLElement | null;
  const relatedTarget = event.relatedTarget as Node | null;
  if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
    return;
  }
  dragActive.value = false;
}

function handleDrop(event: DragEvent) {
  dragActive.value = false;
  appendFiles(Array.from(event.dataTransfer?.files ?? []));
}

function removeFile(target: File) {
  files.value = files.value.filter((item) => !isSameFile(item, target));
}

function clearFiles() {
  files.value = [];
  if (inputRef.value) {
    inputRef.value.value = '';
  }
}

function openPicker() {
  inputRef.value?.click();
}

function submit() {
  if (!files.value.length || !selectedKnowledgeBaseId.value || props.loading) {
    return;
  }

  emit('upload', {
    files: files.value,
    knowledgeBaseId: selectedKnowledgeBaseId.value,
    autoIndex: autoIndex.value,
  });
}
</script>

<template>
  <section class="upload-studio">
    <div class="upload-studio__hero">
      <div class="upload-studio__title-block">
        <p class="upload-studio__eyebrow">Document intake</p>
        <h3>Drop files into a target shelf, then let indexing start immediately.</h3>
        <p>
          This upload flow is tuned for notebook ingestion rather than a generic form. Choose a shelf,
          stage multiple files, and send them straight into processing.
        </p>
      </div>

      <div class="upload-studio__stats">
        <article class="upload-studio__stat">
          <span>Queued now</span>
          <strong>{{ files.length }}</strong>
        </article>
        <article class="upload-studio__stat">
          <span>Total size</span>
          <strong>{{ totalSizeLabel }}</strong>
        </article>
      </div>
    </div>

    <div class="upload-studio__controls">
      <label class="upload-studio__field">
        <span>Target shelf</span>
        <select v-model="selectedKnowledgeBaseId" :disabled="loading || !knowledgeBases.length">
          <option v-for="item in knowledgeBases" :key="item.id" :value="item.id">
            {{ item.name }}
          </option>
        </select>
      </label>

      <label class="upload-studio__toggle">
        <input v-model="autoIndex" type="checkbox" />
        <span>Auto-index after upload</span>
      </label>
    </div>

    <div
      class="upload-studio__dropzone"
      :data-dragging="dragActive"
      @click="openPicker"
      @dragenter.prevent="handleDragEnter"
      @dragover.prevent="handleDragEnter"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <div class="upload-studio__drop-icon">
        <Upload :size="22" />
      </div>

      <div class="upload-studio__drop-copy">
        <strong>Drag files here or choose from your device</strong>
        <p>{{ recommendedSizeLabel }}, accepted file types: {{ acceptedTypesLabel }}.</p>
      </div>

      <button class="ghost-button upload-studio__browse" type="button" @click.stop="openPicker">
        <FolderInput :size="16" />
        <span>Choose Files</span>
      </button>

      <input
        ref="inputRef"
        aria-label="Upload documents"
        class="upload-studio__input"
        type="file"
        multiple
        accept=".pdf,.txt,.md"
        @change="handleFileSelection"
      />
    </div>

    <div class="upload-studio__summary">
      <div class="upload-studio__meta">
        <span class="inline-badge">{{ selectedKnowledgeBase?.name ?? 'No shelf selected' }}</span>
        <span class="upload-studio__hint">
          <Sparkles :size="14" />
          <span>{{ autoIndex ? 'Uploads will index immediately' : 'Uploads will wait for manual processing' }}</span>
        </span>
      </div>
      <p v-if="selectedKnowledgeBase && selectedKnowledgeBase.id !== activeKnowledgeBaseId">
        This target is different from the currently open shelf, so the new files will land there and appear
        in that collection's queue.
      </p>
    </div>

    <div v-if="files.length" class="upload-studio__queue">
      <article v-for="file in files" :key="`${file.name}-${file.lastModified}-${file.size}`" class="upload-file">
        <div class="upload-file__icon">
          <FileText :size="18" />
        </div>

        <div class="upload-file__body">
          <header>
            <strong>{{ file.name }}</strong>
            <button class="upload-file__remove" type="button" @click="removeFile(file)">
              <X :size="14" />
            </button>
          </header>
          <p>{{ file.type || 'Document file' }}</p>
          <footer>
            <span>{{ formatBytes(file.size) }}</span>
            <span class="upload-file__status">
              <CheckCircle2 :size="13" />
              <span>Ready</span>
            </span>
          </footer>
        </div>
      </article>
    </div>

    <div v-else class="upload-studio__empty">
      <FileText :size="18" />
      <span>No files staged yet. Drop a reading packet here to begin.</span>
    </div>

    <div class="upload-studio__footer">
      <button class="ghost-button" type="button" :disabled="!files.length || loading" @click="clearFiles">
        Clear
      </button>
      <button
        class="primary-button"
        type="button"
        :disabled="!files.length || !selectedKnowledgeBaseId || loading"
        @click="submit"
      >
        {{ loading ? 'Uploading...' : autoIndex ? 'Upload and index' : 'Upload files' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.upload-studio {
  display: grid;
  gap: 1rem;
}

.upload-studio__hero {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(220px, 0.8fr);
  gap: 1rem;
}

.upload-studio__title-block {
  display: grid;
  gap: 0.4rem;
}

.upload-studio__eyebrow,
.upload-studio__field span,
.upload-studio__stat span {
  color: var(--app-ink-muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.upload-studio__title-block h3 {
  margin: 0;
  color: var(--app-ink);
  font-family: 'Fraunces', serif;
  font-size: clamp(1.45rem, 2vw, 2rem);
  font-weight: 500;
  line-height: 1.05;
}

.upload-studio__title-block p {
  margin: 0;
  color: var(--app-ink-soft);
  line-height: 1.65;
}

.upload-studio__stats {
  display: grid;
  gap: 0.75rem;
}

.upload-studio__stat {
  display: grid;
  gap: 0.25rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--app-line);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 80%),
    color-mix(in srgb, var(--app-panel) 92%, transparent);
}

.upload-studio__stat strong {
  color: var(--app-ink);
  font-family: 'Fraunces', serif;
  font-size: 1.4rem;
  font-weight: 500;
}

.upload-studio__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
  align-items: end;
}

.upload-studio__field {
  display: grid;
  flex: 1 1 260px;
  gap: 0.35rem;
}

.upload-studio__field select {
  min-height: 46px;
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--app-line);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--app-ink);
}

.upload-studio__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 46px;
  padding: 0.75rem 0.95rem;
  border: 1px solid var(--app-line);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--app-ink);
}

.upload-studio__toggle input {
  width: 16px;
  height: 16px;
}

.upload-studio__dropzone {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: center;
  padding: 1.15rem;
  border: 1px dashed color-mix(in srgb, var(--app-accent) 28%, var(--app-line));
  border-radius: 24px;
  background:
    radial-gradient(circle at top left, rgba(122, 162, 255, 0.12), transparent 32%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 86%),
    color-mix(in srgb, var(--app-panel-muted) 90%, transparent);
  cursor: pointer;
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.upload-studio__dropzone:hover,
.upload-studio__dropzone[data-dragging='true'] {
  transform: translateY(-1px);
  border-color: var(--app-line-strong);
  box-shadow: 0 18px 30px rgba(0, 0, 0, 0.24);
}

.upload-studio__drop-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border: 1px solid var(--app-line);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--app-accent);
}

.upload-studio__drop-copy {
  display: grid;
  gap: 0.3rem;
}

.upload-studio__drop-copy strong {
  color: var(--app-ink);
  font-family: 'Newsreader', 'Fraunces', serif;
  font-size: 1.18rem;
  font-weight: 500;
}

.upload-studio__drop-copy p,
.upload-studio__summary p,
.upload-file p {
  margin: 0;
  color: var(--app-ink-soft);
  line-height: 1.6;
}

.upload-studio__browse {
  white-space: nowrap;
}

.upload-studio__input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.upload-studio__summary {
  display: grid;
  gap: 0.35rem;
}

.upload-studio__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
}

.upload-studio__hint {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--app-ink-soft);
}

.upload-studio__queue {
  display: grid;
  gap: 0.75rem;
}

.upload-file {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.85rem;
  padding: 0.85rem 0.9rem;
  border: 1px solid var(--app-line);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 84%),
    color-mix(in srgb, var(--app-panel) 92%, transparent);
}

.upload-file__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--app-accent);
}

.upload-file__body {
  display: grid;
  gap: 0.22rem;
  min-width: 0;
}

.upload-file__body header,
.upload-file__body footer {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
}

.upload-file__body strong {
  overflow: hidden;
  color: var(--app-ink);
  font-size: 0.98rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-file__status {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--app-sage);
  font-weight: 600;
}

.upload-file__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--app-ink-soft);
  cursor: pointer;
}

.upload-studio__empty {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 54px;
  padding: 0.85rem 1rem;
  border: 1px dashed var(--app-line);
  border-radius: 16px;
  color: var(--app-ink-soft);
  background: rgba(255, 255, 255, 0.03);
}

.upload-studio__footer {
  display: flex;
  justify-content: end;
  gap: 0.75rem;
}

@media (max-width: 920px) {
  .upload-studio__hero,
  .upload-studio__dropzone {
    grid-template-columns: 1fr;
  }

  .upload-studio__browse {
    justify-content: center;
  }
}

@media (max-width: 640px) {
  .upload-studio__footer,
  .upload-file__body header,
  .upload-file__body footer {
    align-items: stretch;
    flex-direction: column;
  }

  .upload-studio__footer .ghost-button,
  .upload-studio__footer .primary-button {
    width: 100%;
  }
}
</style>
