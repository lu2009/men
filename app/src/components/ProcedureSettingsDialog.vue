<template>
  <!--
    「设置工序」弹窗 —— 从 `views/Qrscanner.vue` 整页 body 里搬出来的（2026-09-19）。

    逆向：`docs/2026-09-19-qrscanner-analysis.md` §4（重点章节）。

    ## 为什么搬进弹窗

    旧版这页**本来就是个弹窗**（工具条第 6 颗 `el-button type="info"`「设置工序」，
    `el-dialog` 宽 90%、`close-on-click-modal=false`，见分析文档 §2.10 / §4.1）。
    新版本文件先前图省事把它铺成了整页 —— 现在补齐整页其余部分，得还原成旧版那种「弹窗」形态，
    否则整页会被 15 行表单占满、别的功能没地方放。
    **表单本身、初值规则、保存语义一个字节没改**，只是换了容器。
    （分析文档 §8.4 也建议单独成件：它是**别的页面也要用**的配置。）

    ## 权限

    旧版这颗按钮要 `userinfo.defaulted === 1`（车间/默认密码账号），`sa` 函数内部还**再判一次**。
    新版没有 `defaulted` 概念 ⇒ 用**登录态**代替（能进这一页就是已登录，见页面文件头）。

    ## 🔀 三处**有意偏离**旧版（照抄会出错）

    1. **不排掉「工序10」。** 旧版弹窗的槽列表是
       `Object.keys(yl).filter(k => k !== "工序10")`（只渲染 14 行）——
       那是对 Progress 侧「`回款` → `工序10`」硬编码的补偿。新版两处特判一起去掉
       （见 `backend/migrations/0021_progress.sql` 头注）⇒ 这里 **15 槽一视同仁**。
    2. **颜色存库，不写 localStorage。** 旧版把颜色写进全局键 `procedure_name_color_map`，
       **键是工序名** ⇒ 改名即丢色，而且不分租户（换账号读到上个租户的色）。
       新版颜色落在 `procedures` 表上、**键是 slot**。见分析文档 §8.3-2。
       ⚠️ 顺带：旧版把 `#FFFFFF` 当「没配」的兜底值，新版库里**空串才是「没配」**，
       所以这里**不预填白色**，见 `EditableSlot` 的注释。
    3. **不写 `procedure_name_order_list`。** 那个键的语义是「颜色判定的优先级顺序」
       （Progress 侧**从后往前**找第一个命中的工序名），是旧版 localStorage 方案的下游产物；
       颜色落库之后它没有存在意义。

    ## ⏳ 还没做

    旧版弹窗底部的「**一键重置颜色**」（`fl`，把 14 个槽的颜色刷成 `#FFFFFF`）本版没做。
    ⚠️ 而且**不能**照抄：新版里「没配」是**空串**不是白色（迁移 `0022` 头注），
    所以这个按钮将来真要做，语义应当是「**清空**所有槽的颜色」而不是「刷成白」。
  -->
  <n-modal
    v-model:show="visible"
    preset="card"
    title="设置工序"
    style="width: 90%; max-width: 720px"
    :bordered="false"
    :mask-closable="false"
  >
    <div v-if="!loaded" class="warn">
      工序清单读取失败，暂时不能保存（现在保存会清空全部工序名）。请关掉弹窗、刷新页面后重试。
    </div>

    <div class="hint">
      工序名留空 = 这个槽不参与生产进度（「更新进度」的下拉只列配过名字的槽）。
      颜色按槽存，改工序名不会丢颜色。
    </div>

    <div class="procedure-form">
      <div v-for="s in slots" :key="s.slot" class="procedure-setting-row">
        <span class="procedure-slot">{{ s.slot }}</span>
        <div class="procedure-name">
          <n-input v-model:value="s.name" placeholder="请输入工序名称" clearable />
        </div>
        <n-color-picker v-model:value="s.color" :show-alpha="true" :swatches="SWATCHES" />
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <n-button @click="visible = false">取消</n-button>
        <n-button type="primary" :loading="saving" :disabled="!loaded" @click="save">确认</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { NButton, NColorPicker, NInput, NModal, useMessage } from 'naive-ui'
import { api } from '../api/client'
import type { ProcedureSlotDto } from '../api/types'

const props = defineProps<{
  /** 弹窗开关（`v-model:show`）。 */
  show: boolean
  /** 页面已经拉到的工序清单（恒 15 项）—— 弹窗**不自己再拉一次**，见 `watch(props.show)`。 */
  slots: ProcedureSlotDto[]
  /** 页面那次 `GET /v1/procedures` 是否成功。没成功就不给保存。 */
  loaded: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  /** 保存成功 —— 页面据此重拉清单（下拉、看板都要跟着变）。 */
  (e: 'saved'): void
}>()

const message = useMessage()

/** 槽数固定 15（旧服务端 `getProcedures` 恒铺 `工序1..工序15` 十五个键）。 */
const SLOT_COUNT = 15
/**
 * 取色器的 8 个**快捷色块** —— 逐字取自旧版 `vl`（`Qrscanner @25302`）。
 * ⚠️ 只是快捷方式：旧版开了 `show-alpha` 且**自由取色**，值不限于这 8 个。
 */
const SWATCHES = ['#67C23A', '#409EFF', '#E6A23C', '#F56C6C', '#9A66E4', '#13C2C2', '#95A5A6', '#FFFFFF']

/**
 * 屏幕上的可编辑行。
 *
 * `color` 允许 `null`，**`null` 就是「这个槽没配过颜色」**：
 * - `n-color-picker` 的 `v-model:value` 本来就是 `string | null`（清空给 null）；
 * - 库里也用**空串**表示「没配过」，见 `ProcedureSlotDto.color`。
 *
 * ⚠️ **有意不照抄旧版的 `#FFFFFF` 初值**：旧版 `sa` 里 `wl[k] = t4[nm] ? t4[nm] : "#FFFFFF"`
 * 是拿白色当「没配」的兜底。但新版库里「空串」与「显式配成白色」是两回事
 * （迁移 `0022` 头注明写「兜底色由前端自己决定」）—— 若这里统一填 `#FFFFFF`，
 * 那么「只是来改个工序名、顺手点一下确认」就会把 15 个槽全刷成「显式白色」。
 */
interface EditableSlot {
  slot: string
  name: string
  color: string | null
}

const slots = ref<EditableSlot[]>([])
const saving = ref(false)

const visible = ref(props.show)
watch(
  () => props.show,
  (v) => {
    visible.value = v
    // 每次打开都从页面那份**重新铺一遍** —— 上次开了没保存就关掉的改动不该留着。
    if (v) slots.value = normalize(props.slots)
  },
)
watch(visible, (v) => emit('update:show', v))

/**
 * 把接口返回铺成**恒 15 行、按槽号升序**。
 *
 * 服务端本来就恒返回 15 项（`0021` 之后也一样），这里补一遍有两个作用：
 * ① 后端**并行在做**、颜色列可能还没上，缺字段也不能让页面塌掉；
 * ② 顺手丢掉任何非 `工序N` 的野键，别让它进入保存体。
 */
function normalize(raw: ProcedureSlotDto[] | undefined): EditableSlot[] {
  const bySlot = new Map((raw ?? []).map((s) => [s.slot, s]))
  const out: EditableSlot[] = []
  for (let i = 1; i <= SLOT_COUNT; i++) {
    const slot = `工序${i}`
    const hit = bySlot.get(slot)
    // `hit?.color || null`：库里的空串 / 后端还没上这一列时的 undefined，统一成 null（= 没配过）。
    out.push({ slot, name: hit?.name ?? '', color: hit?.color || null })
  }
  return out
}

async function save() {
  if (!props.loaded) return
  saving.value = true
  try {
    await api.saveProcedures(
      slots.value.map((s) => ({
        slot: s.slot,
        name: s.name.trim(),
        // 没配过就照原样发空串回去，**别兜成 #FFFFFF** —— 见 `EditableSlot` 的注释。
        color: (s.color ?? '').trim(),
      })),
    )
    message.success('工序设置保存成功')
    emit('saved')
    visible.value = false
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存工序设置失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.hint {
  margin-bottom: 10px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}
.warn {
  margin-bottom: 10px;
  padding: 6px 10px;
  border: 1px solid #f3d19e;
  border-radius: 4px;
  background: #fdf6ec;
  color: #e6a23c;
  font-size: 12px;
}
/*
 * 旧版 `.procedure-form` 是 `max-height:60vh; overflow-y:auto` —— 15 行在小屏上会顶出视口。
 * naive 的 modal 自带 body 滚动，但这里仍保留一个上限，免得桌面端也铺满整屏。
 */
.procedure-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 60vh;
  overflow-y: auto;
}
/* 旧版 `.procedure-setting-row`：`display:flex; align-items:center; gap:12px`（§4.1）。 */
.procedure-setting-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.procedure-slot {
  flex: none;
  width: 56px;
  font-size: 13px;
  color: #606266;
}
/* 旧版行里 `el-input` 是 `flex:1`。 */
.procedure-name {
  flex: 1 1 220px;
  min-width: 0;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
