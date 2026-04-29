<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'
import StudentCreateFormFields from '@/components/students/StudentCreateFormFields.vue'
import type { Category, StudentCreateRequest } from '@/types'

const props = withDefaults(
  defineProps<{
    visible: boolean
    categories: Category[]
    loading?: boolean
    resetKey?: number
    errorMessage?: string
    buildingId?: number | null
    buildingLabel?: string | null
    lockBuilding?: boolean
    groupSuggestions?: string[]
  }>(),
  {
    loading: false,
    resetKey: 0,
    errorMessage: '',
    buildingId: null,
    buildingLabel: null,
    lockBuilding: false,
    groupSuggestions: () => [],
  },
)

const emit = defineEmits<{
  close: []
  submit: [payload: StudentCreateRequest]
}>()

const dialogRef = ref<HTMLElement | null>(null)
let previousBodyOverflow = ''

function requestClose() {
  if (props.loading) {
    return
  }
  emit('close')
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.visible) {
    event.preventDefault()
    requestClose()
  }
}

function syncBodyScrollLock(visible: boolean) {
  if (typeof document === 'undefined') {
    return
  }

  if (visible) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return
  }

  document.body.style.overflow = previousBodyOverflow
}

function focusPrimaryField() {
  const primaryInput = dialogRef.value?.querySelector('input[type="text"], input:not([type])')
  if (primaryInput instanceof HTMLInputElement) {
    primaryInput.focus({ preventScroll: true })
    primaryInput.select()
  }
}

watch(
  () => props.visible,
  async (visible) => {
    syncBodyScrollLock(visible)

    if (!visible) {
      return
    }

    await nextTick()
    requestAnimationFrame(() => {
      focusPrimaryField()
    })
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
  syncBodyScrollLock(false)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="student-create-modal">
      <div v-show="visible" class="student-create-modal" @click.self="requestClose">
        <div class="student-create-modal__backdrop" />

        <section
          ref="dialogRef"
          class="student-create-modal__dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-create-modal-title"
        >
          <header class="student-create-modal__header">
            <div class="student-create-modal__copy">
              <h2 id="student-create-modal-title">Добавление студента</h2>
              <p>Новая карточка студента для корпуса {{ buildingLabel || 'по вашему контуру' }}</p>
            </div>

            <button
              type="button"
              class="student-create-modal__close"
              aria-label="Закрыть окно добавления студента"
              @click="requestClose"
            >
              <AppIcon name="cancel" />
            </button>
          </header>

          <div class="student-create-modal__body">
            <p v-if="errorMessage" class="error-banner student-create-modal__error">{{ errorMessage }}</p>

            <StudentCreateFormFields
              :categories="categories"
              :loading="loading"
              :reset-key="resetKey"
              :autofocus="false"
              :building-id="buildingId"
              :building-label="buildingLabel"
              :lock-building="lockBuilding"
              :group-suggestions="groupSuggestions"
              submit-label="Создать студента"
              cancel-label="Отмена"
              show-cancel
              @cancel="requestClose"
              @submit="emit('submit', $event)"
            />
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.student-create-modal {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 24px;
}

.student-create-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.26);
}

.student-create-modal__dialog {
  position: relative;
  z-index: 1;
  width: min(760px, calc(100vw - 48px));
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  border: 1px solid #dbe3ee;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.18);
  overflow: hidden;
  contain: layout paint;
  will-change: transform, opacity;
}

.student-create-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 24px 18px;
  border-bottom: 1px solid #edf1f5;
}

.student-create-modal__copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.student-create-modal__copy h2,
.student-create-modal__copy p {
  margin: 0;
}

.student-create-modal__copy h2 {
  color: #0f172a;
  font-size: 20px;
  line-height: 28px;
}

.student-create-modal__copy p {
  color: #64748b;
  font-size: 14px;
  line-height: 20px;
}

.student-create-modal__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
}

.student-create-modal__close:hover {
  background: #f8fafc;
  color: #0f172a;
}

.student-create-modal__close svg {
  width: 20px;
  height: 20px;
}

.student-create-modal__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 22px 24px 24px;
  overflow: auto;
}

.student-create-modal__error {
  margin: 0;
}

.student-create-modal-enter-active,
.student-create-modal-leave-active {
  transition: opacity 0.18s ease;
}

.student-create-modal-enter-active .student-create-modal__dialog,
.student-create-modal-leave-active .student-create-modal__dialog {
  transition:
    transform 0.18s ease,
    opacity 0.18s ease;
}

.student-create-modal-enter-from,
.student-create-modal-leave-to {
  opacity: 0;
}

.student-create-modal-enter-from .student-create-modal__dialog,
.student-create-modal-leave-to .student-create-modal__dialog {
  opacity: 0;
  transform: translateY(12px) scale(0.985);
}

@media (max-width: 720px) {
  .student-create-modal {
    padding: 12px;
  }

  .student-create-modal__dialog {
    width: 100%;
    max-height: calc(100vh - 24px);
    border-radius: 18px;
  }

  .student-create-modal__header {
    padding: 18px 18px 14px;
  }

  .student-create-modal__body {
    padding: 18px;
  }
}
</style>
