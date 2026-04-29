<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'

defineProps<{
  documentKey: string
  title: string
  description: string
  badgeLabel?: string
  loading?: boolean
  active?: boolean
}>()

defineEmits<{
  preview: []
  excel: []
}>()
</script>

<template>
  <article
    :class="['summary-card accountant-document-card', { 'accountant-document-card--active': active }]"
    :data-testid="`accountant-document-card-${documentKey}`"
  >
    <div class="accountant-document-card__head">
      <strong>{{ title }}</strong>
      <p-tag v-if="badgeLabel" :value="badgeLabel" severity="contrast" />
    </div>
    <p>{{ description }}</p>
    <div class="button-row accountant-document-card__actions">
      <p-button
        label="Просмотр"
        :loading="loading"
        :data-testid="`accountant-document-preview-${documentKey}`"
        @click="$emit('preview')"
      >
        <template #icon>
          <AppIcon name="eye" />
        </template>
      </p-button>
      <p-button
        label="Excel"
        severity="secondary"
        outlined
        :loading="loading"
        :data-testid="`accountant-document-excel-${documentKey}`"
        @click="$emit('excel')"
      >
        <template #icon>
          <AppIcon name="excel" />
        </template>
      </p-button>
    </div>
  </article>
</template>

<style scoped>
.accountant-document-card {
  gap: 10px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.accountant-document-card--active {
  border-color: rgba(37, 99, 235, 0.34);
  box-shadow: 0 18px 32px rgba(37, 99, 235, 0.12);
}

.accountant-document-card__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}

.accountant-document-card__actions {
  justify-content: flex-start;
}

@media (max-width: 780px) {
  .accountant-document-card__head,
  .accountant-document-card__actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
