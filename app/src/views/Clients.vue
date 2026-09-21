<template>
  <main class="clients-page">
    <div class="clients-layout">
      <ClientsToolbar
        v-model:search="search"
        :total="clients.length"
        :filtered-count="filtered.length"
        :loading="loading"
        @refresh="loadClients"
        @create="openCreate"
      />

      <section class="clients-table-panel" aria-labelledby="clients-table-title">
        <header class="clients-table-panel__header">
          <div>
            <h2 id="clients-table-title">客户台账</h2>
            <p>
              <template v-if="search.trim()">
                当前显示 {{ filtered.length }} / {{ clients.length }} 条记录
              </template>
              <template v-else>
                维护客户联系、送货与物流资料
              </template>
            </p>
          </div>
          <span
            class="clients-table-panel__status"
            :class="{ 'clients-table-panel__status--error': loadError }"
          >
            <span aria-hidden="true"></span>
            {{ loading ? '正在同步' : loadError ? '同步失败' : '资料已同步' }}
          </span>
        </header>

        <n-alert
          v-if="loadError && clients.length && !loading"
          class="clients-table-panel__alert"
          type="error"
          title="刷新失败，当前显示上次已加载的资料"
        >
          {{ loadError }}
        </n-alert>

        <n-result
          v-if="loadError && !clients.length && !loading"
          class="clients-state"
          status="error"
          title="客户资料加载失败"
          :description="loadError"
        >
          <template #footer>
            <n-button type="primary" @click="loadClients">重新加载</n-button>
          </template>
        </n-result>

        <n-data-table
          v-else
          class="clients-table"
          :columns="columns"
          :data="filtered"
          :loading="loading"
          :bordered="false"
          :single-line="true"
          :row-key="(r: ClientDto) => r.id"
          :pagination="pagination"
          :scroll-x="1260"
        >
          <template #empty>
            <n-empty
              class="clients-state"
              :description="search.trim() ? '没有找到匹配的客户' : '还没有客户资料'"
            >
              <template #extra>
                <n-button v-if="search.trim()" @click="search = ''">清除搜索</n-button>
                <n-button v-else type="primary" @click="openCreate">新增第一位客户</n-button>
              </template>
            </n-empty>
          </template>
        </n-data-table>
      </section>
    </div>

    <ClientFormModal
      v-model:show="modalOpen"
      :editing="Boolean(editing)"
      :saving="saving"
      :form="form"
      @save="saveClient"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from 'vue'
import { NButton, NSpace, useDialog, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { api } from '../api/client'
import type { ClientDto, ClientInput } from '../api/types'
import ClientFormModal from '../components/clients/ClientFormModal.vue'
import ClientsToolbar from '../components/clients/ClientsToolbar.vue'
import { useAuthStore } from '../stores/auth'

const message = useMessage()
const dialog = useDialog()
const auth = useAuthStore()

const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const clients = ref<ClientDto[]>([])
const search = ref('')

// 客户端分页（复刻旧版：加载全部、本地筛选 + 分页，页大小 10/20/50/100/200）
const page = ref(1)
const pageSize = ref(20)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return clients.value
  return clients.value.filter((c) =>
    [c.name, c.contact, c.phone, c.address].some((v) =>
      (v || '').toLowerCase().includes(q),
    ),
  )
})

watch(search, () => {
  page.value = 1
})

const pagination = computed(() => ({
  page: page.value,
  pageSize: pageSize.value,
  itemCount: filtered.value.length,
  pageSizes: [10, 20, 50, 100, 200],
  showSizePicker: true,
  prefix: ({ itemCount }: { itemCount: number }) => `共 ${itemCount} 条`,
  onUpdatePage: (p: number) => {
    page.value = p
  },
  onUpdatePageSize: (s: number) => {
    pageSize.value = s
    page.value = 1
  },
}))

function displayValue(value: string) {
  return value || '—'
}

const columns: DataTableColumns<ClientDto> = [
  {
    title: '编号',
    key: 'code',
    width: 86,
    render: (row) => h('span', { class: 'client-code' }, displayValue(row.code)),
  },
  {
    title: '客户',
    key: 'name',
    minWidth: 148,
    render: (row) => h('strong', { class: 'client-name' }, displayValue(row.name)),
  },
  { title: '品牌', key: 'brand', width: 100, render: (row) => displayValue(row.brand) },
  { title: '联系人', key: 'contact', width: 100, render: (row) => displayValue(row.contact) },
  { title: '电话', key: 'phone', width: 126, render: (row) => displayValue(row.phone) },
  {
    title: '送货电话',
    key: 'delivery_phone',
    width: 126,
    render: (row) => displayValue(row.delivery_phone),
  },
  {
    title: '地址',
    key: 'address',
    minWidth: 190,
    ellipsis: { tooltip: true },
    render: (row) => displayValue(row.address),
  },
  { title: '物流商', key: 'logistics', width: 112, render: (row) => displayValue(row.logistics) },
  {
    title: '物流电话',
    key: 'logistics_phone',
    width: 126,
    render: (row) => displayValue(row.logistics_phone),
  },
  {
    title: '操作',
    key: 'actions',
    width: 220,
    fixed: 'right',
    render: (row) =>
      h(NSpace, { size: 4, wrap: false, class: 'client-row-actions' }, {
        default: () => [
          h(
            NButton,
            { size: 'small', type: 'primary', secondary: true, onClick: () => openEdit(row) },
            { default: () => '编辑' },
          ),
          h(
            NButton,
            { size: 'small', quaternary: true, onClick: () => copyTerminalLink(row) },
            { default: () => '终端链接' },
          ),
          h(
            NButton,
            { size: 'small', type: 'error', quaternary: true, onClick: () => removeClient(row) },
            { default: () => '删除' },
          ),
        ],
      }),
  },
]

const modalOpen = ref(false)
const editing = ref<ClientDto | null>(null)
const form = reactive<Required<ClientInput>>({
  name: '',
  brand: '',
  contact: '',
  phone: '',
  delivery_phone: '',
  address: '',
  logistics: '',
  logistics_phone: '',
})

function resetForm() {
  form.name = ''
  form.brand = ''
  form.contact = ''
  form.phone = ''
  form.delivery_phone = ''
  form.address = ''
  form.logistics = ''
  form.logistics_phone = ''
}

function openCreate() {
  editing.value = null
  resetForm()
  modalOpen.value = true
}

function openEdit(row: ClientDto) {
  editing.value = row
  form.name = row.name
  form.brand = row.brand
  form.contact = row.contact
  form.phone = row.phone
  form.delivery_phone = row.delivery_phone
  form.address = row.address
  form.logistics = row.logistics
  form.logistics_phone = row.logistics_phone
  modalOpen.value = true
}

async function saveClient() {
  if (!form.name.trim()) {
    message.warning('请输入客户名称')
    return
  }
  saving.value = true
  try {
    const payload: ClientInput = { ...form, name: form.name.trim() }
    if (editing.value) {
      await api.updateClient(editing.value.id, payload)
      message.success('更新成功')
    } else {
      await api.createClient(payload)
      message.success('新增成功')
    }
    modalOpen.value = false
    await loadClients()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function removeClient(row: ClientDto) {
  dialog.warning({
    title: '删除警告',
    content: `确定删除客户「${row.name}」吗？删除后不可恢复！`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.deleteClient(row.id)
        message.success('删除成功')
        await loadClients()
      } catch (e) {
        message.error(e instanceof Error ? e.message : '删除失败')
      }
    },
  })
}

// 终端链接：复刻旧版 token 编码 {tenant+1000}af{7*编号+1987}wy{时间戳}。
// 终端下单页尚未实现，路由为占位（后续对接 TerminalOrders）。
async function copyTerminalLink(row: ClientDto) {
  const tenantId = auth.tenant?.id ?? 0
  const u = tenantId + 1000
  const s = 7 * Number(row.code || 0) + 1987
  const token = `${u}af${s}wy${Date.now() + 888}`
  const link = `${location.origin}/#/terminal-orders?client=${encodeURIComponent(row.code)}&token=${token}`
  try {
    await navigator.clipboard.writeText(link)
    message.success('已复制 终端链接 到剪贴板')
  } catch {
    message.error('复制失败')
  }
}

async function loadClients() {
  loading.value = true
  loadError.value = ''
  try {
    clients.value = await api.listClients()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '无法连接客户资料服务'
    message.error(e instanceof Error ? e.message : '加载客户信息失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadClients)
</script>

<style scoped>
.clients-page {
  position: relative;
  min-height: calc(100vh - var(--app-header-h));
  overflow: hidden;
  padding: var(--sd-page-padding);
  color: var(--sd-color-text);
  background: var(--sd-color-bg-page);
  font-family: var(--sd-font-sans);
}

.clients-page::before {
  position: absolute;
  z-index: 0;
  top: -180px;
  right: -120px;
  width: 420px;
  height: 420px;
  border-radius: 50%;
  background: var(--sd-material-page-orb-action);
  content: '';
  filter: blur(var(--sd-glass-blur-sm));
  pointer-events: none;
}

.clients-layout {
  position: relative;
  z-index: 1;
  width: min(100%, var(--sd-content-max-width));
  margin: 0 auto;
}

.clients-layout > * {
  animation: clients-enter var(--sd-duration-enter) var(--sd-ease-enter) both;
}

.clients-table-panel {
  overflow: hidden;
  margin-top: var(--sd-page-gap);
  border: var(--sd-border-width) solid var(--sd-color-border);
  border-radius: var(--sd-radius-card);
  background: var(--sd-color-bg-surface);
  box-shadow: var(--sd-shadow-sm);
  animation-delay: var(--sd-duration-fast);
}

.clients-table-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sd-space-4);
  padding: var(--sd-space-4) var(--sd-space-5);
  border-bottom: var(--sd-border-width) solid var(--sd-color-divider);
}

.clients-table-panel__header h2,
.clients-table-panel__header p {
  margin: 0;
}

.clients-table-panel__header h2 {
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-lg);
  font-weight: var(--sd-font-weight-strong);
}

.clients-table-panel__header p {
  margin-top: var(--sd-space-1);
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-xs);
}

.clients-table-panel__status {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: var(--sd-space-2);
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-xs);
  font-weight: var(--sd-font-weight-medium);
}

.clients-table-panel__status > span {
  width: var(--sd-space-2);
  height: var(--sd-space-2);
  border-radius: 50%;
  background: var(--sd-color-success);
  box-shadow: var(--sd-shadow-status-soft);
}

.clients-table-panel__status--error {
  color: var(--sd-color-danger);
}

.clients-table-panel__status--error > span {
  background: var(--sd-color-danger);
  box-shadow: none;
}

.clients-table-panel__alert {
  margin: var(--sd-space-4) var(--sd-space-5) 0;
}

.clients-table {
  --n-th-color: var(--sd-color-bg-subtle) !important;
  --n-td-color: var(--sd-color-bg-surface) !important;
  --n-td-color-hover: var(--sd-color-bg-hover) !important;
  --n-border-color: var(--sd-color-divider) !important;
}

.clients-table :deep(.n-data-table-th) {
  height: var(--sd-control-height-large);
  padding: var(--sd-space-2) var(--sd-space-3);
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-xs);
  font-weight: var(--sd-font-weight-strong);
  letter-spacing: 0.01em;
}

.clients-table :deep(.n-data-table-td) {
  height: var(--sd-control-height-huge);
  padding: var(--sd-space-2) var(--sd-space-3);
  color: var(--sd-color-text);
  font-size: var(--sd-font-size-sm);
}

.clients-table :deep(.n-data-table-tr) {
  transition: background-color var(--sd-duration-fast) var(--sd-ease-standard);
}

.clients-table :deep(.n-data-table__pagination) {
  margin: 0;
  padding: var(--sd-space-4) var(--sd-space-5);
  border-top: var(--sd-border-width) solid var(--sd-color-divider);
}

.clients-table :deep(.client-code) {
  color: var(--sd-color-text-muted);
  font-family: var(--sd-font-data);
  font-size: var(--sd-font-size-xs);
  font-variant-numeric: tabular-nums;
}

.clients-table :deep(.client-name) {
  color: var(--sd-color-text-strong);
  font-weight: var(--sd-font-weight-strong);
}

.clients-table :deep(.client-row-actions) {
  justify-content: flex-end;
}

.clients-state {
  padding: var(--sd-space-12) var(--sd-space-5);
}

@keyframes clients-enter {
  from {
    opacity: 0;
    transform: translateY(var(--sd-motion-enter-y));
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 900px) {
  .clients-table-panel {
    border-radius: var(--sd-radius-md);
  }

  .clients-table-panel__header {
    padding: var(--sd-space-4);
  }

  .clients-table :deep(.n-data-table__pagination) {
    padding: var(--sd-space-3) var(--sd-space-4);
  }
}

@media (max-width: 640px) {
  .clients-table-panel__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .clients-table-panel__status {
    align-self: flex-start;
  }

  .clients-table :deep(.n-data-table__pagination) {
    overflow-x: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .clients-layout > * {
    animation: none;
  }

  .clients-table :deep(.n-data-table-tr) {
    transition: none;
  }
}
</style>
