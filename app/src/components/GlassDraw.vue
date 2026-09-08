<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton, NFormItem, NInput, NInputNumber, NSelect, NSpace, useMessage } from 'naive-ui'
import { api } from '../api/client'
import type { FormulaImageDto } from '../api/types'

const props = defineProps<{
  formulaId: number | null
  formulaName: string
  formulaType: string
}>()

const emit = defineEmits<{ (e: 'updated'): void }>()
const message = useMessage()

// —— 玻璃几何参数（复刻旧版 Glass_draw）——
const glassW = 220
const glassH = 400
const pad = 10
const notchW = 100 // 凹槽宽
const notchTop = 220 // 凹槽上沿 y（= height - 180）
const notchBottom = 120 // 凹槽下沿 y（= notchTop - 100）

const canvasW = glassW + 2 * pad
const canvasH = glassH + 2 * pad

const holeWidth = ref(70)
const holeHeight = ref(35)
const holeDistance = ref(90)
const lockDirection = ref('')
const remark = ref('')
const lockType = ref('')

const lockOptions = [
  '左锁内开', '右锁内开', '左锁外开', '右锁外开',
  '内左', '内右', '外左', '外右',
  '左固玻', '右固玻', '双开左', '双开右',
].map((v) => ({ label: v, value: v }))

const mirrorDirection = computed(() =>
  lockDirection.value
    .replace('左', 'temp')
    .replace('右', '左')
    .replace('temp', '右'),
)

const remarkLines = computed(() => {
  if (!remark.value) return []
  const out: string[] = []
  let cur = ''
  for (const ch of remark.value) {
    cur += ch
    if (cur.length === 6) {
      out.push(cur)
      cur = ''
    }
  }
  if (cur) out.push(cur)
  return out
})

const leftPath = computed(
  () =>
    `M 0,0 L ${glassW},0 L ${glassW},${glassH} L 0,${glassH} L 0,${notchTop} ` +
    `L ${notchW},${notchTop} L ${notchW},${notchBottom} L 0,${notchBottom} Z`,
)
const rightPath = computed(
  () =>
    `M ${glassW},0 L 0,0 L 0,${glassH} L ${glassW},${glassH} L ${glassW},${notchTop} ` +
    `L ${glassW - notchW},${notchTop} L ${glassW - notchW},${notchBottom} L ${glassW},${notchBottom} Z`,
)

// —— 图片列表 ——
const images = ref<FormulaImageDto[]>([])
const originalSvgRef = ref<SVGSVGElement | null>(null)
const mirroredSvgRef = ref<SVGSVGElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

async function loadImages() {
  if (!props.formulaId) {
    images.value = []
    return
  }
  try {
    images.value = await api.listFormulaImages(props.formulaId)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载图片失败')
  }
}

watch(() => props.formulaId, loadImages, { immediate: true })

function svgElToJpeg(el: SVGElement, w: number, h: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const xml = new XMLSerializer().serializeToString(el)
    const svg = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svg)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('无法获取 Canvas Context'))
        return
      }
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.95))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}

async function generate() {
  if (!lockDirection.value) {
    message.error('请先选择锁向再生成图片')
    return
  }
  if (!props.formulaId) {
    message.error('请先保存公式')
    return
  }
  if (!originalSvgRef.value || !mirroredSvgRef.value) {
    message.error('SVG 元素未找到')
    return
  }
  try {
    const [orig, mirror] = await Promise.all([
      svgElToJpeg(originalSvgRef.value, canvasW, canvasH),
      svgElToJpeg(mirroredSvgRef.value, canvasW, canvasH),
    ])
    await api.addFormulaImage(props.formulaId, {
      direction: lockDirection.value,
      mirrored: false,
      data_url: orig,
    })
    await api.addFormulaImage(props.formulaId, {
      direction: mirrorDirection.value,
      mirrored: true,
      data_url: mirror,
    })
    message.success('挖孔图保存成功')
    await loadImages()
    emit('updated')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '生成失败')
  }
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!props.formulaId) {
    message.error('请先保存公式')
    return
  }
  const formulaId = props.formulaId
  const reader = new FileReader()
  reader.onload = async () => {
    const dataUrl = reader.result as string
    try {
      await api.addFormulaImage(formulaId, {
        direction: lockDirection.value || '上传',
        mirrored: false,
        data_url: dataUrl,
      })
      message.success('图片上传成功')
      await loadImages()
      emit('updated')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '上传失败')
    }
  }
  reader.readAsDataURL(file)
}

function triggerUpload() {
  fileInputRef.value?.click()
}

async function removeImage(img: FormulaImageDto) {
  if (!props.formulaId) return
  try {
    await api.deleteFormulaImage(props.formulaId, img.id)
    message.success('删除成功')
    await loadImages()
    emit('updated')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '删除失败')
  }
}

defineExpose({ refresh: loadImages })
</script>

<template>
  <div class="glass-draw">
    <div class="params">
      <n-form-item label="开孔图锁向">
        <n-select
          v-model:value="lockDirection"
          :options="lockOptions"
          placeholder="请选择锁向"
          style="width: 160px"
        />
      </n-form-item>
      <n-form-item label="孔宽 (标注)">
        <n-input-number v-model:value="holeWidth" :min="0" :max="800" style="width: 130px" />
      </n-form-item>
      <n-form-item label="孔高 (标注)">
        <n-input-number v-model:value="holeHeight" :min="0" style="width: 130px" />
      </n-form-item>
      <n-form-item label="孔距 (标注)">
        <n-input-number v-model:value="holeDistance" :min="0" :max="2000" style="width: 130px" />
      </n-form-item>
    </div>

    <div class="preview-row">
      <div class="svg-card">
        <svg
          ref="originalSvgRef"
          :width="canvasW"
          :height="canvasH"
          :viewBox="`0 0 ${canvasW} ${canvasH}`"
        >
          <g :transform="`translate(${pad}, ${pad})`">
            <path :d="leftPath" fill="white" stroke="black" stroke-width="3" />
            <text
              v-if="remarkLines.length"
              x="110"
              y="36"
              text-anchor="middle"
              font-size="36"
              fill="red"
            >
              <tspan v-for="(ln, i) in remarkLines" :key="i" x="110" :dy="i === 0 ? 0 : 45">
                {{ ln }}
              </tspan>
            </text>
            <text x="50" :y="notchTop + 36" text-anchor="middle" font-size="30" font-weight="bold">
              {{ holeWidth }}
            </text>
            <text
              :transform="`translate(${notchW + 30}, ${(notchBottom + notchTop) / 2})`"
              text-anchor="middle"
              font-size="30"
              font-weight="bold"
            >
              {{ holeHeight }}
            </text>
            <text
              :transform="`translate(36, ${(notchTop + glassH) / 2 + 35})`"
              text-anchor="middle"
              font-size="30"
              font-weight="bold"
            >
              {{ holeDistance }}
            </text>
          </g>
        </svg>
        <div class="caption">{{ lockDirection || '原始' }}</div>
      </div>

      <div class="svg-card">
        <svg
          ref="mirroredSvgRef"
          :width="canvasW"
          :height="canvasH"
          :viewBox="`0 0 ${canvasW} ${canvasH}`"
        >
          <g :transform="`translate(${pad}, ${pad})`">
            <path :d="rightPath" fill="white" stroke="black" stroke-width="3" />
            <text
              v-if="remarkLines.length"
              x="110"
              y="36"
              text-anchor="middle"
              font-size="36"
              fill="red"
            >
              <tspan v-for="(ln, i) in remarkLines" :key="i" x="110" :dy="i === 0 ? 0 : 45">
                {{ ln }}
              </tspan>
            </text>
            <text
              :x="glassW - 50"
              :y="notchTop + 36"
              text-anchor="middle"
              font-size="30"
              font-weight="bold"
            >
              {{ holeWidth }}
            </text>
            <text
              :transform="`translate(${glassW - notchW - 30}, ${(notchBottom + notchTop) / 2})`"
              text-anchor="middle"
              font-size="30"
              font-weight="bold"
            >
              {{ holeHeight }}
            </text>
            <text
              :transform="`translate(${glassW - 45}, ${(notchTop + glassH) / 2 + 35})`"
              text-anchor="middle"
              font-size="30"
              font-weight="bold"
            >
              {{ holeDistance }}
            </text>
          </g>
        </svg>
        <div class="caption">{{ mirrorDirection || '镜像' }}</div>
      </div>
    </div>

    <div class="extra">
      <n-form-item label="图片备注">
        <n-input
          v-model:value="remark"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 4 }"
          placeholder="输入备注信息"
          style="width: 180px"
        />
      </n-form-item>
      <n-form-item label="锁具">
        <n-input v-model:value="lockType" placeholder="输入锁名" style="width: 140px" />
      </n-form-item>
    </div>

    <n-space>
      <n-button type="primary" @click="generate">生成挖孔图</n-button>
      <n-button @click="triggerUpload">上传挖孔图</n-button>
      <input
        ref="fileInputRef"
        type="file"
        accept="image/jpeg,image/png"
        style="display: none"
        @change="onFileChange"
      />
    </n-space>

    <div class="saved">
      <h4>已保存开孔图</h4>
      <div v-if="!images.length" class="empty">暂无开孔图</div>
      <div v-for="img in images" :key="img.id" class="img-item">
        <img :src="img.data_url" alt="开孔图" />
        <span class="img-dir">{{ img.direction }}{{ img.mirrored ? '（镜像）' : '' }}</span>
        <n-button size="tiny" type="error" quaternary @click="removeImage(img)">删除</n-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.glass-draw {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.params,
.extra {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  align-items: flex-start;
}
.preview-row {
  display: flex;
  gap: 20px;
  justify-content: center;
}
.svg-card {
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  padding: 8px;
  text-align: center;
}
.caption {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}
.saved {
  border-top: 1px solid #eee;
  padding-top: 8px;
}
.saved h4 {
  margin: 0 0 8px;
}
.empty {
  color: #999;
  font-size: 13px;
}
.img-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.img-item img {
  width: 60px;
  height: auto;
  border: 1px solid #ddd;
}
.img-dir {
  font-size: 13px;
}
</style>
