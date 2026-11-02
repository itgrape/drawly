import type { DrawlyUser } from '@drawly/shared/auth'
import { type PointerEvent, useEffect, useRef, useState } from 'react'
import { UserAvatar } from '../../components/UserAvatar'

const DEFAULT_WIDTH = 210
const DEFAULT_RIGHT_GAP = 210
const VIEWPORT_PADDING = 8
const STORAGE_KEY = 'drawly.account-menu-position'

interface Position {
  x: number
  y: number
}

interface DragState {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  moved: boolean
}

export function DraggableAccountMenu({
  user,
  onOpenProfile,
  onLogout,
}: {
  user: DrawlyUser
  onOpenProfile: () => void
  onLogout: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)
  const [position, setPosition] = useState(readPosition)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const keepInsideViewport = () => {
      setPosition((current) => clampPosition(current, menuRef.current))
    }
    keepInsideViewport()
    window.addEventListener('resize', keepInsideViewport)
    return () => window.removeEventListener('resize', keepInsideViewport)
  }, [])

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      moved: false,
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 4) return

    drag.moved = true
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
    setPosition(
      clampPosition(
        { x: drag.originX + deltaX, y: drag.originY + deltaY },
        menuRef.current
      )
    )
  }

  function finishDragging(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const finalPosition = drag.moved
      ? clampPosition(
          {
            x: drag.originX + event.clientX - drag.startX,
            y: drag.originY + event.clientY - drag.startY,
          },
          menuRef.current
        )
      : position

    suppressClickRef.current = drag.moved
    dragRef.current = null
    setDragging(false)
    setPosition(finalPosition)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(finalPosition))
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
  }

  function runIfNotDragged(action: () => void) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    action()
  }

  return (
    <div
      ref={menuRef}
      className={`account-menu${dragging ? ' account-menu-dragging' : ''}`}
      style={{ left: position.x, top: position.y }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDragging}
      onPointerCancel={finishDragging}
      title="拖动可移动账号卡片"
    >
      <span className="drag-grip" aria-hidden="true">⠿</span>
      <button className="account-button" onClick={() => runIfNotDragged(onOpenProfile)}>
        <UserAvatar user={user} />
        <span>{user.displayName}</span>
      </button>
      <button className="logout-button" onClick={() => runIfNotDragged(onLogout)}>退出</button>
    </div>
  )
}

function readPosition(): Position {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as
      | { x?: unknown; y?: unknown }
      | null
    if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
      return { x: saved.x, y: saved.y }
    }
  } catch {
    // Ignore invalid local preferences and use the default position.
  }

  return {
    x: Math.max(VIEWPORT_PADDING, window.innerWidth - DEFAULT_WIDTH - DEFAULT_RIGHT_GAP),
    y: 10,
  }
}

function clampPosition(position: Position, element: HTMLDivElement | null): Position {
  const width = element?.offsetWidth ?? DEFAULT_WIDTH
  const height = element?.offsetHeight ?? 38
  return {
    x: Math.min(
      Math.max(VIEWPORT_PADDING, position.x),
      Math.max(VIEWPORT_PADDING, window.innerWidth - width - VIEWPORT_PADDING)
    ),
    y: Math.min(
      Math.max(VIEWPORT_PADDING, position.y),
      Math.max(VIEWPORT_PADDING, window.innerHeight - height - VIEWPORT_PADDING)
    ),
  }
}
