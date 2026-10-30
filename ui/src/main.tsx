import { useEffect, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import { AnimatedSwitch } from "@/components/spectrum/animated-switch"
import { NumberTicker } from "@/components/motion/number-ticker"
import { AnimatedToastStack, useAnimatedToastStack, type ToastStatus } from "@/components/motion/animated-toast-stack"
import "./index.css"

/**
 * 把 Spectrum UI 的 React 组件嵌进 app.js 用字符串渲染的页面。
 * app.js 每次 render() 都会重写 innerHTML，所以每次渲染后调 mountAll()，
 * 找到占位元素挂上组件，并卸载已经被移出页面的旧组件。
 * - <label class="switch"><input type="checkbox" …><i></i></label>：换成 AnimatedSwitch，切换时仍触发原 input 的 change
 * - <span data-ui="ticker" data-key="xp" data-value="120" data-prefix="⚡ ">：数字变化时滚动
 */

const roots = new Map<Element, Root>()
const lastValue = new Map<string, number>()

function mount(el: Element, node: React.ReactNode) {
  const root = createRoot(el)
  roots.set(el, root)
  root.render(node)
}

function Ticker({ from, to, prefix, suffix }: { from: number; to: number; prefix?: string; suffix?: string }) {
  const [v, setV] = useState(from)
  useEffect(() => {
    const t = setTimeout(() => setV(to), 30)
    return () => clearTimeout(t)
  }, [to])
  return <NumberTicker value={v} prefix={prefix} suffix={suffix} startOnView={false} duration={0.7} className="whitespace-pre" />
}

function mountAll(scope: ParentNode = document) {
  for (const [el, root] of roots) {
    if (!el.isConnected) {
      root.unmount()
      roots.delete(el)
    }
  }

  scope.querySelectorAll<HTMLLabelElement>("label.switch:not([data-sp])").forEach(label => {
    const input = label.querySelector<HTMLInputElement>("input[type=checkbox]")
    if (!input) return
    label.dataset.sp = ""
    const host = document.createElement("span")
    host.className = "sp-host"
    label.append(host)
    mount(host, (
      <AnimatedSwitch
        defaultChecked={input.checked}
        label={input.getAttribute("aria-label") ?? undefined}
        size="lg"
        className="aria-checked:bg-primary"
        onCheckedChange={checked => {
          input.checked = checked
          // 等滑块动画走完再通知 app.js，它会重绘页面
          setTimeout(() => input.dispatchEvent(new Event("change", { bubbles: true })), 260)
        }}
      />
    ))
  })

  scope.querySelectorAll<HTMLElement>("[data-ui=ticker]:not([data-sp])").forEach(el => {
    el.dataset.sp = ""
    const key = el.dataset.key ?? ""
    const to = Number(el.dataset.value)
    const from = lastValue.get(key)
    lastValue.set(key, to)
    // 只在数字变了（或这次打开 App 第一次看到）时滚动，平时保持原样
    if (from === to || !Number.isFinite(to)) return
    el.textContent = ""
    mount(el, <Ticker from={from ?? 0} to={to} prefix={el.dataset.prefix} suffix={el.dataset.suffix} />)
  })
}

let showToast: ((msg: string, status?: ToastStatus) => void) | null = null

function Toasts() {
  const { toasts, showToast: push, dismissToast } = useAnimatedToastStack({ defaultDuration: 2200, limit: 3 })
  useEffect(() => {
    showToast = (msg, status = "neutral") => { push({ title: msg, status }) }
    return () => { showToast = null }
  }, [push])
  return (
    <AnimatedToastStack
      toasts={toasts}
      onDismiss={dismissToast}
      position="bottom-center"
      placement="fixed"
      className="sp-toasts"
    />
  )
}

const toastHost = document.createElement("div")
document.body.append(toastHost)
createRoot(toastHost).render(<Toasts />)

declare global {
  interface Window { SpectrumUI: { mountAll: typeof mountAll; toast: (msg: string, status?: ToastStatus) => boolean } }
}
window.SpectrumUI = {
  mountAll,
  toast: (msg, status) => {
    if (!showToast) return false
    showToast(msg, status)
    return true
  },
}
