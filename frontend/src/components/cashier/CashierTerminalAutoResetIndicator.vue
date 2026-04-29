<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  active: boolean
  resetKey: number
  delayMs: number
}>()

const remainingMs = ref(0)
let animationFrameId: number | null = null
let deadlineTs = 0

function stopCountdown() {
  if (animationFrameId === null) {
    return
  }

  cancelAnimationFrame(animationFrameId)
  animationFrameId = null
}

function updateRemaining(now: number) {
  remainingMs.value = Math.max(0, deadlineTs - now)
  if (remainingMs.value <= 0) {
    animationFrameId = null
    return
  }

  animationFrameId = requestAnimationFrame(updateRemaining)
}

function startCountdown() {
  stopCountdown()
  remainingMs.value = props.delayMs

  if (!props.active || props.delayMs <= 0) {
    return
  }

  deadlineTs = performance.now() + props.delayMs
  animationFrameId = requestAnimationFrame(updateRemaining)
}

watch(
  () => [props.active, props.resetKey, props.delayMs] as const,
  ([active]) => {
    if (!active) {
      stopCountdown()
      remainingMs.value = 0
      return
    }

    startCountdown()
  },
  { immediate: true },
)

const countdownLabel = computed(() => `${Math.max(0.1, remainingMs.value / 1000).toFixed(1)} с`)
const progressStyle = computed(() => ({
  '--reset-duration': `${props.delayMs}ms`,
}))

onBeforeUnmount(stopCountdown)
</script>

<template>
  <div v-if="active" class="terminal-reset-indicator">
    <div class="terminal-reset-copy">
      <strong>Повторное сканирование заблокировано</strong>
      <span>Экран очистится через {{ countdownLabel }}</span>
    </div>

    <div :key="resetKey" class="terminal-reset-track" :style="progressStyle">
      <div class="terminal-reset-bar" />
    </div>
  </div>
</template>

<style scoped>
.terminal-reset-indicator {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.06);
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.terminal-reset-copy {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
  flex-wrap: wrap;
}

.terminal-reset-copy strong {
  color: var(--status-accent);
  font-size: 0.94rem;
  font-weight: 800;
}

.terminal-reset-copy span {
  color: #475569;
  font-size: 0.9rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.terminal-reset-track {
  overflow: hidden;
  height: 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.22);
}

.terminal-reset-bar {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  transform-origin: left center;
  background: linear-gradient(90deg, var(--status-accent), rgba(255, 255, 255, 0.5));
  animation: resetBar var(--reset-duration) linear forwards;
}

@keyframes resetBar {
  from {
    transform: scaleX(1);
    opacity: 1;
  }
  to {
    transform: scaleX(0);
    opacity: 0.25;
  }
}
</style>
