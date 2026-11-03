import type { DrawlyUser } from '@drawly/shared/auth'
import type { CommentMember, CommentMembersResponse } from '@drawly/shared/comment'
import {
  CanvasComments,
  CanvasCommentsSidebar,
  CommentTool,
  commentToolOverrides,
  filterMentionMembers,
  toggleCommentsSidebar,
  useCommentsSidebarOpen,
  type CommentingContext,
  type MentionMember,
} from '@tldraw/commenting'
import { useSync } from '@tldraw/sync'
import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  AssetRecordType,
  atom,
  commentSchemaRecords,
  computed,
  createUserId,
  DefaultContextMenu,
  DefaultContextMenuContent,
  defineMessages,
  type TLUiContextMenuProps,
  getHashForString,
  type TLAssetStore,
  type TLBookmarkAsset,
  Tldraw,
  EditorPortal,
  TldrawUiMenuGroup,
  TldrawUiMenuItem,
  type TLUserPreferences,
  type TLUserStore,
  uniqueId,
  UserRecordType,
  useEditor,
  useTldrawCurrentUser,
  useValue,
} from 'tldraw'
import 'tldraw/tldraw.css'
import '@tldraw/commenting/commenting.css'
import { apiRequest, serverUrl } from '../../lib/api'
import { DrawlyBookmarkShapeUtil } from './DrawlyBookmarkShapeUtil'
import { BookmarkMenuItems } from './BookmarkMenuItems'
import { getBoardLinkPreview } from './boardLinkPreview'

export function CollaborativeBoard({
  user,
  roomId,
  shareToken,
  canComment = true,
  onShare,
}: {
  user: DrawlyUser
  roomId: string
  shareToken?: string
  canComment?: boolean
  onShare?: () => void
}) {
  const [userPreferences, setUserPreferences] = useState<TLUserPreferences>(() =>
    toUserPreferences(user)
  )
  const userPreferencesAtom = useRef(
    atom<TLUserPreferences>(`drawly-user-${user.id}`, userPreferences)
  ).current
  const [commentMembers, setCommentMembers] = useState<CommentMember[]>([toCommentMember(user)])

  useEffect(() => {
    const nextPreferences = toUserPreferences(user)
    setUserPreferences(nextPreferences)
    userPreferencesAtom.set(nextPreferences)
  }, [user, userPreferencesAtom])

  useEffect(() => {
    userPreferencesAtom.set(userPreferences)
  }, [userPreferences, userPreferencesAtom])

  useEffect(() => {
    let active = true
    const query = shareToken ? `?shareToken=${encodeURIComponent(shareToken)}` : ''
    apiRequest<CommentMembersResponse>(
      `/api/boards/${encodeURIComponent(roomId)}/comment-members${query}`
    )
      .then(({ members }) => {
        if (active) setCommentMembers(ensureCurrentMember(members, user))
      })
      .catch(() => {
        if (active) setCommentMembers([toCommentMember(user)])
      })
    return () => { active = false }
  }, [roomId, shareToken, user])

  const users: TLUserStore = useMemo(
    () => ({
      currentUser: computed(`drawly-current-user-${user.id}`, () => {
        const preferences = userPreferencesAtom.get()
        return UserRecordType.create({
          id: createUserId(preferences.id),
          name: preferences.name ?? user.displayName,
          color: preferences.color ?? user.avatarColor,
        })
      }),
    }),
    [user.id, user.displayName, user.avatarColor, userPreferencesAtom]
  )

  const currentUser = useTldrawCurrentUser({ userPreferences, setUserPreferences })
  const commenting = useMemo<CommentingContext>(() => {
    const members = commentMembers.map((member) => ({
      ...toMentionMember(member),
      you: member.id === user.id,
    }))
    const byId = new Map(members.map((member) => [member.id, member]))
    return {
      currentUserId: canComment ? user.id : null,
      resolveAuthor: (id) => byId.get(id),
      getMentionSuggestions: (query) => filterMentionMembers(members, query),
    }
  }, [canComment, commentMembers, user.id])
  const commentingTools = useMemo(
    () => [CommentTool.configure({
      history: 'ignore',
      canComment: () => canComment,
      components: { ComposerFallback: ReadOnlyCommentNotice },
    })],
    [canComment]
  )
  const uiComponents = useMemo(
    () => ({
      ContextMenu: (props: TLUiContextMenuProps) => (
        <DefaultContextMenu {...props}>
          <BoardContextMenuContent onShare={onShare} />
        </DefaultContextMenu>
      ),
    }),
    [onShare]
  )
  const syncUrl = `${serverUrl}/connect/${encodeURIComponent(roomId)}${
    shareToken ? `?shareToken=${encodeURIComponent(shareToken)}` : ''
  }`
  const store = useSync({
    uri: syncUrl,
    assets: multiplayerAssets,
    users,
    records: commentSchemaRecords,
  })

  return (
    <div className="canvas-container">
      <Tldraw
        store={store}
        user={currentUser}
        maxAssetSize={100 * 1024 * 1024}
        licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY}
        tools={commentingTools}
        shapeUtils={[DrawlyBookmarkShapeUtil]}
        overrides={[commentToolOverrides]}
        components={uiComponents}
        onMount={(editor) => {
          editor.registerExternalAssetHandler('url', unfurlBookmarkUrl)
        }}
      >
        <CanvasComments {...commenting} />
        <CanvasCommentsSidebar {...commenting} />
        <CommentsSidebarButton />
      </Tldraw>
    </div>
  )
}

const boardMenuMessages = defineMessages({
  shareBoard: { id: 'drawly.share-board', defaultMessage: '分享画板' },
})

function BoardContextMenuContent({ onShare }: { onShare?: () => void }) {
  const editor = useEditor()
  const hasSelection = useValue(
    'drawly context menu selection',
    () => editor.getSelectedShapeIds().length > 0,
    [editor]
  )

  return (
    <>
      <BookmarkMenuItems />
      {!hasSelection && onShare && (
        <TldrawUiMenuGroup id="drawly-board">
          <TldrawUiMenuItem
            id="share-board"
            label={boardMenuMessages.shareBoard.id}
            icon="share-1"
            readonlyOk
            onSelect={onShare}
          />
        </TldrawUiMenuGroup>
      )}
      <DefaultContextMenuContent />
    </>
  )
}

function CommentsSidebarButton() {
  const editor = useEditor()
  const open = useCommentsSidebarOpen()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dragRef = useRef<CommentButtonDragState | null>(null)
  const suppressClickRef = useRef(false)
  const [position, setPosition] = useState(readCommentButtonPosition)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const keepInsideViewport = () => {
      setPosition((current) => clampCommentButtonPosition(current, buttonRef.current))
    }
    keepInsideViewport()
    window.addEventListener('resize', keepInsideViewport)
    return () => window.removeEventListener('resize', keepInsideViewport)
  }, [])

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation()
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

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 4) return

    if (!drag.moved) {
      drag.moved = true
      event.currentTarget.setPointerCapture(event.pointerId)
      setDragging(true)
    }
    setPosition(
      clampCommentButtonPosition(
        { x: drag.originX + deltaX, y: drag.originY + deltaY },
        buttonRef.current
      )
    )
  }

  function finishDragging(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const finalPosition = drag.moved
      ? clampCommentButtonPosition(
          {
            x: drag.originX + event.clientX - drag.startX,
            y: drag.originY + event.clientY - drag.startY,
          },
          buttonRef.current
        )
      : position

    suppressClickRef.current = drag.moved
    dragRef.current = null
    setDragging(false)
    setPosition(finalPosition)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (drag.moved) {
      window.localStorage.setItem(COMMENT_BUTTON_STORAGE_KEY, JSON.stringify(finalPosition))
    }
  }

  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    toggleCommentsSidebar(editor)
  }

  return (
    <EditorPortal>
      <button
        ref={buttonRef}
        className={`comments-sidebar-button${open ? ' comments-sidebar-button-active' : ''}${dragging ? ' comments-sidebar-button-dragging' : ''}`}
        style={{ left: position.x, top: position.y }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDragging}
        onPointerCancel={finishDragging}
        onClick={handleClick}
        title="拖动可移动，点击打开评论"
      >
        评论
      </button>
    </EditorPortal>
  )
}

const COMMENT_BUTTON_STORAGE_KEY = 'drawly.comments-button-position'
const COMMENT_BUTTON_DEFAULT_WIDTH = 54
const COMMENT_BUTTON_DEFAULT_RIGHT_GAP = 380
const COMMENT_BUTTON_VIEWPORT_PADDING = 8

interface CommentButtonPosition {
  x: number
  y: number
}

interface CommentButtonDragState {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  moved: boolean
}

function readCommentButtonPosition(): CommentButtonPosition {
  try {
    const saved = JSON.parse(window.localStorage.getItem(COMMENT_BUTTON_STORAGE_KEY) ?? 'null') as
      | { x?: unknown; y?: unknown }
      | null
    if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
      return saved as CommentButtonPosition
    }
  } catch {
    // Ignore invalid local preferences and use the default position.
  }

  return {
    x: Math.max(
      COMMENT_BUTTON_VIEWPORT_PADDING,
      window.innerWidth - COMMENT_BUTTON_DEFAULT_WIDTH - COMMENT_BUTTON_DEFAULT_RIGHT_GAP
    ),
    y: 54,
  }
}

function clampCommentButtonPosition(
  position: CommentButtonPosition,
  element: HTMLButtonElement | null
): CommentButtonPosition {
  const width = element?.offsetWidth ?? COMMENT_BUTTON_DEFAULT_WIDTH
  const height = element?.offsetHeight ?? 30
  return {
    x: Math.min(
      Math.max(COMMENT_BUTTON_VIEWPORT_PADDING, position.x),
      Math.max(COMMENT_BUTTON_VIEWPORT_PADDING, window.innerWidth - width - COMMENT_BUTTON_VIEWPORT_PADDING)
    ),
    y: Math.min(
      Math.max(COMMENT_BUTTON_VIEWPORT_PADDING, position.y),
      Math.max(COMMENT_BUTTON_VIEWPORT_PADDING, window.innerHeight - height - COMMENT_BUTTON_VIEWPORT_PADDING)
    ),
  }
}

function ReadOnlyCommentNotice() {
  return <div className="readonly-comment-notice">只读分享不能发表评论</div>
}

function toCommentMember(user: DrawlyUser): CommentMember {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
  }
}

function ensureCurrentMember(members: CommentMember[], user: DrawlyUser) {
  return members.some((member) => member.id === user.id)
    ? members
    : [...members, toCommentMember(user)]
}

function toMentionMember(member: CommentMember): MentionMember {
  return {
    id: member.id,
    name: member.displayName,
    color: member.avatarColor,
    secondary: `@${member.username}`,
  }
}

const multiplayerAssets: TLAssetStore = {
  async upload(_asset, file) {
    const objectName = `${uniqueId()}-${sanitizeFileName(file.name)}`
    const url = `${serverUrl}/uploads/${encodeURIComponent(objectName)}`
    const response = await fetch(url, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': file.type || 'application/octet-stream' },
      body: file,
    })

    if (!response.ok) {
      throw new Error(`资源上传失败：${response.status} ${response.statusText}`)
    }
    return { src: url }
  },
  resolve(asset) {
    return asset.props.src
  },
}

function toUserPreferences(user: DrawlyUser): TLUserPreferences {
  return { id: user.id, name: user.displayName, color: user.avatarColor }
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-160) || 'asset'
}

async function unfurlBookmarkUrl({ url }: { url: string }): Promise<TLBookmarkAsset> {
  const asset: TLBookmarkAsset = {
    id: AssetRecordType.createId(getHashForString(url)),
    typeName: 'asset',
    type: 'bookmark',
    meta: {},
    props: { src: url, description: '', image: '', favicon: '', title: '' },
  }

  try {
    const preview = await getBoardLinkPreview(url)
    if (preview) {
      Object.assign(asset.props, preview)
      return asset
    }
    const response = await fetch(`${serverUrl}/unfurl?url=${encodeURIComponent(url)}`, {
      credentials: 'include',
    })
    if (!response.ok) return asset
    const data = await response.json()
    asset.props.description = data?.description ?? ''
    asset.props.image = data?.image ?? ''
    asset.props.favicon = data?.favicon ?? ''
    asset.props.title = data?.title ?? ''
  } catch (error) {
    console.error('链接预览获取失败', error)
  }

  return asset
}
