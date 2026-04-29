<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    description?: string
  }>(),
  {
    title: 'Загрузка данных',
    description: 'Подготавливаем страницу. Это занимает несколько секунд.',
  },
)
</script>

<template>
  <div class="page-loading-block" role="status" aria-live="polite">
    <div class="page-loading-indicator" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
    <div class="page-loading-copy">
      <strong>{{ title }}</strong>
      <p>{{ description }}</p>
    </div>
  </div>
</template>

<style scoped>
.page-loading-block {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 22px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: var(--panel);
  box-shadow: var(--shadow);
}

.page-loading-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.page-loading-indicator span {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--accent);
  opacity: 0.25;
  animation: loading-pulse 1.2s ease-in-out infinite;
}

.page-loading-indicator span:nth-child(2) {
  animation-delay: 0.16s;
}

.page-loading-indicator span:nth-child(3) {
  animation-delay: 0.32s;
}

.page-loading-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-loading-copy strong {
  color: var(--text);
}

.page-loading-copy p {
  margin: 0;
  color: var(--muted);
}

@keyframes loading-pulse {
  0%,
  80%,
  100% {
    transform: scale(0.82);
    opacity: 0.25;
  }

  40% {
    transform: scale(1);
    opacity: 0.9;
  }
}

@media (max-width: 720px) {
  .page-loading-block {
    align-items: flex-start;
  }
}
</style>
