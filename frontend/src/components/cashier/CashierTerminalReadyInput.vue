<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

defineProps<{
  modelValue: string
  queueCount: number
  loading: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string]
  submit: []
  retryQueue: []
}>()

const ticketCodeInput = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)

function focusTicketCodeInput() {
  void nextTick(() => {
    const componentOrElement = ticketCodeInput.value
    if (!componentOrElement) return

    const rootElement = componentOrElement instanceof HTMLElement ? componentOrElement : componentOrElement.$el
    if (!rootElement) return

    const nativeInput =
      rootElement instanceof HTMLInputElement ? rootElement : rootElement.querySelector<HTMLInputElement>('input')

    nativeInput?.focus()
  })
}

onMounted(() => {
  focusTicketCodeInput()
})
</script>

<template>
  <div class="terminal-ready-input">
    <span>Код талона</span>
    <div class="terminal-ready-input-row">
      <p-input-text
        ref="ticketCodeInput"
        :model-value="modelValue"
        class="terminal-ready-field"
        placeholder="Ожидание сканирования..."
        autofocus
        autocomplete="off"
        @update:model-value="$emit('update:modelValue', String($event ?? ''))"
        @keydown.enter.prevent="$emit('submit')"
      />
      <button
        v-if="queueCount"
        type="button"
        class="terminal-queue-button"
        :disabled="loading"
        @click="$emit('retryQueue')"
      >
        Очередь: {{ queueCount }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.terminal-ready-input {
  display: grid;
  gap: 12px;
  padding: 22px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.94);
  border: 2px solid rgba(37, 99, 235, 0.28);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.86),
    0 8px 20px rgba(37, 99, 235, 0.12);
}

.terminal-ready-input > span {
  color: #1e3a8a;
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.terminal-ready-input-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
}

.terminal-ready-field {
  width: 100%;
  min-height: 68px;
  padding: 0 18px;
  border-radius: 16px;
  border-width: 2px;
  font-size: 1.22rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.terminal-ready-field:focus-visible {
  outline: 3px solid rgba(37, 99, 235, 0.28);
  outline-offset: 1px;
}

.terminal-queue-button {
  min-height: 68px;
  padding: 0 20px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.96);
  color: var(--text);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.terminal-queue-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (max-width: 760px) {
  .terminal-ready-input-row {
    grid-template-columns: 1fr;
  }
}
</style>
