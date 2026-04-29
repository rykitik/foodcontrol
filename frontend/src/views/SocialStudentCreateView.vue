<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import PageLoadingBlock from '@/components/common/PageLoadingBlock.vue'
import SocialWorkspaceLayout from '@/components/social/SocialWorkspaceLayout.vue'
import StudentCreateFormCard from '@/components/students/StudentCreateFormCard.vue'
import { createStudent, getCategories, listStudentGroups } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import type { Category, StudentCreateRequest } from '@/types'
import { mergeStudentGroupName } from '@/utils/studentGroups'
import { studentCodeLabel } from '@/utils/studentPresentation'

const auth = useAuthStore()
const router = useRouter()

const categories = ref<Category[]>([])
const groupSuggestions = ref<string[]>([])
const loading = ref(false)
const initialized = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const formResetKey = ref(0)

const isLockedToCurrentBuilding = computed(() => (auth.effectiveRole ?? auth.userRole) === 'social' && auth.userBuilding !== null)
const defaultBuildingId = computed(() => auth.userBuilding ?? 1)
const buildingLabel = computed(() => auth.user?.building_name || `Корпус ${defaultBuildingId.value}`)
const groupSuggestionBuildingId = computed(() => (isLockedToCurrentBuilding.value ? defaultBuildingId.value : undefined))

function resetAlerts() {
  successMessage.value = ''
  errorMessage.value = ''
}

async function loadCategories() {
  categories.value = await getCategories()
}

async function loadStudentGroups() {
  groupSuggestions.value = await listStudentGroups({ building_id: groupSuggestionBuildingId.value })
}

async function submitStudent(payload: StudentCreateRequest) {
  loading.value = true
  resetAlerts()

  try {
    const student = await createStudent(payload, auth.token)
    groupSuggestions.value = mergeStudentGroupName(groupSuggestions.value, student.group_name)
    successMessage.value = `Студент добавлен. ${studentCodeLabel}: ${student.student_card}`
    formResetKey.value += 1
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Не удалось добавить студента'
  } finally {
    loading.value = false
  }
}

function backToStudents() {
  void router.push('/social')
}

onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([loadCategories(), loadStudentGroups()])
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Не удалось загрузить категории'
  } finally {
    loading.value = false
    initialized.value = true
  }
})
</script>

<template>
  <SocialWorkspaceLayout active-nav="students">
    <section class="social-create-page">
      <header class="social-create-head">
        <div>
          <h1>Добавить студента</h1>
          <p class="social-create-context">Новая карточка студента для корпуса {{ buildingLabel }}</p>
        </div>
        <p-button label="К списку студентов" severity="secondary" outlined @click="backToStudents" />
      </header>

      <PageLoadingBlock v-if="loading && !initialized" title="Подготовка формы студента" />

      <template v-else>
        <div class="social-create-shell">
          <p v-if="successMessage" class="success-banner">{{ successMessage }}</p>
          <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>

          <StudentCreateFormCard
            :categories="categories"
            :loading="loading"
            :reset-key="formResetKey"
            :building-id="defaultBuildingId"
            :building-label="buildingLabel"
            :lock-building="isLockedToCurrentBuilding"
            :group-suggestions="groupSuggestions"
            eyebrow="Новый студент"
            title="Карточка студента"
            submit-label="Сохранить студента"
            @submit="submitStudent"
          />
        </div>
      </template>
    </section>
  </SocialWorkspaceLayout>
</template>

<style scoped>
.social-create-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.social-create-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.social-create-head h1 {
  margin: 0;
  font-size: 28px;
  line-height: 36px;
  color: #111827;
}

.social-create-context {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 14px;
  line-height: 20px;
}

.social-create-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 860px;
}

@media (max-width: 960px) {
  .social-create-head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
