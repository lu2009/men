// 摄像头连续扫码 —— 扫码生产页（旧版 `/Qrscanner`）的取流 + 解码那一层。
//
// 逆向：`docs/2026-09-19-qrscanner-analysis.md` §3.2（摄像头）与 §2.7（扫码容器）。
//
// ## ⚠️ 只走**摄像头**，不支持扫码枪
//
// 旧版全文**没有** `keydown` / `keypress` / 任何键盘缓冲（分析文档 §3.2 末尾逐条 grep 过），
// 也就是**不支持扫码枪键盘楔**。新版照旧 ⇒ 这里一条键盘监听都没有，**别自作主张加**。
//
// ## 与旧版逐条对应
//
// | 旧版 | 这里 |
// |---|---|
// | `ol()` 环境自检（四条错误文案） | `cameraEnvironmentError()` |
// | `g()` 取流参数 `{width:{ideal:640},height:{ideal:480},facingMode:"environment"}` | `start()` 里的 `getUserMedia` |
// | video 元素 `autoplay/playsInline/muted/objectFit:cover` | `Qrscanner.vue` 的 `.scanner-video`（模板里，不是 `createElement`） |
// | `canplay` 5 秒超时 → `"Video播放超时"` | `waitCanPlay()` |
// | `DecodeHintType.POSSIBLE_FORMATS=[QR_CODE]` + `TRY_HARDER` | `start()` 里的 `hints` |
// | `BrowserMultiFormatReader.decodeFromVideoDevice(null, video, cb)` | `reader.decodeContinuously(video, cb)` |
//
// ## 🔀 四处**有意偏离**旧版
//
// 1. **不再自己挑 `deviceId`。** 旧版 `enumerateDevices()` 过滤 `videoinput`、找 `label` 含
//    `back`/`rear`/`environment` 的那个换上去 —— 但那个 `deviceId` **后面根本没被引用**，
//    真正取流用的是 `facingMode:"environment"`（分析文档 §9 第 5 条：这段是无效代码）。
//    新版**只保留 `facingMode`**（§8.4 的建议）。
// 2. **不调 `getUserMedia` 两次。** 旧版自己 `g()` 取一次流，紧接着 `decodeFromVideoDevice`
//    内部**又**取一次（那才是真正生效的那次）；第一次纯粹是为了那段 `canplay` 超时检查。
//    新版**自己取一次流**、自己等 `canplay`、再喂给 `decodeContinuously` —— 行为一样，少开一路摄像头。
// 3. **不调用 `reader.reset()`。** `reset()` 会去销毁它以为归自己管的 video 元素
//    （`_destroyVideoElement`）；这里的 `<video>` 是 Vue 模板里的、由我们管，
//    所以停流走「`stopContinuousDecode()` + 自己 `track.stop()`」。
//    收尾仍调 `reader.reset()` 清掉解码用的隐藏 canvas —— 因为 `this.videoElement` 从没被赋值，
//    那条销毁分支会自己 early-return（见 `BrowserCodeReader._destroyVideoElement`）。
// 4. **给「解不到码」的重试加了间隔**（`DECODE_RETRY_MS`）。旧版走 `decodeFromVideoDevice`，
//    那条路的失败重试延时是 `_timeBetweenDecodingAttempts`，而它**默认是 0**
//    （`BrowserCodeReader` 构造函数；`setTimeout(loop, 0)`）。
//    ⇒ 画面里没有二维码时（也就是**绝大多数时间**）会以每秒几百次的频率重画 canvas 再整帧解码，
//    手机上是实打实的烤机 + 掉电。**这是库的默认值，不是旧版有意选的行为** ⇒ 新版给个 200ms。
//    保守的 5 次/秒足够「举起手机就认出来」，CPU 掉两三个数量级。
//
// ⚠️ **`@zxing/library` 按需动态 import**（与 `printService.ts` 引 hiprint 同一套路）：
// 它约 500KB，而这个页面**不扫码时根本用不到**。等用户真的点「扫码录单」再下载那个 chunk。

import { onBeforeUnmount, ref, type Ref } from 'vue'

/** 旧版 `canplay` 的等待上限（毫秒），超时报「Video播放超时」。 */
const CANPLAY_TIMEOUT_MS = 5000

/**
 * 「这一帧没解到码」时的重试间隔（毫秒）—— **旧版没有这个值**，见文件头「有意偏离 4」。
 * 库默认 `0`（= 立刻重试，每秒几百次整帧解码），那是烤机设置，不是旧版的决策。
 */
const DECODE_RETRY_MS = 200

/** 取流参数 —— 逐字照抄旧版 `g()` 的默认值 `l`。 */
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  facingMode: 'environment',
}

/** 连续扫码时每解到一个码的回调。 */
export type QrResultHandler = (text: string) => void

/**
 * 摄像头环境自检 —— 逐字对应旧版 `ol()` 的四条判断（文案也照抄）。
 *
 * `ol()` 是把不满足的条件**往 `errors` 里塞**（可以同时有多条）；前端只需要一条给用户看的，
 * 所以这里**返回第一条**命中的。返回 `null` = 环境没问题。
 */
export function cameraEnvironmentError(): string | null {
  const { protocol, hostname } = window.location
  if (protocol !== 'https:' && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return '需要HTTPS环境才能访问摄像头'
  }
  if (!navigator.mediaDevices) return '浏览器不支持MediaDevices API'
  if (!navigator.mediaDevices.getUserMedia) return '浏览器不支持getUserMedia API'
  // 旧版还查了 enumerateDevices。新版**不再自己挑设备**（有意偏离 1），
  // 但这条自检留着 —— 它的价值是「告诉用户这台机器/这个浏览器不行」，与挑不挑设备无关。
  if (!navigator.mediaDevices.enumerateDevices) return '浏览器不支持enumerateDevices API'
  return null
}

export function useQrScanner() {
  /** 扫码中（旧版 `ot`）—— 控制扫码容器的 `v-show` 与工具条 1/2 两颗按钮的互换。 */
  const scanning = ref(false)
  /** 绑到模板里的 `<video>`（旧版是 `createElement` 造出来再 append）。 */
  const videoRef: Ref<HTMLVideoElement | null> = ref(null)

  let stream: MediaStream | null = null
  // ZXing 的 reader。**故意用宽类型**：它是动态 import 出来的，静态类型要跨 `await import` 拿。
  let reader: { decodeContinuously: (el: HTMLVideoElement, cb: (r: unknown, e?: unknown) => void) => void; stopContinuousDecode: () => void; reset: () => void } | null = null
  /** 置位后所有回调直接丢弃 —— 停止扫码后，已经在途的那一轮解码不该再冒出新结果。 */
  let stopped = true

  /**
   * 等 `<video>` 可以播（旧版那段 `canplay` + 5 秒超时）。
   *
   * ⚠️ 必须**先挂监听再判 `readyState`** —— 反过来的话，流已经就绪时事件早就过去了，
   * 会一直等到超时（慢设备上表现为「明明有画面却报超时」）。
   */
  function waitCanPlay(video: HTMLVideoElement): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        video.removeEventListener('canplay', onCanPlay)
        reject(new Error('Video播放超时'))
      }, CANPLAY_TIMEOUT_MS)
      const onCanPlay = () => {
        window.clearTimeout(timer)
        video.removeEventListener('canplay', onCanPlay)
        resolve()
      }
      video.addEventListener('canplay', onCanPlay)
      if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) onCanPlay()
    })
  }

  /** 停流 + 停解码循环。**幂等**，重复调不会炸。 */
  function stop() {
    stopped = true
    scanning.value = false
    if (reader) {
      try {
        reader.stopContinuousDecode()
        reader.reset()
      } catch {
        // ZXing 内部状态异常不该拦住「停止扫码」这件事
      }
      reader = null
    }
    if (stream) {
      for (const t of stream.getTracks()) t.stop()
      stream = null
    }
    const video = videoRef.value
    if (video) {
      video.srcObject = null
      video.removeAttribute('src')
    }
  }

  /**
   * 开摄像头并**连续**扫码：每解到一个码就回调一次，**不自动停**（旧版 `nt2 = true` 那条路）。
   *
   * 抛出的 `Error.message` 都是**给用户看的中文**（环境/权限/超时），调用方直接 `message.error` 即可。
   * 抛之前**自己已经把流收拾干净**了，调用方不用再调 `stop()`。
   */
  async function start(onResult: QrResultHandler): Promise<void> {
    // 先清上一路（旧版 `ll()` 也是先清）—— 重复点「扫码录单」不该叠出两路摄像头。
    stop()

    // ⚠️ **先露出扫码容器再取流**，这一步不能挪到后面：
    // ① 旧版就是这个顺序 —— `@48621` 里第一步就是 `ot = true`，失败时才「报错并收起」（§3.3-(a)）；
    // ② 更实际的原因：容器是 `v-show`，藏着的 `<video>` 是 `display:none`，
    //    有些浏览器对隐藏的 video 不刷新画面 ⇒ `decodeContinuously` 会一直解码**旧帧**。
    // ⚠️ 之后**任何一条失败路径都必须经过 `stop()`**（它就是「报错并收起」那个动作，
    //    会把 `scanning` 翻回 false 并掐掉已开的流）—— 所以从这里往下整段包在 `try` 里。
    scanning.value = true

    try {
      const envError = cameraEnvironmentError()
      if (envError) throw new Error(envError)

      const video = videoRef.value
      if (!video) throw new Error('摄像头容器还没准备好，请重试')

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS })
      } catch {
        // 旧版是 `throw new Error("浏览器不支持摄像头访问")` —— 不管真实原因是「用户拒绝授权」
        // 还是「没有摄像头」，都归到这一条。文案照抄（厂里用的人只关心「开不了」）。
        throw new Error('浏览器不支持摄像头访问')
      }

      video.srcObject = stream
      await waitCanPlay(video)

      const zx = await import('@zxing/library')
      const hints = new Map<number, unknown>()
      hints.set(zx.DecodeHintType.POSSIBLE_FORMATS, [zx.BarcodeFormat.QR_CODE])
      hints.set(zx.DecodeHintType.TRY_HARDER, true)

      const r = new zx.BrowserMultiFormatReader(hints as never)
      // 见文件头「有意偏离 4」：库默认 0，会变成每秒几百次的整帧解码忙循环。
      r.timeBetweenDecodingAttempts = DECODE_RETRY_MS
      stopped = false
      // `decodeContinuously` 是「解到就回调、然后接着解」的循环；解不到（NotFoundException）
      // 它自己在内部吞掉重试，只有*别的*异常才会被回调拿到 —— 那些一律忽略，
      // 免得每 200ms 弹一次错（旧版也是只处理 `result` 那一支）。
      r.decodeContinuously(video, (result: unknown) => {
        if (stopped || !result) return
        const text = String((result as { getText: () => string }).getText() || '').trim()
        if (text) onResult(text)
      })
      reader = r as unknown as typeof reader
    } catch (e) {
      stop()
      throw e instanceof Error ? e : new Error('开启摄像头失败')
    }
  }

  // 离开页面必须停流 —— 否则摄像头指示灯一直亮着，手机端尤其明显。
  onBeforeUnmount(stop)

  return { scanning, videoRef, start, stop }
}
