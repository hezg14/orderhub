<script setup lang="ts">
import { ApiError } from '@/api/client';
import { currentLocale, setLocale, useI18n, type AppLocale } from '@/i18n';
import { DEMO_PASSWORD } from '@/config/demoAccounts';
import BrandMark from '@/components/BrandMark.vue';
import { useCountUp } from '@/composables/useCountUp';
import { useAuthStore } from '@/stores/auth';
import { Lock, Message } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const { t } = useI18n();
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

/* The hero numbers count up on mount — the panel boots like an instrument.
   Rounded + locale-grouped: a raw eased float (56.7757…) reads as a glitch,
   and changing digit widths jitter the neighbouring stats. */
const countOrders = useCountUp(computed(() => 64));
const countCustomers = useCountUp(computed(() => 20));
const demoOrders = computed(() => Math.round(countOrders.value).toLocaleString());
const demoCustomers = computed(() => Math.round(countCustomers.value).toLocaleString());


const form = reactive({
  email: 'admin@orderhub.demo',
  password: DEMO_PASSWORD,
});

const error = ref('');
const submitting = ref(false);

function fill(role: 'admin' | 'staff') {
  form.email = role === 'admin' ? 'admin@orderhub.demo' : 'staff@orderhub.demo';
  form.password = DEMO_PASSWORD;
  error.value = '';
}

function toggleLocale() {
  setLocale((currentLocale() === 'zh' ? 'en' : 'zh') as AppLocale);
}

async function submit() {
  if (!form.email || !form.password) {
    error.value = t('auth.missing');
    return;
  }

  submitting.value = true;
  error.value = '';

  try {
    await auth.login(form.email, form.password);
    ElMessage.success(t('auth.welcome', { name: auth.displayName }));
    const next = typeof route.query.next === 'string' ? route.query.next : '/';
    await router.replace(next);
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : t('auth.failed');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="login">
    <!-- brand panel -->
    <section class="brand-panel">
      <!-- Viewfinder brackets, same device as the dashboard deck. -->
      <span class="hud tl" />
      <span class="hud tr" />
      <span class="hud bl" />
      <span class="hud br" />

      <!-- Slow telemetry sweep: one thin line crosses the panel every few
           seconds — the screen is on, not printed. -->
      <span class="scanline" aria-hidden="true" />

      <!-- Brand DNA motif: a route with nodes, a parcel traveling between them. -->
      <svg class="route-deco" viewBox="0 0 520 260" fill="none" aria-hidden="true">
        <path
          class="deco-dash"
          d="M-20 200C90 200 130 150 220 150s120 60 200 30 120-90 140-130"
          stroke="rgba(255,255,255,.28)"
          stroke-width="2"
          stroke-dasharray="6 8"
          stroke-linecap="round"
        />
        <circle class="deco-node" cx="10" cy="200" r="5" fill="rgba(255,255,255,.45)" />
        <circle cx="330" cy="182" r="7" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2" />
        <circle class="deco-ring" cx="330" cy="182" r="7" fill="none" stroke="rgba(165,180,252,.8)" stroke-width="2" />
        <circle class="deco-node" cx="540" cy="50" r="5" fill="rgba(255,255,255,.45)" />
        <circle r="6" fill="#fbbf24" stroke="rgba(255,255,255,.85)" stroke-width="2">
          <animateMotion
            dur="6s"
            repeatCount="indefinite"
            path="M-20 200C90 200 130 150 220 150s120 60 200 30 120-90 140-130"
          />
        </circle>
      </svg>

      <div class="brand-top">
        <BrandMark :size="38" tile />
        <span>{{ t('common.appName') }}</span>
      </div>

      <div class="copy">
        <h1>{{ t('auth.heroTitle') }}</h1>
        <p>{{ t('auth.heroSub') }}</p>

        <dl class="numbers">
          <div><dt>{{ demoOrders }}</dt><dd>{{ t('auth.statOrders') }}</dd></div>
          <div><dt>{{ demoCustomers }}</dt><dd>{{ t('auth.statCustomers') }}</dd></div>
          <div><dt>{{ t('auth.statRolesValue') }}</dt><dd>{{ t('auth.statRoles') }}</dd></div>
        </dl>

        <!-- Boot log: the panel reports for duty, one line at a time. -->
        <div class="boot-lines" aria-hidden="true">
          <span class="boot-line" style="--i: 0">{{ t('auth.bootLog1') }}</span>
          <span class="boot-line" style="--i: 1">{{ t('auth.bootLog2') }}</span>
          <span class="boot-line" style="--i: 2">{{ t('auth.bootLog3') }}<i class="caret" /></span>
        </div>
      </div>

      <p class="fine">{{ t('auth.fine') }}</p>
    </section>

    <!-- form panel -->
    <section class="form-panel">
      <div class="form-box">
        <div class="box-head">
          <span class="bh-key mono">AUTH</span>
          <span class="bh-rule" />
          <span class="bh-val mono">ORDERHUB / SIGN-IN</span>
        </div>

        <div class="box-body">
            <div class="form-top">
              <h2>{{ t('auth.loginTo') }}</h2>
              <button class="lang" type="button" @click="toggleLocale">
                {{ currentLocale() === 'zh' ? 'EN' : '中文' }}
              </button>
            </div>
            <p class="sub">{{ t('auth.prefill') }}</p>

          <el-alert
            v-if="error"
            :title="error"
            type="error"
            show-icon
            :closable="false"
            class="alert"
          />

          <form @submit.prevent="submit">
            <label class="field">
              <span>{{ t('auth.email') }}</span>
              <el-input
                v-model="form.email"
                size="large"
                :placeholder="t('auth.emailPlaceholder')"
                autocomplete="username"
                :prefix-icon="Message"
                @keyup.enter="submit"
              />
            </label>

            <label class="field">
              <span>{{ t('auth.password') }}</span>
              <el-input
                v-model="form.password"
                type="password"
                size="large"
                show-password
                :placeholder="t('auth.passwordPlaceholder')"
                autocomplete="current-password"
                :prefix-icon="Lock"
                @keyup.enter="submit"
              />
            </label>

            <el-button
              type="primary"
              size="large"
              native-type="submit"
              class="submit"
              :loading="submitting"
            >
              {{ submitting ? t('auth.signingIn') : t('auth.signIn') }}
            </el-button>
          </form>

          <div class="accounts">
            <p class="accounts-title">{{ t('auth.demoAccounts') }}</p>
            <button type="button" class="account" @click="fill('admin')">
              <span class="dot admin" />
              <span class="who">{{ t('auth.adminRole') }}</span>
              <code>admin@orderhub.demo</code>
            </button>
            <button type="button" class="account" @click="fill('staff')">
              <span class="dot staff" />
              <span class="who">{{ t('auth.staffRole') }}</span>
              <code>staff@orderhub.demo</code>
            </button>
          </div>

          <p class="hint">{{ t('auth.switchHint') }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr;
}

/* ---------- left ---------- */
/* The same surface as the dashboard hero deck — one identity everywhere.
   Deep indigo + blueprint dots, not a saturated purple wash. */
.brand-panel {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 48px 56px;
  color: #fff;
  background-color: #16163a;
  background-image: radial-gradient(rgb(255 255 255 / 6%) 1px, transparent 1px), var(--hero-bg);
  background-size: 22px 22px, 100% 100%;
}

/* One soft light source, high and to the right — depth without decoration. */
.brand-panel::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(620px 420px at 80% -12%, rgb(129 140 248 / 26%), transparent 66%);
  pointer-events: none;
}

/* Viewfinder brackets: the same device as the dashboard deck. */
.hud {
  position: absolute;
  z-index: 1;
  width: 16px;
  height: 16px;
  border: 0 solid rgb(199 210 254 / 40%);
  pointer-events: none;
}

.hud.tl {
  top: 14px;
  left: 14px;
  border-top-width: 1.5px;
  border-left-width: 1.5px;
}

.hud.tr {
  top: 14px;
  right: 14px;
  border-top-width: 1.5px;
  border-right-width: 1.5px;
}

.hud.bl {
  bottom: 14px;
  left: 14px;
  border-bottom-width: 1.5px;
  border-left-width: 1.5px;
}

.hud.br {
  bottom: 14px;
  right: 14px;
  border-bottom-width: 1.5px;
  border-right-width: 1.5px;
}

/* Route decoration echoes the dashboard/empty-state motif. */
.route-deco {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 48px;
  width: 100%;
  height: auto;
  pointer-events: none;
}

/* Nodes breathe out of phase; the hub emits a soft radar ring. */
.deco-node {
  animation: node-breathe 3.2s ease-in-out infinite;
}

.route-deco .deco-node:nth-of-type(3) {
  animation-delay: 1.1s;
}

.deco-ring {
  transform-box: fill-box;
  transform-origin: center;
  animation: node-radar 3.2s ease-out infinite;
}

@keyframes node-breathe {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 1;
  }
}

@keyframes node-radar {
  0% {
    opacity: 0.7;
    transform: scale(1);
  }
  70%,
  100% {
    opacity: 0;
    transform: scale(2.6);
  }
}

/* Telemetry sweep — a 2px line drifting down the panel, barely there. */
.scanline {
  position: absolute;
  inset-inline: 0;
  top: 0;
  height: 90px;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    transparent,
    rgb(165 180 252 / 7%) 46%,
    rgb(199 210 254 / 16%) 50%,
    rgb(165 180 252 / 7%) 54%,
    transparent
  );
  animation: scan 9s var(--ease) infinite;
}

@keyframes scan {
  0% {
    transform: translateY(-110px);
    opacity: 0;
  }
  8% {
    opacity: 1;
  }
  55% {
    opacity: 1;
  }
  70%,
  100% {
    transform: translateY(105vh);
    opacity: 0;
  }
}

.brand-top {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 600;
}

.copy {
  position: relative;
  margin: auto 0;
  max-width: 460px;
}

.copy h1 {
  font-size: 38px;
  line-height: 1.18;
  letter-spacing: -0.02em;
  margin: 0 0 18px;
  font-weight: 700;
}

.copy p {
  font-size: 15px;
  line-height: 1.7;
  color: #ddd6fe;
  margin: 0 0 32px;
}

.numbers {
  display: flex;
  gap: 36px;
  margin: 0;
}

.numbers dt {
  font-family: var(--font-mono);
  font-size: 25px;
  font-weight: 600;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.numbers dd {
  margin: 2px 0 0;
  font-size: 13px;
  color: #c7d2fe;
}

/* Boot log: mono micro-lines reporting for duty, staggered like a terminal. */
.boot-lines {
  margin-top: 26px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 10.5px;
  letter-spacing: 0.04em;
}

.boot-line {
  display: inline-flex;
  align-items: center;
  color: rgb(165 180 252 / 78%);
  opacity: 0;
  animation: line-in 0.45s var(--ease) both;
  animation-delay: calc(0.7s + var(--i) * 0.45s);
}

.caret {
  display: inline-block;
  width: 7px;
  height: 12px;
  margin-left: 5px;
  background: rgb(165 180 252 / 85%);
  animation: caret-blink 1.1s steps(1) infinite 2.1s, line-in 0.45s var(--ease) both 2.1s;
}

@keyframes line-in {
  from {
    opacity: 0;
    transform: translateX(-6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes caret-blink {
  0%,
  55% {
    opacity: 1;
  }
  56%,
  100% {
    opacity: 0;
  }
}

.fine {
  position: relative;
  font-size: 11px;
  color: rgb(219 234 254 / 70%);
  margin: 0;
}

/* ---------- right ---------- */
/* The page's dot grid shows through: the form is a panel standing on the
   blueprint, not a full-bleed sheet that erases the surface language. */
.form-panel {
  display: grid;
  place-items: center;
  padding: 40px;
  background: transparent;
}

.form-box {
  width: 100%;
  max-width: 400px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--r-card);
  background: var(--bg-card);
  box-shadow: var(--shadow-overlay);
}

/* Panel header: an instrument label, not decoration. */
.box-head {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 30px;
  padding: 0 12px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-subtle);
}

.bh-key {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--primary);
}

.bh-rule {
  flex: 1;
  height: 1px;
  background: repeating-linear-gradient(90deg, var(--border) 0 3px, transparent 3px 6px);
}

.bh-val {
  font-size: 9px;
  letter-spacing: 0.1em;
  color: var(--text-disabled);
}

.box-body {
  padding: 24px 26px 20px;
}

.form-box h2 {
  font-size: 24px;
  letter-spacing: -0.02em;
  margin: 0 0 6px;
}

.form-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.lang {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--r-pill);
  padding: 3px 10px;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  flex: none;
}

.lang:hover {
  border-color: var(--primary-border);
  color: var(--primary);
}

.sub {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 0 24px;
}

.alert {
  margin-bottom: 16px;
}

.field {
  display: block;
  margin-bottom: 16px;
}

.field span {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 6px;
  color: var(--text-primary);
}

.submit {
  width: 100%;
  margin-top: 4px;
}

.accounts {
  margin-top: 24px;
  padding: 14px;
  border-radius: var(--r-card);
  background: var(--primary-bg);
  border: 1px solid var(--primary-border);
}

.accounts-title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--primary);
}

.account {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: left;
}

.account:hover {
  background: var(--bg-hover);
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}

.dot.admin {
  background: var(--primary);
}

.dot.staff {
  background: var(--warning);
}

.who {
  flex: 1;
}

.account code {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  color: var(--text-disabled);
}

.hint {
  margin: 16px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-disabled);
}

@media (max-width: 900px) {
  .login {
    grid-template-columns: 1fr;
  }

  .brand-panel {
    display: none;
  }

  .form-panel {
    padding: 24px;
  }
}
</style>
