<script setup lang="ts">
import CategorySettingsEditorTable from '@/components/categories/CategorySettingsEditorTable.vue'
import CategorySettingsReadonlyTable from '@/components/categories/CategorySettingsReadonlyTable.vue'
import type { CategoryDraft } from '@/utils/categorySettings'
import type { Category } from '@/types'

defineProps<{
  categories: Category[]
  drafts: Record<number, CategoryDraft>
  loading?: boolean
  readonly?: boolean
}>()

defineEmits<{
  save: [category: Category]
  archive: [category: Category]
}>()
</script>

<template>
  <CategorySettingsReadonlyTable v-if="readonly" :categories="categories" />
  <CategorySettingsEditorTable
    v-else
    :categories="categories"
    :drafts="drafts"
    :loading="loading"
    @save="$emit('save', $event)"
    @archive="$emit('archive', $event)"
  />
</template>
