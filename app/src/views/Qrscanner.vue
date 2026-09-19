<template>
  <!--
    扫码生产（旧版 `/Qrscanner`）—— 本版**只做「设置工序」这一块**。

    逆向：`docs/2026-09-19-qrscanner-analysis.md`（重点 §4「设置工序」弹窗）。

    旧版整页是**车间扫码工的手机端作业页**：工具有 7 颗按钮、4 个弹窗，
    「设置工序」只是其中一颗（`el-button type="info"`）。我们**只要它** ——
    因为它是**工序名的唯一配置入口**，而 `Progress.vue` 的「更新进度」下拉依赖它
    （没配名字，那个下拉就是空的，见 `Progress.vue` 文件头「用之前得先有工序名」）。

    ## ⏳ 还没做（旧版有，本版不做）

    1. **扫码录单 / 停止扫码** —— 摄像头 + ZXing `BrowserMultiFormatReader` 连续扫码。
       旧版全文**没有 `keydown`**，即**不支持扫码枪键盘楔**，只走摄像头。
    2. **手动录单 / 手动查单** 弹窗（拼 `单号-YY/MM/DD`，只本地入列、不调接口）。
    3. **扫码查单**（`getScanQRcode` → 展开统计面板）。
    4. **扫码统计看板**：门数/扇数/面积三个 KPI + 「按工序统计」+ 26 列订单详情 + 导出 CSV。
    5. **标签云打印**（`getLabelData` + `transitPrintSingle`；二维码内容 = **单号**）。
    6. **扫码账号管理**弹窗（`AddScanner` / `DeleteScanner`）。
    7. **两块死代码面板**（「🔧 调试信息」「⚙️ QR码识别高级设置」）—— 旧版里是
       `ref(false)` 且**全文无任何赋值**，永不可见 ⇒ **不做**。
    8. 旧版弹窗底部的「**一键重置颜色**」—— 本版没做。

    权限：旧版这颗按钮要 `userinfo.defaulted === 1`（车间/默认密码账号），函数内部还再判一次。
    新版没有 `defaulted` 概念 ⇒ 用**登录态**代替（本页整页要登录才能进）。

    ## 🔀 三处**有意偏离**旧版（照抄会出错）

    1. **不排掉「工序10」。** 旧版弹窗的槽列表是
       `Object.keys(yl).filter(k => k !== "工序10")`（只渲染 14 行）——
       那是对 Progress 侧「`回款` → `工序10`」硬编码的补偿。新版两处特判一起去掉
       （见 `backend/migrations/0021_progress.sql` 头注）⇒ 这里 **15 槽一视同仁**。
    2. **颜色存库，不写 localStorage。** 旧版把颜色写进全局键 `procedure_name_color_map`，
       **键是工序名** ⇒ 改名即丢色，而且不分租户（换账号读到上个租户的色）。
       新版颜色落在 `procedures` 表上、**键是 slot**。见分析文档 §8.3-2。
       ⚠️ 顺带：旧版把 `#FFFFFF` 当「没配」的兜底值，新版库里**空串才是「没配」**，
       所以本页**不预填白色**，见 `EditableSlot` 的注释。
    3. **不写 `procedure_name_order_list`。** 那个键的语义是「颜色判定的优先级顺序」
       （Progress 侧**从后往前**找第一个命中的工序名），是旧版 localStorage 方案的下游产物；
       颜色落库之后它没有存在意义。
  -->
  <div class="page">
    <div class="toolbar">
      <span class="title">设置工序</span>
      <span class="grow-spacer" />
      <n-button size="small" :loading="loading" @click="load">刷新</n-button>
      <n-button type="primary" :loading="saving" :disabled="!loaded" @click="save">保存</n-button>
    </div>

    <div class="hint">
      工序名留空 = 这个槽不参与生产进度（Progress 的「更新进度」下拉只列配过名字的槽）。
      颜色按槽存，改工序名不会丢颜色。
    </div>

    <!-- 读不到清单时**不给存** —— 屏幕上一片空，一点保存就等于把 15 个槽全清空。 -->
    <div v-if="!loaded && !loading" class="warn">
      工序清单读取失败，暂时不能保存（现在保存会清空全部工序名）。请先点「刷新」。
    </div>

    <div class="proc-list">
      <div v-for="s in slots" :key="s.slot" class="proc-row">
        <span class="proc-slot">{{ s.slot }}</span>
        <div class="proc-name">
          <n-input v-model:value="s.name" placeholder="请输入工序名称" clearable />
        </div>
        <n-color-picker v-model:value="s.color" :show-alpha="true" :swatches="SWATCHES" />
      </div>
    </div>

    <div class="toolbar footer">
      <n-button type="primary" :loading="saving" :disabled="!loaded" @click="save">保存</n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { NButton, NColorPicker, NInput, useMessage } from 'naive-ui'
import { api } from '../api/client'
import type { ProcedureSlotDto } from '../api/types'

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
 * 那么「只是来改个工序名、顺手点一下保存」就会把 15 个槽全刷成「显式白色」。
 */
interface EditableSlot {
  slot: string
  name: string
  color: string | null
}

const slots = ref<EditableSlot[]>([])
/** 是否**成功读到过**清单 —— 没读到就不给保存（见模板里的 .warn）。 */
const loaded = ref(false)
const loading = ref(false)
const saving = ref(false)

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

async function load() {
  loading.value = true
  try {
    const r = await api.listProcedures()
    slots.value = normalize(r?.slots)
    loaded.value = true
  } catch (e) {
    loaded.value = false
    message.error(e instanceof Error ? e.message : '读取工序清单失败')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!loaded.value) return
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
    // 回读一次：确认真的落库了（服务端会把空名槽也存下来，回读能看出屏幕与库是否一致）。
    await load()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存工序设置失败')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page {
  /* 减掉全局标题栏的高度（`App.vue` 的 `--app-header-h`），与 Progress 一致。 */
  min-height: calc(100vh - var(--app-header-h));
  background: #fff;
  padding: 12px 16px 24px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.toolbar.footer {
  justify-content: center;
  margin-top: 16px;
  margin-bottom: 0;
}
.title {
  font-size: 15px;
  font-weight: 700;
}
.grow-spacer {
  flex: 1;
}
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
/* 15 行 = 一个纵向列表；每行「槽号 + 名称 + 颜色」，窄屏自动换行（规范 §2）。 */
.proc-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  /* 旧版弹窗里这块是 `max-height:60vh; overflow-y:auto`；现在是整页，不必再套滚动区。 */
}
.proc-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f2f3f5;
}
.proc-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.proc-slot {
  flex: none;
  width: 56px;
  font-size: 13px;
  color: #606266;
}
.proc-name {
  flex: 1 1 220px;
  min-width: 0;
}
</style>
