import { useRef, type TouchEvent } from 'react'

interface Swipe {
  id: number
  x: number
  y: number
  startedAt: number
}

const controls = 'input, textarea, select, button, a, label, summary, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="switch"], [role="button"], [role="dialog"]'

export function useSwipeBack(onBack: () => void, enabled: boolean) {
  const swipe = useRef<Swipe | null>(null)
  const cancel = () => { swipe.current = null }

  return {
    onTouchStart: (event: TouchEvent<HTMLElement>) => {
      cancel()
      const touch = event.touches[0]
      if (!enabled || event.touches.length !== 1 || !touch
        || (event.target instanceof Element && event.target.closest(controls))
        || window.getSelection()?.isCollapsed === false) return
      swipe.current = { id: touch.identifier, x: touch.clientX, y: touch.clientY, startedAt: event.timeStamp }
    },
    onTouchMove: (event: TouchEvent<HTMLElement>) => {
      const start = swipe.current
      const touch = event.touches[0]
      if (!enabled || !start || event.touches.length !== 1 || touch?.identifier !== start.id) { cancel(); return }
      const dx = touch.clientX - start.x
      const dy = Math.abs(touch.clientY - start.y)
      if (dx < -12 || dy > 40 || (dy > 12 && dy > Math.abs(dx))) cancel()
    },
    onTouchEnd: (event: TouchEvent<HTMLElement>) => {
      const start = swipe.current
      cancel()
      if (!enabled || !start || event.touches.length !== 0 || window.getSelection()?.isCollapsed === false) return
      const touch = Array.from(event.changedTouches).find((point) => point.identifier === start.id)
      if (!touch) return
      const dx = touch.clientX - start.x
      const dy = Math.abs(touch.clientY - start.y)
      const duration = event.timeStamp - start.startedAt
      if (dx < 72 || dy > 40 || dx < dy * 2 || duration < 0 || duration > 1000) return
      // Keep native scrolling/zooming; suppress only a completed swipe's synthetic click.
      if (event.cancelable) event.preventDefault()
      onBack()
    },
    onTouchCancel: cancel,
  }
}
