<template>
  <section class="clients-toolbar" aria-labelledby="clients-page-title">
    <div class="clients-toolbar__heading">
      <div class="clients-toolbar__copy">
        <p class="clients-toolbar__eyebrow">CUSTOMER DIRECTORY</p>
        <div class="clients-toolbar__title-row">
          <h1 id="clients-page-title">客户信息</h1>
          <span class="clients-toolbar__count">{{ total }} 位客户</span>
        </div>
        <p class="clients-toolbar__description">
          集中维护客户联系人、交付地址与物流信息。
        </p>
      </div>

      <n-button
        class="clients-toolbar__create"
        type="primary"
        size="large"
        @click="$emit('create')"
      >
        <template #icon>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 4v12M4 10h12" />
          </svg>
        </template>
        新增客户
      </n-button>
    </div>

    <div class="clients-toolbar__commands">
      <n-input
        class="clients-toolbar__search"
        :value="search"
        size="large"
        clearable
        placeholder="搜索客户、联系人、电话或地址"
        :input-props="{ 'aria-label': '搜索客户' }"
        @update:value="$emit('update:search', $event)"
      >
        <template #prefix>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="8.75" cy="8.75" r="5.25" />
            <path d="m12.7 12.7 3.8 3.8" />
          </svg>
        </template>
      </n-input>

      <p class="clients-toolbar__result" aria-live="polite">
        <template v-if="search.trim()">
          找到 <strong>{{ filteredCount }}</strong> 条匹配记录
        </template>
        <template v-else>
          支持按客户、联系人、电话和地址快速定位
        </template>
      </p>

      <n-button
        class="clients-toolbar__refresh"
        size="large"
        :loading="loading"
        @click="$emit('refresh')"
      >
        <template #icon>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M15.5 7.25A6 6 0 1 0 16 11" />
            <path d="M15.5 3.75v3.5H12" />
          </svg>
        </template>
        刷新
      </n-button>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  search: string
  total: number
  filteredCount: number
  loading: boolean
}>()

defineEmits<{
  'update:search': [value: string]
  refresh: []
  create: []
}>()
</script>

<style scoped>
.clients-toolbar {
  position: relative;
  overflow: hidden;
  padding: var(--sd-space-6);
  border: var(--sd-border-width) solid var(--sd-border-glass-strong);
  border-radius: var(--sd-radius-card);
  background: var(--sd-material-surface-strong);
  box-shadow: var(--sd-shadow-material-card);
  backdrop-filter: blur(var(--sd-glass-blur-md)) saturate(var(--sd-glass-saturation));
  -webkit-backdrop-filter: blur(var(--sd-glass-blur-md)) saturate(var(--sd-glass-saturation));
}

.clients-toolbar::after {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: var(--sd-border-width);
  background: var(--sd-material-highlight-strong);
  content: '';
  pointer-events: none;
}

.clients-toolbar__heading,
.clients-toolbar__commands,
.clients-toolbar__title-row {
  display: flex;
  align-items: center;
}

.clients-toolbar__heading {
  justify-content: space-between;
  gap: var(--sd-space-6);
}

.clients-toolbar__copy {
  min-width: 0;
}

.clients-toolbar__eyebrow {
  margin: 0 0 var(--sd-space-1);
  color: var(--sd-color-action);
  font-size: var(--sd-font-size-2xs);
  font-weight: var(--sd-font-weight-bold);
  letter-spacing: var(--sd-letter-spacing-eyebrow);
}

.clients-toolbar__title-row {
  flex-wrap: wrap;
  gap: var(--sd-space-3);
}

.clients-toolbar h1 {
  margin: 0;
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-2xl);
  font-weight: var(--sd-font-weight-bold);
  letter-spacing: -0.02em;
  line-height: var(--sd-line-height-tight);
}

.clients-toolbar__count {
  padding: var(--sd-space-1) var(--sd-space-2-5);
  border: var(--sd-border-width) solid var(--sd-border-action-faint);
  border-radius: var(--sd-radius-pill);
  color: var(--sd-color-action);
  background: var(--sd-color-action-soft);
  font-size: var(--sd-font-size-xs);
  font-weight: var(--sd-font-weight-strong);
  line-height: var(--sd-line-height-tight);
}

.clients-toolbar__description {
  margin: var(--sd-space-2) 0 0;
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-sm);
}

.clients-toolbar__create,
.clients-toolbar__refresh {
  flex: 0 0 auto;
}

.clients-toolbar__create :deep(.n-button__icon),
.clients-toolbar__refresh :deep(.n-button__icon) {
  width: 18px;
  height: 18px;
}

.clients-toolbar__create svg,
.clients-toolbar__refresh svg,
.clients-toolbar__search svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.clients-toolbar__commands {
  gap: var(--sd-space-3);
  margin-top: var(--sd-space-5);
  padding-top: var(--sd-space-5);
  border-top: var(--sd-border-width) solid var(--sd-material-separator-soft);
}

.clients-toolbar__search {
  width: min(420px, 100%);
}

.clients-toolbar__search :deep(.n-input) {
  border-radius: var(--sd-radius-control);
  background: var(--sd-material-control-focus);
  box-shadow: var(--sd-shadow-sm);
}

.clients-toolbar__search :deep(.n-input__prefix) {
  width: 18px;
  color: var(--sd-color-text-muted);
}

.clients-toolbar__result {
  min-width: 0;
  flex: 1;
  margin: 0;
  overflow: hidden;
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clients-toolbar__result strong {
  color: var(--sd-color-text-strong);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 900px) {
  .clients-toolbar {
    padding: var(--sd-space-5);
  }

  .clients-toolbar__commands {
    flex-wrap: wrap;
  }

  .clients-toolbar__search {
    width: 100%;
  }

  .clients-toolbar__result {
    order: 3;
    width: 100%;
    flex-basis: 100%;
    white-space: normal;
  }
}

@media (max-width: 640px) {
  .clients-toolbar {
    padding: var(--sd-space-4);
    border-radius: var(--sd-radius-md);
  }

  .clients-toolbar__heading {
    align-items: stretch;
    flex-direction: column;
    gap: var(--sd-space-4);
  }

  .clients-toolbar__create {
    width: 100%;
  }

  .clients-toolbar__commands {
    align-items: stretch;
    flex-direction: column;
    margin-top: var(--sd-space-4);
    padding-top: var(--sd-space-4);
  }

  .clients-toolbar__refresh {
    width: 100%;
  }

  .clients-toolbar__result {
    order: initial;
  }
}
</style>
