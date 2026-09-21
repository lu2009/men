<template>
  <n-modal
    :show="show"
    :mask-closable="!saving"
    @update:show="$emit('update:show', $event)"
  >
    <n-card
      class="client-form-modal"
      :bordered="false"
      role="dialog"
      aria-modal="true"
      :aria-label="editing ? '编辑客户' : '新增客户'"
    >
      <header class="client-form-modal__header">
        <n-button
          class="client-form-modal__close"
          quaternary
          circle
          aria-label="关闭客户表单"
          @click="closeModal"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m5.5 5.5 9 9m0-9-9 9" />
          </svg>
        </n-button>
        <p>{{ editing ? 'EDIT CUSTOMER' : 'NEW CUSTOMER' }}</p>
        <h2>{{ editing ? '编辑客户资料' : '新增客户' }}</h2>
        <span>
          {{ editing ? '更新联系人、交付与物流信息。' : '录入客户的基础资料，客户名称为必填项。' }}
        </span>
      </header>

      <n-form class="client-form" label-placement="top" :show-require-mark="false">
        <section class="client-form__section" aria-labelledby="client-basic-title">
          <div class="client-form__section-heading">
            <span class="client-form__section-index">01</span>
            <div>
              <h3 id="client-basic-title">基础信息</h3>
              <p>用于客户识别与业务归档</p>
            </div>
          </div>

          <div class="client-form__grid">
            <n-form-item label="客户名称" required>
              <n-input
                v-model:value="form.name"
                autofocus
                placeholder="请输入客户名称"
                autocomplete="organization"
                @keyup.enter="$emit('save')"
              />
            </n-form-item>
            <n-form-item label="品牌">
              <n-input v-model:value="form.brand" placeholder="请输入品牌" />
            </n-form-item>
          </div>
        </section>

        <section class="client-form__section" aria-labelledby="client-contact-title">
          <div class="client-form__section-heading">
            <span class="client-form__section-index">02</span>
            <div>
              <h3 id="client-contact-title">联系与交付</h3>
              <p>便于业务沟通和送货确认</p>
            </div>
          </div>

          <div class="client-form__grid">
            <n-form-item label="联系人">
              <n-input
                v-model:value="form.contact"
                placeholder="请输入联系人"
                autocomplete="name"
              />
            </n-form-item>
            <n-form-item label="联系电话">
              <n-input
                v-model:value="form.phone"
                placeholder="请输入联系电话"
                autocomplete="tel"
              />
            </n-form-item>
            <n-form-item label="送货电话">
              <n-input
                v-model:value="form.delivery_phone"
                placeholder="请输入送货电话"
                autocomplete="tel"
              />
            </n-form-item>
            <n-form-item class="client-form__field--wide" label="送货地址">
              <n-input
                v-model:value="form.address"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 4 }"
                placeholder="请输入详细送货地址"
                autocomplete="street-address"
              />
            </n-form-item>
          </div>
        </section>

        <section class="client-form__section" aria-labelledby="client-logistics-title">
          <div class="client-form__section-heading">
            <span class="client-form__section-index">03</span>
            <div>
              <h3 id="client-logistics-title">物流信息</h3>
              <p>记录常用承运商及其联系方式</p>
            </div>
          </div>

          <div class="client-form__grid">
            <n-form-item label="物流商">
              <n-input v-model:value="form.logistics" placeholder="请输入物流商" />
            </n-form-item>
            <n-form-item label="物流电话">
              <n-input
                v-model:value="form.logistics_phone"
                placeholder="请输入物流电话"
                autocomplete="tel"
              />
            </n-form-item>
          </div>
        </section>
      </n-form>

      <template #footer>
        <div class="client-form-modal__footer">
          <p><span aria-hidden="true">*</span> 客户名称为必填项</p>
          <div class="client-form-modal__actions">
            <n-button size="large" :disabled="saving" @click="closeModal">取消</n-button>
            <n-button type="primary" size="large" :loading="saving" @click="$emit('save')">
              {{ editing ? '保存修改' : '创建客户' }}
            </n-button>
          </div>
        </div>
      </template>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import type { ClientInput } from '../../api/types'

defineProps<{
  show: boolean
  editing: boolean
  saving: boolean
  form: Required<ClientInput>
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  save: []
}>()

function closeModal() {
  emit('update:show', false)
}
</script>

<style scoped>
.client-form-modal {
  width: min(720px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  display: flex;
  overflow: hidden;
  flex-direction: column;
  border: var(--sd-border-width) solid var(--sd-border-glass-strong);
  border-radius: var(--sd-radius-material);
  background: var(--sd-material-surface-strong);
  box-shadow: var(--sd-shadow-material-shell);
  backdrop-filter: blur(var(--sd-glass-blur-lg)) saturate(var(--sd-glass-saturation-strong));
  -webkit-backdrop-filter: blur(var(--sd-glass-blur-lg)) saturate(var(--sd-glass-saturation-strong));
}

.client-form-modal :deep(.n-card-content) {
  min-height: 0;
  flex: 1 1 auto;
  overflow: auto;
  padding: var(--sd-space-6) var(--sd-space-6) var(--sd-space-2);
}

.client-form-modal :deep(.n-card__footer) {
  padding: var(--sd-space-4) var(--sd-space-6);
  border-top: var(--sd-border-width) solid var(--sd-material-separator-soft);
  background: var(--sd-material-surface);
}


.client-form-modal__header {
  position: relative;
  padding-right: var(--sd-space-10);
}

.client-form-modal__close {
  position: absolute;
  top: calc(var(--sd-space-1) * -1);
  right: 0;
}

.client-form-modal__close svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.7;
}

.client-form-modal__header > p {
  margin: 0 0 var(--sd-space-1);
  color: var(--sd-color-action);
  font-size: var(--sd-font-size-2xs);
  font-weight: var(--sd-font-weight-bold);
  letter-spacing: var(--sd-letter-spacing-eyebrow);
}

.client-form-modal__header h2 {
  margin: 0;
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-xl);
  font-weight: var(--sd-font-weight-bold);
  line-height: var(--sd-line-height-tight);
}

.client-form-modal__header > span {
  display: block;
  margin-top: var(--sd-space-2);
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-sm);
}

.client-form {
  margin-top: var(--sd-space-6);
}

.client-form__section {
  padding: var(--sd-space-5) 0;
  border-top: var(--sd-border-width) solid var(--sd-material-separator-soft);
}

.client-form__section-heading {
  display: flex;
  align-items: flex-start;
  gap: var(--sd-space-3);
  margin-bottom: var(--sd-space-4);
}

.client-form__section-index {
  display: grid;
  width: var(--sd-control-height-small);
  height: var(--sd-control-height-small);
  flex: 0 0 auto;
  place-items: center;
  border-radius: var(--sd-radius-sm);
  color: var(--sd-color-action);
  background: var(--sd-color-action-soft);
  font-family: var(--sd-font-data);
  font-size: var(--sd-font-size-2xs);
  font-weight: var(--sd-font-weight-bold);
}

.client-form__section-heading h3,
.client-form__section-heading p {
  margin: 0;
}

.client-form__section-heading h3 {
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-md);
  font-weight: var(--sd-font-weight-strong);
}

.client-form__section-heading p {
  margin-top: var(--sd-space-1);
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-xs);
}

.client-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 var(--sd-space-4);
}

.client-form__field--wide {
  grid-column: 1 / -1;
}

.client-form :deep(.n-form-item-label) {
  color: var(--sd-color-text);
  font-size: var(--sd-font-size-sm);
  font-weight: var(--sd-font-weight-strong);
}

.client-form :deep(.n-input) {
  border-radius: var(--sd-radius-control);
  background: var(--sd-material-control);
  transition:
    background-color var(--sd-duration-fast) var(--sd-ease-standard),
    box-shadow var(--sd-duration-fast) var(--sd-ease-standard);
}

.client-form :deep(.n-input:hover) {
  background: var(--sd-material-control-hover);
}

.client-form :deep(.n-input--focus) {
  background: var(--sd-material-control-focus);
  box-shadow: var(--sd-focus-ring-soft);
}

.client-form-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sd-space-4);
}

.client-form-modal__footer p {
  margin: 0;
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-xs);
}

.client-form-modal__footer p span {
  color: var(--sd-color-danger);
}

.client-form-modal__actions {
  display: flex;
  gap: var(--sd-space-2);
}

@media (max-width: 640px) {
  .client-form-modal {
    width: calc(100vw - 24px);
    max-height: calc(100vh - 24px);
    border-radius: var(--sd-radius-card);
  }

  .client-form-modal :deep(.n-card-content) {
    padding: var(--sd-space-5) var(--sd-space-4) var(--sd-space-2);
  }

  .client-form-modal :deep(.n-card__footer) {
    padding: var(--sd-space-4);
  }

  .client-form__grid {
    grid-template-columns: 1fr;
  }

  .client-form__field--wide {
    grid-column: auto;
  }

  .client-form-modal__footer {
    align-items: stretch;
    flex-direction: column;
  }

  .client-form-modal__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
</style>
