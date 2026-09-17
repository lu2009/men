<!--
  收据单2「字体调节」设置弹窗 —— 旧版 `Receipt2PrintManager` 的 `openFontDialog` 那一块
  （`legacy/js/Receipt2.deobfuscated.js` :1102-1112 与模板 :1360-2251）。

  逆向依据：`docs/receipt2-recon/04-font-dialog-edit.md` §1.1–§1.3、`docs/2026-09-17-receipt2-analysis.md` §3/§6。

  **核心模式：草稿 / 生效 成对**（旧版的 `f`/`p`/`z`/`c` 四个草稿 ref）。
  打开弹窗时把「已生效」的值拷进草稿，只有「保存」才写回 + 落盘 + 刷新预览；
  「取消」直接丢草稿 —— 生效值全程没被碰过，所以不需要任何回滚逻辑。

  **有意省略的两块**（都是旧版的 Electron 专属，浏览器路径本来就不走）：
  · 「打印机设置」分组（旧版 `W = !!window.electronAPI` 为真才渲染，:2252-2397）—— 整块不渲染。
  · 「打印份数」（旧版 `p.copies`，:2370-2397）—— 它只喂给 Electron 静默打印，
    浏览器打印链路**完全不读**（:1312）。草稿里仍带着 `copies` 原值透传，只是不给 UI 改。
-->
<template>
  <n-modal
    v-model:show="show"
    preset="card"
    title="收据单2 设置"
    style="width: 460px"
    display-directive="show"
  >
    <!--
      `display-directive="show"` 对应旧版的 `destroy-on-close:false`（:1368）——
      关窗不销毁内容。Naive 的 `n-modal` 默认是 `"if"`。
      （其实两种都行：草稿在每次打开时都会从生效值重新同步，销毁也不会丢状态。）
    -->
    <n-form label-placement="left" label-width="110">
      <!-- ───────────────── 品牌区（:1414-1464） ───────────────── -->
      <n-form-item label="自定义品牌名">
        <n-switch v-model:value="c.enabled" />
      </n-form-item>
      <!-- 旧版这里是 `c.enabled ? <el-form-item> : 注释节点` —— 开关关掉时整行不渲染（不是禁用），照抄 -->
      <n-form-item v-if="c.enabled" label="品牌名称">
        <n-input
          v-model:value="c.name"
          placeholder="请输入品牌名"
          maxlength="40"
          show-count
          style="width: 200px"
        />
      </n-form-item>

      <!--
        ───────────────── 字号区（:1465-1615，6 项顺序按 FONT_UI_ORDER） ─────────────────
        旧版每行只有**一个 `el-input-number`**（min/max/step 见 `FONT_RANGES`），
        全文件 `el-slider` 出现次数为 0、13 个 `resolveComponent` 里也没有它。
        所以这里只做数字输入，**没有滑块**。
      -->
      <n-form-item v-for="key in FONT_UI_ORDER" :key="key" :label="FONT_RANGES[key].label">
        <!-- Element Plus 的 `el-input-number` 默认宽 150px，Naive 默认撑满一行 —— 钉住宽度对齐旧版观感 -->
        <n-input-number
          :value="f[key]"
          :min="FONT_RANGES[key].min"
          :max="FONT_RANGES[key].max"
          :step="1"
          style="width: 150px"
          @update:value="(v: number | null) => setFont(key, v)"
        />
      </n-form-item>

      <!-- ───────────────── 纸张设置（:1616-1874） ───────────────── -->
      <n-divider title-placement="left">纸张设置</n-divider>
      <n-form-item label="宽度 (mm)">
        <n-input-number
          :value="p.widthMm"
          :min="50"
          :max="500"
          :step="1"
          style="width: 150px"
          @update:value="(v: number | null) => setPaperNumber('widthMm', v)"
        />
      </n-form-item>
      <n-form-item label="高度 (mm)">
        <n-input-number
          :value="p.heightMm"
          :min="50"
          :max="500"
          :step="1"
          style="width: 150px"
          @update:value="(v: number | null) => setPaperNumber('heightMm', v)"
        />
      </n-form-item>
      <n-form-item label="方向">
        <n-select v-model:value="p.orientation" :options="ORIENTATION_OPTIONS" style="width: 200px" />
      </n-form-item>
      <n-form-item label="常用尺寸">
        <!--
          8 个预设按钮，文案与写入值全部来自 `PAPER_PRESETS`（旧版 `d` :25-50）。
          旧版这些按钮**没有选中态高亮**，这里照抄不做（`findPaperPresetKey` 能做高亮，
          但那是新增功能，不在复刻范围内）。
        -->
        <div class="preset-row">
          <n-button
            v-for="preset in PAPER_PRESETS"
            :key="preset.key"
            size="small"
            @click="applyPaperPreset(preset.key)"
          >
            {{ preset.label }}
          </n-button>
        </div>
      </n-form-item>

      <!-- ───────────────── 头部元素（:1875-2097） ───────────────── -->
      <n-divider title-placement="left">头部元素</n-divider>
      <div class="header-list">
        <div v-for="row in HEADER_ROWS" :key="row.showKey" class="header-row">
          <!--
            旧版给 `el-switch` 传的是 `style="width:80px"`：Element Plus 的开关是
            `display:inline-flex` 的根 + 自然宽度的轨道（`.el-switch__core{min-width:40px}`），
            所以这句的实际效果是**开关这一格占 80px 宽、轨道仍靠左自然宽**，好让三行的单选组左边缘对齐。
            Naive 的 `n-switch` 样式改不动，改用等宽的占位容器还原同一格宽。
          -->
          <span class="header-switch">
            <n-switch v-model:value="z[row.showKey]" />
          </span>
          <n-radio-group v-model:value="z[row.posKey]" size="small" :disabled="!z[row.showKey]">
            <n-radio-button value="left">左侧</n-radio-button>
            <n-radio-button value="right">右侧</n-radio-button>
          </n-radio-group>
        </div>
      </div>

      <!-- ───────────────── 信息栏（拖动排序）（:2098-2198） ───────────────── -->
      <n-divider title-placement="left">信息栏（拖动排序）</n-divider>
      <div class="meta-list">
        <div v-for="(item, i) in z.metaOrder" :key="item" class="meta-row">
          <!--
            旧版的绑定是**动态算出来的**：`z["show" + item[0].toUpperCase() + item.slice(1)]`，
            即 showClient / showTel / showAddress / showProductionDays。这里照抄同一套算法。
            旧版这行还挂着 `style="margin-right:0"`，是抵消 Element Plus `.el-checkbox`
            默认 30px 右边距用的；Naive 的 checkbox 无默认右边距，无需等价处理。
          -->
          <n-checkbox v-model:checked="z[metaShowKey(item)]" />
          <span class="meta-label">{{ META_LABELS[item] }}</span>
          <!-- 旧版是**两个圆形小按钮**（上移/下移），不是拖拽组件 —— 照抄用按钮 -->
          <n-button size="small" circle :disabled="i === 0" @click="moveMeta(i, -1)">
            <template #icon>
              <svg viewBox="0 0 1024 1024" width="1em" height="1em" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="m488.832 344.32-339.84 356.672a32 32 0 0 0 0 44.16l.384.384a29.44 29.44 0 0 0 42.688 0l320-335.872 319.872 335.872a29.44 29.44 0 0 0 42.688 0l.384-.384a32 32 0 0 0 0-44.16L535.168 344.32a32 32 0 0 0-46.336 0"
                />
              </svg>
            </template>
          </n-button>
          <n-button
            size="small"
            circle
            :disabled="i === z.metaOrder.length - 1"
            @click="moveMeta(i, 1)"
          >
            <template #icon>
              <svg viewBox="0 0 1024 1024" width="1em" height="1em" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M831.872 340.864 512 652.672 192.128 340.864a30.592 30.592 0 0 0-42.752 0 29.12 29.12 0 0 0 0 41.6L489.664 714.24a32 32 0 0 0 44.672 0l340.288-331.712a29.12 29.12 0 0 0 0-41.728 30.592 30.592 0 0 0-42.752 0z"
                />
              </svg>
            </template>
          </n-button>
        </div>
      </div>

      <!-- ───────────────── 底部元素（:2199-2251） ───────────────── -->
      <n-divider title-placement="left">底部元素</n-divider>
      <div class="bottom-row">
        <n-checkbox v-model:checked="z.showAmounts">金额</n-checkbox>
        <n-checkbox v-model:checked="z.showDeclaration">说明</n-checkbox>
      </div>
    </n-form>

    <!-- 三个底部按钮：顺序与语义照旧版（:1372-1407） -->
    <template #footer>
      <div class="dialog-footer">
        <n-button @click="resetDraft">重置默认</n-button>
        <n-button @click="cancel">取消</n-button>
        <n-button type="primary" @click="save">保存</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  NButton,
  NCheckbox,
  NDivider,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSwitch,
} from 'naive-ui'
import {
  DEFAULT_BRAND,
  DEFAULT_FONT_SETTINGS,
  DEFAULT_PAPER,
  DEFAULT_VISIBILITY,
  FONT_RANGES,
  FONT_UI_ORDER,
  META_LABELS,
  PAPER_PRESETS,
} from '../utils/receipt2/defaults'
import { saveDialogSettings } from '../utils/receipt2/storage'
import type {
  BrandSettings,
  FontSettings,
  MetaKey,
  PaperPresetKey,
  PaperSettings,
  VisibilitySettings,
} from '../utils/receipt2/types'

const props = defineProps<{
  show: boolean
  /** 已生效的 4 份设置（父组件从 `loadAllReceipt2Settings()` 得来），弹窗只读不写。 */
  fonts: FontSettings
  paper: PaperSettings
  visibility: VisibilitySettings
  brand: BrandSettings
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'saved'): void
}>()

const show = computed({
  get: () => props.show,
  set: (v: boolean) => emit('update:show', v),
})

// ---------------------------------------------------------------------------
// 草稿（旧版的 `f` / `p` / `z` / `c` 四个 ref）
// ---------------------------------------------------------------------------

/** 字号草稿 ← 生效值。 */
const f = ref<FontSettings>({ ...props.fonts })
/** 纸张草稿 ← 生效值。`copies` 原样透传，UI 不给改（见文件头说明）。 */
const p = ref<PaperSettings>({ ...props.paper })
/** 显隐草稿 ← 生效值。`metaOrder` 必须浅拷贝数组，断掉与生效值的引用共享。 */
const z = ref<VisibilitySettings>({ ...props.visibility, metaOrder: [...props.visibility.metaOrder] })
/** 品牌草稿 ← 生效值。 */
const c = ref<BrandSettings>({ ...props.brand })

/**
 * 旧版 `openFontDialog`（:1102-1112）：**只做一件事** —— 把草稿从生效值重新同步一遍。
 * 生效值 → 草稿是单向的，所以「取消」天然等价于回滚。
 */
function syncDraftFromProps(): void {
  f.value = { ...props.fonts }
  p.value = { ...props.paper }
  z.value = { ...props.visibility, metaOrder: [...props.visibility.metaOrder] }
  c.value = { ...props.brand }
}

watch(
  () => props.show,
  (v) => {
    if (v) syncDraftFromProps()
  },
)

// ---------------------------------------------------------------------------
// 头部元素三行（旧版 :1887-2097）
// ---------------------------------------------------------------------------

/** 「编号 / 日期 / 二维码」三行，开关与位置字段一一对应。 */
const HEADER_ROWS: {
  showKey: 'showOrderNo' | 'showDate' | 'showQrcode'
  posKey: 'orderNoPosition' | 'datePosition' | 'qrcodePosition'
}[] = [
  { showKey: 'showOrderNo', posKey: 'orderNoPosition' },
  { showKey: 'showDate', posKey: 'datePosition' },
  { showKey: 'showQrcode', posKey: 'qrcodePosition' },
]

/** 方向下拉：**纵向在前、横向在后**（旧版 :1694-1701 的 el-option 顺序，照抄）。 */
const ORIENTATION_OPTIONS = [
  { label: '纵向', value: 'portrait' },
  { label: '横向', value: 'landscape' },
]

// ---------------------------------------------------------------------------
// 信息栏（旧版 :316-323 / :2112-2198）
// ---------------------------------------------------------------------------

/**
 * 旧版动态算绑定 key：`"show" + item[0].toUpperCase() + item.slice(1)`（:2140-2142）。
 * 这里保留同一套算法（而不是查表），只把结果断言成 4 个字面量之一。
 */
function metaShowKey(k: MetaKey): 'showClient' | 'showTel' | 'showAddress' | 'showProductionDays' {
  return ('show' + k.charAt(0).toUpperCase() + k.slice(1)) as
    | 'showClient'
    | 'showTel'
    | 'showAddress'
    | 'showProductionDays'
}

/**
 * 旧版 `ee(e,t)`（:316-323）：交换 `metaOrder[e]` 与 `metaOrder[e+t]`，**越界直接 return**。
 * 按钮的 disabled 已经挡住了越界，这里再挡一次纯粹是照抄旧版的防御。
 */
function moveMeta(index: number, delta: number): void {
  const order = z.value.metaOrder
  const target = index + delta
  if (target < 0 || target >= order.length) return
  const tmp = order[index]
  order[index] = order[target]
  order[target] = tmp
}

// ---------------------------------------------------------------------------
// 数值输入
// ---------------------------------------------------------------------------

/**
 * 数字框清空时 Naive 与 Element Plus 一样 emit `null`。
 *
 * ⚠️ **照抄旧版**：`null` 原样留在草稿里，直到「保存」时才由 `sanitizeFonts`/`sanitizePaper`
 * 走 `clamp` —— 而 `clamp(null,…)` 因 `Number(null)===0` 会被钳到 **min**（不是默认值）。
 * 所以「清空输入框 → 保存 → 值掉到最小值」是旧版的原样行为，这里不"顺手修好"。
 * 详见 `utils/receipt2/sanitize.ts` 的 `clamp` 注释与逆向报告 §9.1。
 */
function setFont(key: keyof FontSettings, v: number | null): void {
  f.value[key] = v as number
}

/** 同上，纸张的宽/高。 */
function setPaperNumber(key: 'widthMm' | 'heightMm', v: number | null): void {
  p.value[key] = v as number
}

// ---------------------------------------------------------------------------
// 常用尺寸预设（旧版 `V(key)` :51-57）
// ---------------------------------------------------------------------------

/** 只写 `widthMm/heightMm/orientation` 三个字段，**不动 `copies`**。 */
function applyPaperPreset(key: PaperPresetKey): void {
  const preset = PAPER_PRESETS.find((x) => x.key === key)
  if (!preset) return
  p.value.widthMm = preset.settings.widthMm
  p.value.heightMm = preset.settings.heightMm
  p.value.orientation = preset.settings.orientation
}

// ---------------------------------------------------------------------------
// 三个底部按钮（旧版 :1372-1407 / §1.3）
// ---------------------------------------------------------------------------

/**
 * 「重置默认」（旧版 `fe` :810-816）：**只重置草稿** —— 不写盘、不关窗、不刷新预览。
 * `metaOrder` 同样要浅拷贝（`DEFAULT_VISIBILITY.metaOrder` 是共享常量，不能就地改）。
 */
function resetDraft(): void {
  f.value = { ...DEFAULT_FONT_SETTINGS }
  p.value = { ...DEFAULT_PAPER }
  z.value = { ...DEFAULT_VISIBILITY, metaOrder: [...DEFAULT_VISIBILITY.metaOrder] }
  c.value = { ...DEFAULT_BRAND }
}

/** 「取消」：只关窗。生效值从未被改过，所以丢草稿就够了。 */
function cancel(): void {
  show.value = false
}

/**
 * 「保存」（旧版 `he` :817-850）：钳位 → 写盘（一次写 4 个键）→ 关窗。
 * 旧版还会把清洗后的值回填草稿，这里照抄（回填草稿而非 props，生效值由父组件 `@saved` 后重读）。
 * `trim()` 品牌名、`metaOrder` 归一化都发生在 `saveDialogSettings` 内部。
 */
function save(): void {
  const saved = saveDialogSettings({
    fontSettings: f.value,
    printSettings: p.value,
    visibilitySettings: z.value,
    brandSettings: c.value,
  })
  f.value = { ...saved.fontSettings }
  p.value = { ...saved.printSettings }
  z.value = { ...saved.visibilitySettings, metaOrder: [...saved.visibilitySettings.metaOrder] }
  c.value = { ...saved.brandSettings }
  show.value = false
  emit('saved')
}
</script>

<style scoped>
/*
  以下容器样式逐条取自旧版模板里的内联 style 常量（原始 bundle 里是 `$o`/`Xo`/`Qo`/`Ro`/`Fo`/`Zo`/`ea`/`ta`）：
  · 常用尺寸按钮行 `Zo`   : display flex / flex-wrap wrap / gap 4px
  · 头部元素容器   `Xo`   : display flex / flex-direction column / gap 6px / padding 0 12px / margin-bottom 8px
  · 头部元素单行   `Qo Ro Fo`: display flex / align-items center / gap 8px
  · 信息栏容器     `$o`   : display flex / flex-direction column / gap 4px / padding 0 12px / margin-bottom 8px
  · 信息栏单行     (内联)  : display flex / align-items center / gap 6px / padding 4px 8px / background #f5f7fa / border-radius 4px
  · 信息栏标签     `ea`   : width 70px / font-size 13px
  · 底部元素容器   `ta`   : display flex / flex-wrap wrap / gap 8px 16px / padding 0 12px / margin-bottom 8px
*/
.preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.header-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 12px;
  margin-bottom: 8px;
}
.header-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.header-switch {
  width: 80px;
  flex-shrink: 0;
  display: inline-flex;
}
.meta-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 12px;
  margin-bottom: 8px;
}
.meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: #f5f7fa;
  border-radius: 4px;
}
.meta-label {
  width: 70px;
  font-size: 13px;
}
.bottom-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 0 12px;
  margin-bottom: 8px;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
