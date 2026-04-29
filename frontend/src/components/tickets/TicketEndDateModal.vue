<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch, computed } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'
import type { Ticket } from '@/types'

const props = withDefaults(
  defineProps<{
    visible: boolean
    ticket: Ticket | null
    loading?: boolean
    errorMessage?: string
  }>(),
  {
    loading: false,
    errorMessage: '',
  },
)

const emit = defineEmits<{
  close: []
  submit: [endDate: string]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const draftEndDate = ref('')
let previousBodyOverflow = ''

const canSubmit = computed(() => {
  if (!props.ticket || props.loading) {
    return false
  }

  return Boolean(draftEndDate.value && draftEndDate.value !== props.ticket.end_date)
})

const currentPeriodLabel = computed(() => {
  if (!props.ticket) {
    return '—'
  }

  return `${props.ticket.start_date} — ${props.ticket.end_date}`
})

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

function requestClose() {
  if (props.loading) {
    return
  }

  emit('close')
}

function submit() {
  if (!canSubmit.value) {
    return
  }

  emit('submit', draftEndDate.value)
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.visible) {
    event.preventDefault()
    requestClose()
  }
}

watch(
  () => [props.visible, props.ticket?.id, props.ticket?.end_date] as const,
  async ([visible]) => {
    syncBodyScrollLock(visible)

    if (!visible) {
      return
    }

    draftEndDate.value = props.ticket?.end_date ?? ''
    await nextTick()
    requestAnimationFrame(() => {
      inputRef.value?.focus({ preventScroll: true })
      inputRef.value?.showPicker?.()
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
    <Transition name="ticket-period-modal">
      <div v-if="visible && ticket" class="ticket-period-modal" @click.self="requestClose">
        <div class="ticket-period-modal__backdrop" />

        <section
          class="ticket-period-modal__dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-period-modal-title"
        >
          <header class="ticket-period-modal__header">
            <div class="ticket-period-modal__copy">
              <h2 id="ticket-period-modal-title">Изменить срок действия талона</h2>
              <p>{{ ticket.student_name }}</p>
            </div>

            <button
              type="button"
              class="ticket-period-modal__close"
              aria-label="Закрыть окно изменения срока действия"
              @click="requestClose"
            >
              <AppIcon name="cancel" />
            </button>
          </header>

          <div class="ticket-period-modal__body">
            <p v-if="errorMessage" class="ticket-period-modal__error">{{ errorMessage }}</p>

            <div class="ticket-period-modal__summary">
              <div class="ticket-period-modal__fact">
                <span>Текущий период</span>
                <strong>{{ currentPeriodLabel }}</strong>
              </div>
              <div class="ticket-period-modal__fact">
                <span>Статус</span>
                <strong>{{ ticket.status === 'active' ? 'Действует' : ticket.status }}</strong>
              </div>
            </div>

            <label class="ticket-period-modal__field">
              <span>Новая дата окончания</span>
              <input
                ref="inputRef"
                v-model="draftEndDate"
                :min="ticket.start_date"
                type="date"
              />
            </label>

            <div class="ticket-period-modal__hint">
              <p>Дата начала не меняется. Система обновит только конечную дату действия талона.</p>
              <p v-if="ticket.is_locked">
                По талону уже есть выдачи питания. Новая дата не может быть раньше уже зарегистрированных выдач.
              </p>
            </div>
          </div>

          <footer class="ticket-period-modal__footer">
            <p-button label="Отмена" severity="secondary" text :disabled="loading" @click="requestClose" />
            <p-button label="Сохранить срок" :disabled="!canSubmit" :loading="loading" @click="submit" />
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ticket-period-modal {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: grid;
  place-items: center;
  padding: 24px;
}

.ticket-period-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.28);
}

.ticket-period-modal__dialog {
  position: relative;
  z-index: 1;
  width: min(520px, calc(100vw - 48px));
  display: flex;
  flex-direction: column;
  border: 1px solid #dbe3ee;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.18);
  overflow: hidden;
}

.ticket-period-modal__header,
.ticket-period-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.ticket-period-modal__header {
  padding: 22px 24px 18px;
  border-bottom: 1px solid #edf1f5;
}

.ticket-period-modal__copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ticket-period-modal__copy h2,
.ticket-period-modal__copy p,
.ticket-period-modal__hint p {
  margin: 0;
}

.ticket-period-modal__copy h2 {
  color: #0f172a;
  font-size: 20px;
  line-height: 28px;
}

.ticket-period-modal__copy p {
  color: #64748b;
  font-size: 14px;
  line-height: 20px;
}

.ticket-period-modal__close {
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

.ticket-period-modal__close:hover {
  background: #f8fafc;
  color: #0f172a;
}

.ticket-period-modal__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 22px 24px;
}

.ticket-period-modal__error {
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: #fee2e2;
  color: #991b1b;
  font-size: 14px;
  line-height: 20px;
}

.ticket-period-modal__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.ticket-period-modal__fact,
.ticket-period-modal__hint {
  display: flex;
  flex-direction: column;
}

.ticket-period-modal__fact {
  gap: 6px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #f8fafc;
}

.ticket-period-modal__fact span,
.ticket-period-modal__field span {
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}

.ticket-period-modal__fact strong {
  color: #0f172a;
  font-size: 14px;
  line-height: 20px;
}

.ticket-period-modal__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ticket-period-modal__field input {
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid #dbe3ee;
  border-radius: 12px;
  font: inherit;
  color: #0f172a;
}

.ticket-period-modal__hint {
  gap: 8px;
  padding: 14px;
  border: 1px solid #dbe3ee;
  border-radius: 14px;
  background: #f8fafc;
  color: #475569;
  font-size: 14px;
  line-height: 20px;
}

.ticket-period-modal__footer {
  padding: 0 24px 22px;
}

.ticket-period-modal-enter-active,
.ticket-period-modal-leave-active {
  transition: opacity 0.18s ease;
}

.ticket-period-modal-enter-active .ticket-period-modal__dialog,
.ticket-period-modal-leave-active .ticket-period-modal__dialog {
  transition:
    transform 0.18s ease,
    opacity 0.18s ease;
}

.ticket-period-modal-enter-from,
.ticket-period-modal-leave-to {
  opacity: 0;
}

.ticket-period-modal-enter-from .ticket-period-modal__dialog,
.ticket-period-modal-leave-to .ticket-period-modal__dialog {
  opacity: 0;
  transform: translateY(10px) scale(0.985);
}

@media (max-width: 640px) {
  .ticket-period-modal {
    padding: 12px;
  }

  .ticket-period-modal__dialog {
    width: 100%;
  }

  .ticket-period-modal__summary {
    grid-template-columns: 1fr;
  }

  .ticket-period-modal__header,
  .ticket-period-modal__body,
  .ticket-period-modal__footer {
    padding-left: 18px;
    padding-right: 18px;
  }
}
</style>
