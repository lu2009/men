<template>
  <div class="page">
    <n-card :bordered="false">
      <template #header>
        <div class="header">
          <span class="title">客户信息</span>
          <div class="actions">
            <n-input
              v-model:value="search"
              placeholder="搜索客户、联系人、电话、地址"
              clearable
              style="width: 240px"
            />
            <n-button @click="loadClients">刷新</n-button>
            <n-button type="primary" @click="openCreate">新增客户</n-button>
          </div>
        </div>
      </template>

      <n-data-table
        :columns="columns"
        :data="filtered"
        :loading="loading"
        :bordered="true"
        :row-key="(r: ClientDto) => r.id"
        :pagination="pagination"
        :scroll-x="1200"
      />
    </n-card>

    <!-- 新增 / 编辑客户 -->
    <n-modal v-model:show="modalOpen">
      <n-card
        style="width: 520px"
        :title="editing ? '编辑客户' : '新增客户'"
        :bordered="false"
        role="dialog"
      >
        <n-form label-placement="left" label-width="84">
          <n-form-item label="客户名称" required>
            <n-input v-model:value="form.name" placeholder="请输入客户名称" />
          </n-form-item>
          <n-form-item label="品牌">
            <n-input v-model:value="form.brand" placeholder="请输入品牌" />
          </n-form-item>
          <n-form-item label="联系人">
            <n-input v-model:value="form.contact" placeholder="请输入联系人" />
          </n-form-item>
          <n-form-item label="电话">
            <n-input v-model:value="form.phone" placeholder="请输入电话" />
          </n-form-item>
          <n-form-item label="送货电话">
            <n-input v-model:value="form.delivery_phone" placeholder="请输入送货电话" />
          </n-form-item>
          <n-form-item label="地址">
            <n-input
              v-model:value="form.address"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 3 }"
              placeholder="请输入地址"
            />
          </n-form-item>
          <n-form-item label="物流商">
            <n-input v-model:value="form.logistics" placeholder="请输入物流商" />
          </n-form-item>
          <n-form-item label="物流电话">
            <n-input v-model:value="form.logistics_phone" placeholder="请输入物流电话" />
          </n-form-item>
        </n-form>
        <template #footer>
          <div class="footer">
            <n-button @click="modalOpen = false">取消</n-button>
            <n-button type="primary" :loading="saving" @click="saveClient">保存</n-button>
          </div>
        </template>
      </n-card>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from 'vue'
import { NButton, NSpace, useDialog, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { api } from '../api/client'
import type { ClientDto, ClientInput } from '../api/types'
import { useAuthStore } from '../stores/auth'

const message = useMessage()
const dialog = useDialog()
const auth = useAuthStore()

const loading = ref(false)
const saving = ref(false)
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
  onUpdatePage: (p: number) => {
    page.value = p
  },
  onUpdatePageSize: (s: number) => {
    pageSize.value = s
    page.value = 1
  },
}))

const columns: DataTableColumns<ClientDto> = [
  { title: '编号', key: 'code', width: 70 },
  { title: '客户', key: 'name', minWidth: 120 },
  { title: '品牌', key: 'brand', width: 90 },
  { title: '联系人', key: 'contact', width: 90 },
  { title: '电话', key: 'phone', width: 120 },
  { title: '送货电话', key: 'delivery_phone', width: 120 },
  { title: '地址', key: 'address', minWidth: 160, ellipsis: true },
  { title: '物流商', key: 'logistics', width: 110 },
  { title: '物流电话', key: 'logistics_phone', width: 120 },
  {
    title: '操作',
    key: 'actions',
    width: 210,
    render: (row) =>
      h(NSpace, { size: 4 }, {
        default: () => [
          h(
            NButton,
            { size: 'small', type: 'primary', onClick: () => openEdit(row) },
            { default: () => '编辑' },
          ),
          h(
            NButton,
            { size: 'small', onClick: () => copyTerminalLink(row) },
            { default: () => '终端链接' },
          ),
          h(
            NButton,
            { size: 'small', type: 'error', onClick: () => removeClient(row) },
            { default: () => '删除' },
          ),
        ],
      }),
  },
]

const modalOpen = ref(false)
const editing = ref<ClientDto | null>(null)
const form = reactive({
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
  try {
    clients.value = await api.listClients()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载客户信息失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadClients)
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 24px;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.title {
  font-size: 16px;
  font-weight: 600;
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
