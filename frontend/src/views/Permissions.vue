<script setup lang="ts">
import { usersApi } from '@/api';
import { ApiError } from '@/api/client';
import { PERMISSION_MATRIX } from '@/config/permissions';
import { useI18n, localName } from '@/i18n';
import { MOBILE_QUERY, useMediaQuery } from '@/composables/useMediaQuery';
import { useAuthStore } from '@/stores/auth';
import type { Role, User } from '@/types';
import { Check, Close, Plus } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';

const { t } = useI18n();
const auth = useAuthStore();
const isMobile = useMediaQuery(MOBILE_QUERY);

const members = ref<(User & { _count: { orders: number; auditLogs: number } })[]>([]);
const loadingMembers = ref(false);
const pendingRole = ref<string | null>(null);

const inviteOpen = ref(false);
const inviting = ref(false);
const invite = reactive<{ email: string; name: string; role: Role; password: string }>({
  email: '',
  name: '',
  role: 'staff',
  password: '',
});

const adminCount = computed(() => members.value.filter((m) => m.role === 'admin').length);

function loadMembers() {
  loadingMembers.value = true;
  usersApi
    .list()
    .then((rows) => (members.value = rows))
    .catch(() => ElMessage.error(t('permissions.membersLoadFailed')))
    .finally(() => (loadingMembers.value = false));
}

/** A role the signed-in admin may not touch: their own, or the last admin's. */
function isLocked(row: User) {
  if (row.id === auth.user?.id) return true;
  return row.role === 'admin' && adminCount.value <= 1;
}

function lockReason(row: User) {
  if (row.id === auth.user?.id) return t('permissions.selfRole');
  if (row.role === 'admin' && adminCount.value <= 1) return t('permissions.lastAdmin');
  return '';
}

async function onRoleChange(row: User, next: Role) {
  if (isLocked(row) || next === row.role) return;

  if (row.role === 'admin' && next === 'staff') {
    try {
      await ElMessageBox.confirm(t('permissions.demoteConfirm', { name: localName(row) }), t('permissions.demoteConfirmTitle'), {
        type: 'warning',
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
      });
    } catch {
      return; // cancelled — the select is re-rendered from `row.role` anyway
    }
  }

  pendingRole.value = row.id;
  try {
    await usersApi.changeRole(row.id, next);
    row.role = next;
    ElMessage.success(t('permissions.roleChanged'));
  } catch (err) {
    ElMessage.error(err instanceof ApiError ? err.message : t('permissions.roleChangeFailed'));
  } finally {
    pendingRole.value = null;
  }
}

async function submitInvite() {
  if (!invite.email.trim() || !invite.name.trim() || invite.password.length < 8) {
    ElMessage.warning(t('settings.inviteIncomplete'));
    return;
  }
  inviting.value = true;
  try {
    await usersApi.invite({ ...invite });
    ElMessage.success(t('settings.inviteCreated'));
    inviteOpen.value = false;
    Object.assign(invite, { email: '', name: '', role: 'staff', password: '' });
    loadMembers();
  } catch (err) {
    ElMessage.error(err instanceof ApiError ? err.message : t('settings.inviteFailed'));
  } finally {
    inviting.value = false;
  }
}

onMounted(loadMembers);
</script>

<template>
  <div class="page">
    <div class="head">
      <div>
        <h2>{{ t('permissions.title') }}</h2>
        <p class="muted">{{ t('permissions.subtitle') }}</p>
      </div>
      <el-button v-if="!isMobile" :icon="Plus" type="primary" @click="inviteOpen = true">
        {{ t('settings.invite') }}
      </el-button>
    </div>

    <!-- 01 · matrix -->
    <div class="card section">
      <div class="card-head">
        <h3>{{ t('permissions.matrixTitle') }}</h3>
        <span class="microlabel dim">01</span>
      </div>

      <div v-if="!isMobile" class="matrix">
        <div class="m-row m-head">
          <span class="m-res">{{ t('permissions.colResource') }}</span>
          <span class="m-col">{{ t('nav.admin') }}</span>
          <span class="m-col">{{ t('nav.staff') }}</span>
        </div>
        <div v-for="row in PERMISSION_MATRIX" :key="row.key" class="m-row">
          <div class="m-res">
            <span>{{ t(`permissions.rows.${row.key}`) }}</span>
            <span v-if="row.noteKey" class="m-note">{{ t(`permissions.notes.${row.noteKey}`) }}</span>
          </div>
          <span class="m-col">
            <el-icon class="ok" :size="15"><Check /></el-icon>
          </span>
          <span class="m-col">
            <el-icon v-if="row.staff" class="ok" :size="15"><Check /></el-icon>
            <el-icon v-else class="no" :size="14"><Close /></el-icon>
          </span>
        </div>
      </div>

      <ul v-else class="m-list">
        <li v-for="row in PERMISSION_MATRIX" :key="row.key" class="m-rec">
          <div class="m-rec-top">
            <span class="m-rec-name">{{ t(`permissions.rows.${row.key}`) }}</span>
            <span class="m-rec-flags">
              <span class="flag" :class="row.admin ? 'on' : 'off'">{{ t('nav.admin') }}</span>
              <span class="flag" :class="row.staff ? 'on' : 'off'">{{ t('nav.staff') }}</span>
            </span>
          </div>
          <span v-if="row.noteKey" class="m-note">{{ t(`permissions.notes.${row.noteKey}`) }}</span>
        </li>
      </ul>

      <p class="foot-note muted">{{ t('permissions.matrixFoot') }}</p>
    </div>

    <!-- 02 · members -->
    <div class="card section">
      <div class="card-head">
        <h3>{{ t('permissions.membersTitle') }}</h3>
        <span class="microlabel dim">02</span>
      </div>

      <el-button v-if="isMobile" class="invite-btn" :icon="Plus" type="primary" @click="inviteOpen = true">
        {{ t('settings.invite') }}
      </el-button>

      <div v-loading="loadingMembers">
        <div v-if="!isMobile" class="mem-table">
          <div class="mem-row mem-head">
            <span>{{ t('settings.name') }}</span>
            <span>{{ t('settings.emailShort') }}</span>
            <span class="mem-role">{{ t('settings.role') }}</span>
            <span class="mem-count">{{ t('settings.ordersCreated') }}</span>
          </div>
          <div v-for="row in members" :key="row.id" class="mem-row">
            <span class="mem-name">
              <span class="mini-avatar">{{ localName(row).slice(0, 1) }}</span>
              {{ localName(row) }}
              <span v-if="row.id === auth.user?.id" class="you microlabel">{{ t('permissions.you') }}</span>
            </span>
            <span class="mem-email">{{ row.email }}</span>
            <span class="mem-role">
              <el-tooltip :content="lockReason(row)" :disabled="!isLocked(row)" placement="top">
                <el-select
                  :model-value="row.role"
                  size="small"
                  class="role-select"
                  :class="{ locked: isLocked(row) }"
                  :disabled="pendingRole === row.id"
                  @change="(v: Role) => onRoleChange(row, v)"
                >
                  <el-option value="admin" :label="t('nav.admin')" />
                  <el-option value="staff" :label="t('nav.staff')" />
                </el-select>
              </el-tooltip>
            </span>
            <span class="mem-count figures">{{ row._count.orders }}</span>
          </div>
        </div>

        <ul v-else class="mem-list">
          <li v-for="row in members" :key="row.id" class="mem-rec">
            <div class="mem-rec-top">
              <div class="mem-name">
                <span class="mini-avatar">{{ localName(row).slice(0, 1) }}</span>
                <span class="mem-id">
                  <span>{{ localName(row) }}</span>
                  <span class="mem-email">{{ row.email }}</span>
                </span>
              </div>
              <span v-if="row.id === auth.user?.id" class="you microlabel">{{ t('permissions.you') }}</span>
            </div>
            <div class="mem-rec-role">
              <span class="microlabel dim">{{ t('settings.role') }}</span>
              <el-select
                :model-value="row.role"
                size="small"
                class="role-select"
                :disabled="isLocked(row) || pendingRole === row.id"
                @change="(v: Role) => onRoleChange(row, v)"
              >
                <el-option value="admin" :label="t('nav.admin')" />
                <el-option value="staff" :label="t('nav.staff')" />
              </el-select>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <el-drawer v-model="inviteOpen" :title="t('settings.inviteTitle')" size="440px">
      <el-form label-position="top">
        <el-form-item :label="t('settings.name')" required>
          <el-input v-model="invite.name" maxlength="80" />
        </el-form-item>
        <el-form-item :label="t('settings.emailShort')" required>
          <el-input v-model="invite.email" placeholder="name@company.com" />
        </el-form-item>
        <el-form-item :label="t('settings.password')" required>
          <el-input v-model="invite.password" type="password" show-password :placeholder="t('settings.passwordHint')" />
        </el-form-item>
        <el-form-item :label="t('settings.role')">
          <el-radio-group v-model="invite.role">
            <el-radio-button value="staff">{{ t('nav.staff') }}</el-radio-button>
            <el-radio-button value="admin">{{ t('nav.admin') }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="inviteOpen = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="inviting" @click="submitInvite">{{ t('common.create') }}</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.section {
  padding: 20px 22px;
  margin-bottom: var(--s-4);
}

/* .card-head h3 styling comes from tokens.css — the shared microlabel pattern. */
.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16px;
}

/* ------------------------------------------------------------- matrix ---- */

.m-row {
  display: grid;
  grid-template-columns: 1fr 120px 120px;
  align-items: center;
  padding: 9px 0;
  border-top: 1px solid var(--border-light);
}

.m-row.m-head {
  border-top: none;
  padding-bottom: 6px;
}

.m-row.m-head span {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.m-res {
  display: flex;
  flex-direction: column;
  gap: 1px;
  font-size: 13px;
}

.m-col {
  text-align: center;
}

.m-note {
  font-size: 11px;
  color: var(--text-disabled);
}

.ok {
  color: var(--success, #67c23a);
}

.no {
  color: var(--text-disabled);
}

.foot-note {
  margin: 14px 0 0;
  font-size: 12px;
}

/* ------------------------------------------------------------- members --- */

.mem-table {
  display: flex;
  flex-direction: column;
}

.mem-row {
  display: grid;
  grid-template-columns: 1.2fr 1.6fr 150px 90px;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--border-light);
  font-size: 13px;
}

.mem-row.mem-head {
  border-top: none;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.mem-name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.mem-email {
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

.mem-count {
  text-align: right;
}

.mini-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--bg-hover);
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  flex: none;
}

.you {
  padding: 1px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
}

.role-select {
  width: 118px;
}

.role-select.locked {
  opacity: 0.55;
}

.invite-btn {
  margin-bottom: 14px;
}

/* Phone ------------------------------------------------------------------ */

.m-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.m-rec {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 11px 0;
  border-top: 1px solid var(--border-light);
}

.m-rec:first-child {
  border-top: none;
}

.m-rec-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.m-rec-name {
  font-size: 13px;
  font-weight: 500;
}

.m-rec-flags {
  display: flex;
  gap: 6px;
}

.flag {
  font-size: 10px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 4px;
}

.flag.on {
  background: color-mix(in srgb, var(--primary) 14%, transparent);
  color: var(--primary);
}

.flag.off {
  background: var(--bg-hover);
  color: var(--text-disabled);
}

.mem-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.mem-rec {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 0;
  border-top: 1px solid var(--border-light);
}

.mem-rec:first-child {
  border-top: none;
}

.mem-rec-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.mem-id {
  display: flex;
  flex-direction: column;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
}

.mem-rec-role {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.mem-rec-role .role-select {
  width: 132px;
}
</style>
