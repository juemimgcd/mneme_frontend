<script setup lang="ts">
import type { DocumentItem, TaskRecord } from '@/lib/types';

const props = defineProps<{
  items: DocumentItem[];
  selectedId?: string;
  taskRecords?: Record<string, TaskRecord>;
}>();

const emit = defineEmits<{
  (event: 'index', documentId: string): void;
  (event: 'cancel', taskId: string): void;
  (event: 'retry', taskId: string): void;
  (event: 'delete', documentId: string): void;
  (event: 'inspect', documentId: string): void;
}>();

function taskOf(item: DocumentItem) {
  if (!item.task_id || !props.taskRecords) {
    return null;
  }
  return props.taskRecords[item.task_id] ?? null;
}

function createdLabel(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <div class="table-shell">
    <table class="data-table">
      <thead>
        <tr>
          <th>Document</th>
          <th>Status</th>
          <th>Task</th>
          <th>Added</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.id"
          class="data-table__row"
          :data-active="item.id === selectedId"
          @click="emit('inspect', item.id)"
        >
          <td class="document-cell">
            <div class="document-cell__main">
              <strong>{{ item.name }}</strong>
              <span>{{ item.file_type?.toUpperCase() || 'FILE' }} · {{ item.size_label }}</span>
            </div>
          </td>
          <td><span class="status-pill" :data-status="item.status">{{ item.status }}</span></td>
          <td class="task-cell">
            <template v-if="taskOf(item)">
              <div class="task-cell__main">
                <span class="inline-badge">{{ taskOf(item)?.status }}</span>
                <span v-if="taskOf(item)?.error_message" class="task-cell__detail">
                  {{ taskOf(item)?.error_message }}
                </span>
              </div>
            </template>
            <span v-else>—</span>
          </td>
          <td class="document-date">
            <time :datetime="item.created_at">{{ createdLabel(item.created_at) }}</time>
          </td>
          <td class="document-actions">
            <div class="table-actions" @click.stop>
              <button
                v-if="!['queued', 'indexing', 'parsing', 'chunking', 'embedding', 'vector_upserting', 'indexed'].includes(item.status)"
                class="ghost-button"
                type="button"
                @click="emit('index', item.id)"
              >
                Process
              </button>

              <button
                v-if="taskOf(item) && ['queued', 'parsing', 'chunking', 'embedding', 'vector_upserting'].includes(taskOf(item)!.status)"
                class="ghost-button"
                type="button"
                @click="emit('cancel', taskOf(item)!.id)"
              >
                Cancel
              </button>

              <button
                v-if="taskOf(item) && ['failed', 'cancelled', 'canceled'].includes(taskOf(item)!.status)"
                class="ghost-button"
                type="button"
                @click="emit('retry', taskOf(item)!.id)"
              >
                Try Again
              </button>

              <button
                class="ghost-button ghost-button--danger"
                type="button"
                :disabled="['queued', 'indexing', 'parsing', 'chunking', 'embedding', 'vector_upserting'].includes(item.status)"
                @click="emit('delete', item.id)"
              >
                Delete
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
