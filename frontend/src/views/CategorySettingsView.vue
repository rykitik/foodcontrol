<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'
import CategoryArchiveDialog from '@/components/categories/CategoryArchiveDialog.vue'
import CategoryCreatePanel from '@/components/categories/CategoryCreatePanel.vue'
import CategorySettingsTable from '@/components/categories/CategorySettingsTable.vue'
import PageLoadingBlock from '@/components/common/PageLoadingBlock.vue'
import SocialWorkspaceLayout from '@/components/social/SocialWorkspaceLayout.vue'
import { createCategory, deleteCategory, getCategories, updateCategory } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import type { Category } from '@/types'
import { createCategoryDraft, type CategoryDraft } from '@/utils/categorySettings'

const auth = useAuthStore()
const canEdit = computed(() => auth.effectiveRole === 'head_social')

const categories = ref<Category[]>([])
const loading = ref(false)
const initialized = ref(false)
const message = ref('')
const error = ref('')
const drafts = reactive<Record<number, CategoryDraft>>({})
const showCreatePanel = ref(false)
const archiveTarget = ref<Category | null>(null)
const archiveReplacementCategoryId = ref<number | null>(null)
const newCategoryDraft = reactive<CategoryDraft>({
  name: '',
  code: '',
  breakfast: false,
  lunch: true,
  breakfast_price: 95,
  lunch_price: 150,
  description: '',
})
const modeBadgeLabel = computed(() => (canEdit.value ? 'Редактирование включено' : 'Только просмотр'))
const modeBadgeIcon = computed(() => (canEdit.value ? 'check' : 'eye'))
const noteText = computed(() =>
  canEdit.value
    ? 'Цены указаны в рублях. Изменения вступают в силу после сохранения выбранной категории.'
    : 'Цены указаны в рублях. Изменения в категориях питания и ценах выполняются начальником социальных педагогов.',
)

async function loadCategories() {
  loading.value = true
  error.value = ''
  try {
    categories.value = await getCategories()
    Object.keys(drafts).forEach((key) => {
      delete drafts[Number(key)]
    })
    for (const category of categories.value) {
      drafts[category.id] = createCategoryDraft(category)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Не удалось загрузить категории'
  } finally {
    loading.value = false
    initialized.value = true
  }
}

function resetNewCategoryDraft() {
  newCategoryDraft.name = ''
  newCategoryDraft.code = ''
  newCategoryDraft.breakfast = false
  newCategoryDraft.lunch = true
  newCategoryDraft.breakfast_price = 95
  newCategoryDraft.lunch_price = 150
  newCategoryDraft.description = ''
}

async function createNewCategory() {
  if (!canEdit.value) {
    return
  }

  loading.value = true
  message.value = ''
  error.value = ''

  try {
    const created = await createCategory(
      {
        name: newCategoryDraft.name,
        code: newCategoryDraft.code || undefined,
        breakfast: newCategoryDraft.breakfast,
        lunch: newCategoryDraft.lunch,
        breakfast_price: newCategoryDraft.breakfast_price,
        lunch_price: newCategoryDraft.lunch_price,
        description: newCategoryDraft.description || undefined,
      },
      auth.token,
    )

    categories.value = [...categories.value, created]
    drafts[created.id] = createCategoryDraft(created)
    resetNewCategoryDraft()
    showCreatePanel.value = false
    message.value = `Категория "${created.name}" создана`
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Не удалось создать категорию'
  } finally {
    loading.value = false
  }
}

async function saveCategory(category: Category) {
  if (!canEdit.value) {
    return
  }

  loading.value = true
  message.value = ''
  error.value = ''

  try {
    const draft = drafts[category.id]
    if (!draft) {
      throw new Error('Черновик категории не найден')
    }

    const updated = await updateCategory(
      category.id,
      {
        breakfast: draft.breakfast,
        lunch: draft.lunch,
        name: draft.name,
        code: draft.code,
        breakfast_price: draft.breakfast_price,
        lunch_price: draft.lunch_price,
        description: draft.description || undefined,
      },
      auth.token,
    )

    categories.value = categories.value.map((item) => (item.id === updated.id ? updated : item))
    drafts[category.id] = createCategoryDraft(updated)
    message.value = `Категория "${updated.name}" обновлена`
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Не удалось обновить категорию'
  } finally {
    loading.value = false
  }
}

function openArchiveDialog(category: Category) {
  if (!canEdit.value) {
    return
  }

  archiveTarget.value = category
  archiveReplacementCategoryId.value = categories.value.find((item) => item.id !== category.id)?.id ?? null
  message.value = ''
  error.value = ''
}

function closeArchiveDialog() {
  if (loading.value) {
    return
  }

  archiveTarget.value = null
  archiveReplacementCategoryId.value = null
}

async function archiveCategory() {
  const category = archiveTarget.value
  const replacementCategoryId = archiveReplacementCategoryId.value
  if (!canEdit.value || !category) {
    return
  }

  if (!replacementCategoryId) {
    error.value = 'Перед удалением выберите категорию, куда перевести студентов'
    return
  }

  loading.value = true
  message.value = ''
  error.value = ''

  try {
    const result = await deleteCategory(
      category.id,
      { replacement_category_id: replacementCategoryId },
      auth.token,
    )
    categories.value = categories.value.filter((item) => item.id !== category.id)
    delete drafts[category.id]
    archiveTarget.value = null
    archiveReplacementCategoryId.value = null
    message.value = `Категория "${category.name}" удалена. Переведено студентов: ${result.transferred_students}`
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Не удалось удалить категорию'
  } finally {
    loading.value = false
  }
}

onMounted(loadCategories)
</script>

<template>
  <SocialWorkspaceLayout active-nav="categories">
    <section class="categories-page">
      <header class="categories-head">
        <div class="categories-head-copy">
          <h1>Категории</h1>
          <p class="categories-context">Схемы питания, наборы приемов пищи и цены по категориям льготников</p>
        </div>
        <div class="categories-head-actions">
          <p-button v-if="canEdit" label="Добавить категорию" @click="showCreatePanel = true">
            <template #icon>
              <AppIcon name="plus" />
            </template>
          </p-button>
          <span :class="['categories-badge', { 'categories-badge--readonly': !canEdit }]">
            <AppIcon :name="modeBadgeIcon" />
            <span>{{ modeBadgeLabel }}</span>
          </span>
        </div>
      </header>

      <PageLoadingBlock
        v-if="loading && !initialized"
        title="Загрузка категорий"
        description="Получаем текущие схемы питания и параметры расчёта."
      />

      <template v-else>
        <p v-if="message" class="success-banner">{{ message }}</p>
        <p v-if="error" class="error-banner">{{ error }}</p>

        <CategoryCreatePanel
          v-if="canEdit && showCreatePanel"
          :draft="newCategoryDraft"
          :loading="loading"
          @create="createNewCategory"
          @cancel="showCreatePanel = false"
        />

        <CategorySettingsTable
          :categories="categories"
          :drafts="drafts"
          :loading="loading"
          :readonly="!canEdit"
          @save="saveCategory"
          @archive="openArchiveDialog"
        />

        <CategoryArchiveDialog
          v-if="canEdit"
          :visible="archiveTarget !== null"
          :category="archiveTarget"
          :categories="categories"
          v-model:replacement-category-id="archiveReplacementCategoryId"
          :loading="loading"
          @cancel="closeArchiveDialog"
          @confirm="archiveCategory"
        />

        <section class="categories-note" aria-label="Пояснение по категориям питания">
          <span class="categories-note__icon">
            <AppIcon name="info" />
          </span>
          <p>{{ noteText }}</p>
        </section>
      </template>
    </section>
  </SocialWorkspaceLayout>
</template>

<style scoped>
.categories-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.categories-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.categories-head-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.categories-head-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.categories-head h1 {
  margin: 0;
  font-size: 28px;
  line-height: 36px;
  color: #111827;
}

.categories-context {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 14px;
  line-height: 20px;
  max-width: 720px;
}

.categories-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid #dbe3ee;
  background: #fff;
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
}

.categories-badge--readonly {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
}

.success-banner,
.error-banner {
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid transparent;
  font-size: 14px;
  line-height: 20px;
}

.success-banner {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #166534;
}

.error-banner {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.categories-note {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px;
  border: 1px solid #dbeafe;
  border-radius: 16px;
  background: #eff6ff;
}

.categories-note__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: #2563eb;
}

.categories-note p {
  margin: 0;
  color: #475569;
  font-size: 14px;
  line-height: 20px;
}

@media (max-width: 960px) {
  .categories-head {
    flex-direction: column;
    align-items: stretch;
  }

  .categories-head-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .categories-head h1 {
    font-size: 24px;
    line-height: 30px;
  }

  .categories-badge {
    align-self: flex-start;
  }

  .categories-note {
    align-items: flex-start;
    padding: 16px;
  }
}
</style>
