<template>
  <!--
    明细表的四个页面级弹窗（状态在 `composables/useDetailLineDialogs.ts`）。

    从 `app/src/views/Hui.vue` **整段搬来**（2026-09-19），为的是让 Home 的展开行也能用同一套
    —— 明细表组件（`DetailLinesTable.vue`）的 `hooks` 里这几个回调，两个页面都要有。
    Hui 与 Home 各挂一份本组件即可。

    四个弹窗：新增加价项目 / 修改平方数 / 门图大图预览 / 门图名字（文字传图）。
  -->
  <!-- 新增加价项目（汇算页行内入口；旧版 title/宽 500、label 加价项目/单价/计价方式，:2640-2688） -->
  <n-modal v-model:show="d.addMarkupOpen.value" preset="card" title="新增加价项目" style="width: 500px">
    <div class="vis-col">
      <div class="mgmt-row">
        <span class="mgmt-name">加价项目</span>
        <!-- 旧版这一格不给宽度（撑满），只有单价/计价方式是 30%（:2660/:2668/:2676） -->
        <n-input v-model:value="d.addMarkupForm.name" placeholder="请输入加价项目名称" style="flex: 1" />
      </div>
      <div class="mgmt-row">
        <span class="mgmt-name">单价</span>
        <!-- 原版单价 min 随单位变：元/套 允许负数（`-Infinity`），其余必须 ≥0（:2652） -->
        <n-input-number
          v-model:value="d.addMarkupForm.price"
          :show-button="false"
          :min="d.addMarkupForm.unit === '元/套' ? undefined : 0"
          placeholder="单价"
          style="width: 30%"
        />
      </div>
      <div class="mgmt-row">
        <span class="mgmt-name">计价方式</span>
        <n-select v-model:value="d.addMarkupForm.unit" :options="markupUnitOptions" style="width: 30%" />
      </div>
    </div>
    <template #footer>
      <div class="footer">
        <n-button @click="d.addMarkupOpen.value = false">取消</n-button>
        <!-- 按钮 type 照旧版：单次添加 = primary，同步保存 = success（:2647/:2651） -->
        <n-button type="primary" @click="d.addMarkupOnce()">单次添加</n-button>
        <n-button type="success" @click="d.addMarkupSync()">同步保存</n-button>
      </div>
    </template>
  </n-modal>

  <!-- 修改平方数（平方单元格右键，仿旧版） -->
  <n-modal
    v-model:show="d.squareDialog.value"
    preset="dialog"
    title="修改平方数"
    positive-text="确定"
    negative-text="取消"
    @positive-click="d.confirmSquare()"
    @negative-click="d.squareDialog.value = false"
  >
    <!-- 原版这个弹窗里**只有一个数字输入框**（`:2733-2747`，placeholder「请输入平方数」，回车=确认），
         没有我们原先加的那两行提示。 -->
    <div class="square-dialog">
      <n-input-number
        v-model:value="d.squareInput.value"
        :show-button="false"
        placeholder="请输入平方数"
        style="width: 100%"
      />
    </div>
  </n-modal>

  <!-- 门图大图预览 -->
  <n-modal
    v-model:show="d.previewOpen.value"
    preset="card"
    style="width: 480px"
    :on-after-leave="() => (d.previewImg.value = null)"
  >
    <img v-if="d.previewImg.value" :src="d.previewImg.value" style="width: 100%; object-fit: contain" />
  </n-modal>

  <!-- 文字传图：输入门图名字生成 PNG -->
  <n-modal
    v-model:show="d.textImgOpen.value"
    preset="dialog"
    title="门图名字"
    positive-text="确认"
    negative-text="取消"
    @positive-click="d.confirmTextImg()"
    @negative-click="d.textImgOpen.value = false"
  >
    <n-input
      v-model:value="d.textImgName.value"
      maxlength="24"
      placeholder="最多 24 个字"
      @keydown.enter="d.confirmTextImg()"
    />
  </n-modal>
</template>

<script setup lang="ts">
import { NButton, NInput, NInputNumber, NModal, NSelect } from 'naive-ui'
import { markupUnitOptions } from '../composables/useMarkupCatalog'
import type { DetailLineDialogs } from '../composables/useDetailLineDialogs'

// ⚠️ 传**整个 dialogs 对象**（不是把每个 ref 拆开传）：这些弹窗的开关与数据是一个整体，
//    拆开传既啰嗦又容易漏。模板里写 `d.xxx.value` 是因为它在 setup 里是普通对象、不是 ref。
const props = defineProps<{ d: DetailLineDialogs }>()
const d = props.d
</script>

<style scoped>
/* 四个弹窗用到的样式，从 Hui.vue 搬来（`.vis-col` / `.mgmt-row` / `.mgmt-name` / `.square-dialog` /
   `.footer`）。⚠️ 这些类**页面里也还在用**（加价项目管理、其它弹窗），所以那边**保留原样**，
   这里是为组件内自成一份（scoped 样式不跨组件）。 */
.vis-col .mgmt-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.mgmt-name {
  /* 旧版三个加价项目弹窗都是 el-form `label-width: 100px`（:2655 / :13130 / :13179） */
  width: 100px;
  flex: none;
}
.square-dialog p {
  margin: 4px 0 10px;
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
