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
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AssetRecordType,
  atom,
  commentSchemaRecords,
  computed,
  createUserId,
  getHashForString,
  type TLAssetStore,
  type TLBookmarkAsset,
  Tldraw,
  EditorPortal,
  type TLUserPreferences,
  type TLUserStore,
  uniqueId,
  UserRecordType,
  useEditor,
  useTldrawCurrentUser,
} from 'tldraw'
import 'tldraw/tldraw.css'
import '@tldraw/commenting/commenting.css'
import { apiRequest, serverUrl } from '../../lib/api'

export function CollaborativeBoard({
  user,
  roomId,
  shareToken,
  canComment = true,
}: {
  user: DrawlyUser
  roomId: string
  shareToken?: string
  canComment?: boolean
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
        licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY}
        tools={commentingTools}
        overrides={[commentToolOverrides]}
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

function CommentsSidebarButton() {
  const editor = useEditor()
  const open = useCommentsSidebarOpen()
  return (
    <EditorPortal>
      <button
        className={`comments-sidebar-button${open ? ' comments-sidebar-button-active' : ''}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => toggleCommentsSidebar(editor)}
      >
        评论
      </button>
    </EditorPortal>
  )
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
