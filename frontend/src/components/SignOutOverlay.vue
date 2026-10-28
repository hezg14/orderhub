<script setup lang="ts">
import { signingOut } from '@/composables/signOutTransition';
import { useI18n } from '@/i18n';

/**
 * The sign-out counterpart of the login boot log: three mono "power down"
 * lines with a sweeping link bar, shown for one short beat while the session
 * clears, then the login screen fades in underneath. Pure CSS, no motion
 * after `prefers-reduced-motion`.
 */
const { t } = useI18n();
</script>

<template>
  <transition name="so-fade">
    <div v-if="signingOut" class="so-overlay" role="status" aria-live="polite">
      <div class="so-box">
        <span class="so-line" style="--i: 0">{{ t('auth.signOutLog1') }}</span>
        <span class="so-line" style="--i: 1">{{ t('auth.signOutLog2') }}</span>
        <span class="so-line" style="--i: 2">{{ t('auth.signOutLog3') }}<i class="so-caret" /></span>
        <span class="so-sweep" aria-hidden="true" />
      </div>
    </div>
  </transition>
</template>

<style scoped>
.so-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--bg-page) 86%, transparent);
  backdrop-filter: blur(8px);
}

.so-box {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 22px 26px;
  border: 1px solid var(--border);
  border-radius: var(--r-card);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.so-line {
  font-family: var(--font-mono);
  font-size: 12.5px;
  letter-spacing: 0.01em;
  color: var(--text-secondary);
  opacity: 0;
  animation: so-line-in 0.26s var(--ease) forwards;
  animation-delay: calc(var(--i) * 170ms);
}

.so-line:nth-child(2) {
  color: var(--text-primary);
}

.so-caret {
  display: inline-block;
  width: 7px;
  height: 13px;
  margin-left: 5px;
  vertical-align: -2px;
  background: var(--primary);
  animation: so-blink 0.9s steps(1) infinite;
}

/* The link bar sweeping out — mirrors the login screen's scanline. */
.so-sweep {
  position: relative;
  height: 2px;
  margin-top: 10px;
  overflow: hidden;
  border-radius: 99px;
  background: var(--border-light);
}

.so-sweep::after {
  content: '';
  position: absolute;
  inset: 0;
  width: 45%;
  border-radius: 99px;
  background: linear-gradient(90deg, transparent, var(--primary), transparent);
  animation: so-sweep 0.9s var(--ease) infinite;
}

.so-fade-enter-active {
  transition: opacity 0.16s var(--ease);
}

.so-fade-leave-active {
  transition: opacity 0.32s var(--ease);
}

.so-fade-enter-from,
.so-fade-leave-to {
  opacity: 0;
}

@keyframes so-line-in {
  to {
    opacity: 1;
  }
}

@keyframes so-blink {
  50% {
    opacity: 0;
  }
}

@keyframes so-sweep {
  from {
    transform: translateX(-110%);
  }
  to {
    transform: translateX(240%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .so-line,
  .so-caret,
  .so-sweep::after {
    animation: none;
  }

  .so-line {
    opacity: 1;
  }
}
</style>
