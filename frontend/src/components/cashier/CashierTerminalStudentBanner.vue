<script setup lang="ts">
defineProps<{
  studentName: string
  studentGroup?: string
  ticketPeriod?: string
  issuedAmount?: string
}>()
</script>

<template>
  <div class="terminal-student-banner">
    <strong>{{ studentName }}</strong>
    <span>{{ studentGroup }}</span>

    <div class="terminal-student-meta">
      <div class="terminal-student-meta-card">
        <span>Талон</span>
        <strong>{{ ticketPeriod || '—' }}</strong>
      </div>
      <div class="terminal-student-meta-card">
        <span>Выдано сегодня</span>
        <strong>{{ issuedAmount || '0.00 ₽' }}</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.terminal-student-banner {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 14px 16px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(148, 163, 184, 0.12);
  text-align: center;
}

.terminal-student-banner strong {
  color: var(--text);
  font-size: clamp(1.34rem, 1.95vw, 1.82rem);
}

.terminal-student-banner span {
  color: var(--muted);
  font-size: 0.94rem;
}

.terminal-student-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
}

.terminal-student-meta-card {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.terminal-student-meta-card span {
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.terminal-student-meta-card strong {
  color: var(--text);
  font-size: clamp(1rem, 1.5vw, 1.28rem);
}

@media (max-width: 760px) {
  .terminal-student-meta {
    grid-template-columns: 1fr;
  }
}
</style>
