<script setup lang="ts">
import { usersApi } from '@/api';
import { ApiError } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import type { Role, User } from '@/types';
import { useI18n, localName } from '@/i18n';
import { MOBILE_QUERY, useMediaQuery } from '@/composables/useMediaQuery';
import { ElMessage } from 'element-plus';
import { onMounted, reactive, ref } from 'vue';

const { t, localeCode } = useI18n();
const auth = useAuthStore();
const isMobile = useMediaQuery(MOBILE_QUERY);

const name = ref(auth.displayName);
const savingProfile = ref(false);

const members = ref<(User & { _count: { orders: number; auditLogs: number } })[]>([]);
const loadingMembers = ref(false);
const inviteOpen = ref(false);
const inviting = ref(false);
const invite = reactive<{ email: string; name: string; role: Role; password: string }>({
  email: '',
  name: '',
  role: 'staff',
  password: '',
});

async function saveProfile() {
  if (!name.value.trim()) {
    ElMessage.warning(t('settings.nameRequired'));
    return;
  }
  savingProfile.value = true;
  try {
    await auth.updateName(name.value.trim());
    ElMessage.success(t('settings.profileSaved'));
  } catch (err) {
    ElMessage.error(err instanceof ApiError ? err.message : t('settings.saveFailed'));
  } finally {
    savingProfile.value = false;
  }
}

async function loadMembers() {
  if (!auth.isAdmin) return;
  loadingMembers.value = true;
  try {
    members.value = await usersApi.list();
  } catch {
    ElMessage.error(t('settings.membersLoadFailed'));
  } finally {
    loadingMembers.value = false;
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

const fmt = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString(localeCode.value, { year: 'numeric', month: '2-digit', day: '2-digit' })
    : '—';

onMounted(loadMembers);
</script>

<template>
  <div class="page">
    <div class="head">
      <div>
        <h2>{{ t('settings.title') }}</h2>
        <p class="muted">{{ t('settings.subtitle') }}</p>
      </div>
    </div>

    <div class="card section">
      <h3>{{ t('settings.profile') }}</h3>

      <div class="profile">
        <div class="avatar">{{ auth.initials }}</div>
        <div class="fields">
          <el-form label-position="top">
            <div class="two">
              <el-form-item :label="t('settings.name')">
                <el-input v-model="name" maxlength="80" />
              </el-form-item>
              <el-form-item :label="t('settings.email')">
                <el-input :model-value="auth.user?.email" disabled />
              </el-form-item>
            </div>
            <el-form-item :label="t('settings.role')">
              <div class="role-row">
                <el-tag :type="auth.isAdmin ? 'primary' : 'warning'" effect="light">
                  {{ auth.isAdmin ? t('nav.admin') : t('nav.staff') }}
                </el-tag>
                <span class="muted small">
                  {{ auth.isAdmin ? t('settings.adminHint') : t('settings.staffHint') }}
                </span>
              </div>
            </el-form-item>
          </el-form>
          <el-button type="primary" :loading="savingProfile" @click="saveProfile">{{ t('common.saveChanges') }}</el-button>
        </div>
      </div>
    </div>

    <div v-if="auth.isAdmin" class="card section">
      <div class="section-head">
        <h3>{{ t('settings.members') }}</h3>
        <el-button size="small" type="primary" @click="inviteOpen = true">{{ t('settings.invite') }}</el-button>
      </div>

      <el-table v-if="!isMobile" v-loading="loadingMembers" :data="members" style="width: 100%">
        <el-table-column :label="t('settings.name')" min-width="140">
          <template #default="{ row }">
            <div class="member">
              <div class="mini-avatar">{{ localName(row).slice(0, 1) }}</div>
              <span>{{ localName(row) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="email" :label="t('settings.emailShort')" min-width="200" />
        <el-table-column :label="t('settings.role')" width="100">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'primary' : 'info'" effect="light" size="small">
              {{ row.role === 'admin' ? t('nav.admin') : t('nav.staff') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('settings.ordersCreated')" width="110" align="right">
          <template #default="{ row }"><span class="tabular">{{ row._count.orders }}</span></template>
        </el-table-column>
        <el-table-column :label="t('settings.joined')" width="130">
          <template #default="{ row }"><span class="muted tabular">{{ fmt(row.createdAt) }}</span></template>
        </el-table-column>
      </el-table>

      <ul v-else class="member-list">
        <li v-for="row in members" :key="row.id" class="member-rec">
          <div class="member-top">
            <div class="member">
              <div class="mini-avatar">{{ localName(row).slice(0, 1) }}</div>
              <div class="member-id">
                <span class="member-name">{{ localName(row) }}</span>
                <span class="member-email">{{ row.email }}</span>
              </div>
            </div>
            <el-tag :type="row.role === 'admin' ? 'primary' : 'info'" effect="light" size="small">
              {{ row.role === 'admin' ? t('nav.admin') : t('nav.staff') }}
            </el-tag>
          </div>
          <div class="member-meta">
            <span>{{ t('settings.ordersCreated') }} · <span class="tabular">{{ row._count.orders }}</span></span>
            <span class="muted tabular">{{ fmt(row.createdAt) }}</span>
          </div>
        </li>
      </ul>
    </div>

    <div class="card section note">
      <h3>{{ t('settings.about') }}</h3>
      <p>
        {{ t('settings.aboutNote1') }}<code>npm run db:reset</code>{{ t('settings.aboutNote2') }}
      </p>
      <p class="muted small">
        {{ t('settings.aboutMoney1') }}<code>NUMERIC(12,2)</code>{{ t('settings.aboutMoney2') }}
      </p>
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
/* .head styles come from tokens.css — the shared page-header pattern. */

.section {
  padding: 20px 22px;
  margin-bottom: var(--s-4);
}

.section h3 {
  margin: 0 0 16px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.section-head {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.section-head h3 {
  margin: 0;
}

.section-head .el-button {
  margin-left: auto;
}

.profile {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: var(--primary-bg);
  color: var(--primary);
  display: grid;
  place-items: center;
  font-size: 24px;
  font-weight: 700;
  flex: none;
}

.fields {
  flex: 1;
  max-width: 560px;
}

.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.role-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.small {
  font-size: 12px;
}

.member {
  display: flex;
  align-items: center;
  gap: 8px;
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
}

.note p {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.note code {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--bg-hover);
}

/* Phone member list — replaces a five-column table that overflowed 2×. */
.member-list {
  list-style: none;
  margin: 0;
  padding: 0 16px;
}

.member-rec {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid var(--border-light);
}

.member-rec:first-child {
  border-top: none;
}

.member-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.member-id {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.member-name {
  font-size: 13px;
  font-weight: 500;
}

.member-email {
  font-size: 11px;
  color: var(--text-disabled);
  overflow-wrap: anywhere;
}

.member-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: var(--text-secondary);
}

@media (max-width: 767px) {
  .profile {
    flex-direction: column;
  }

  .two {
    grid-template-columns: 1fr;
  }
}
</style>
