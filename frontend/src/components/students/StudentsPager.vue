<script setup lang="ts">
import { computed } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'

type PagerVariant = 'default' | 'numeric'
type PageItem = number | 'ellipsis-left' | 'ellipsis-right'

const props = withDefaults(
  defineProps<{
    total: number
    page: number
    pageSize: number
    loading?: boolean
    previousLabel?: string
    nextLabel?: string
    summaryLabel?: string
    variant?: PagerVariant
  }>(),
  {
    loading: false,
    previousLabel: 'Назад',
    nextLabel: 'Вперёд',
    summaryLabel: 'Всего записей',
    variant: 'default',
  },
)

const emit = defineEmits<{
  changePage: [nextPage: number]
}>()

const rangeStart = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1))
const rangeEnd = computed(() => Math.min(props.page * props.pageSize, props.total))
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const canGoPrevious = computed(() => props.page > 1)
const canGoNext = computed(() => props.page < totalPages.value)

const numericItems = computed<PageItem[]>(() => {
  const total = totalPages.value
  if (total <= 6) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  const current = props.page
  const pages = new Set<number>([1, total, current, current - 1, current + 1])
  const normalized = Array.from(pages)
    .filter((value) => value >= 1 && value <= total)
    .sort((left, right) => left - right)

  const items: PageItem[] = []
  for (let index = 0; index < normalized.length; index += 1) {
    const pageValue = normalized[index]!
    const previous = normalized[index - 1]
    if (previous != null && pageValue - previous > 1) {
      items.push(previous === 1 ? 'ellipsis-left' : 'ellipsis-right')
    }
    items.push(pageValue)
  }

  return items
})

function goToPage(nextPage: number) {
  if (props.loading || nextPage < 1 || nextPage > totalPages.value || nextPage === props.page) {
    return
  }

  emit('changePage', nextPage)
}

function goToPrevious() {
  goToPage(props.page - 1)
}

function goToNext() {
  goToPage(props.page + 1)
}
</script>

<template>
  <div :class="['students-pager', `students-pager--${variant}`]">
    <span class="students-pager-meta">
      <template v-if="variant === 'numeric'">
        {{ summaryLabel }}: {{ total }}
      </template>
      <template v-else-if="total > 0">
        {{ rangeStart }}-{{ rangeEnd }} из {{ total }}
      </template>
      <template v-else>0 записей</template>
    </span>

    <div v-if="variant === 'numeric'" class="students-pager-pages">
      <button type="button" class="pager-icon-button" :disabled="loading || !canGoPrevious" @click="goToPrevious">
        <AppIcon name="chevronLeft" :size="16" />
      </button>
      <template v-for="item in numericItems" :key="`${item}`">
        <span v-if="typeof item !== 'number'" class="pager-ellipsis">…</span>
        <button
          v-else
          type="button"
          :class="['pager-page-button', { 'pager-page-button--active': item === page }]"
          :disabled="loading && item !== page"
          @click="goToPage(item)"
        >
          {{ item }}
        </button>
      </template>
      <button type="button" class="pager-icon-button" :disabled="loading || !canGoNext" @click="goToNext">
        <AppIcon name="chevronRight" :size="16" />
      </button>
    </div>

    <div v-else class="students-pager-actions">
      <p-button
        :label="previousLabel"
        severity="secondary"
        outlined
        :disabled="loading || !canGoPrevious"
        @click="goToPrevious"
      />
      <p-button
        :label="nextLabel"
        severity="secondary"
        outlined
        :disabled="loading || !canGoNext"
        @click="goToNext"
      />
    </div>
  </div>
</template>

<style scoped>
.students-pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.students-pager-meta {
  color: var(--muted);
  font-weight: 600;
}

.students-pager-actions,
.students-pager-pages {
  display: flex;
  align-items: center;
  gap: 8px;
}

.students-pager--numeric {
  padding: 0 4px;
}

.pager-icon-button,
.pager-page-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid #dbe3ee;
  border-radius: 10px;
  background: #fff;
  color: #334155;
  font: inherit;
}

.pager-page-button--active {
  border-color: #86efac;
  background: #f0fdf4;
  color: #166534;
  font-weight: 700;
}

.pager-ellipsis {
  color: #94a3b8;
  font-weight: 700;
}

.pager-icon-button:disabled,
.pager-page-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
