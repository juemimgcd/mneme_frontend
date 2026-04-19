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
          <td>
            <strong>{{ item.name }}</strong>
            <span>{{ item.file_type?.toUpperCase() || 'FILE' }} · {{ item.size_label }}</span>
          </td>
          <td><span class="status-pill" :data-status="item.status">{{ item.status }}</span></td>
          <td>
            <template v-if="taskOf(item)">
              <span class="inline-badge">{{ taskOf(item)?.status }}</span>
              <span v-if="taskOf(item)?.error_message">{{ taskOf(item)?.error_message }}</span>
            </template>
            <span v-else>—</span>
          </td>
          <td>{{ new Date(item.created_at).toLocaleString('en-US') }}</td>
          <td>
            <div class="table-actions" @click.stop>
              <button
                v-if="!['queued', 'indexing', 'parsing', 'chunking', 'embedding', 'vector_upserting', 'indexed'].includes(item.status)"
                class="ghost-button"
                type="button"
                @click="emit('index', item.id)"
              >
                Index
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
                Retry
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
