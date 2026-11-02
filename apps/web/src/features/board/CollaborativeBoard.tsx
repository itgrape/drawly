import type { DrawlyUser } from '@drawly/shared/auth'
import { useSync } from '@tldraw/sync'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AssetRecordType,
  atom,
  computed,
  createUserId,
  getHashForString,
  type TLAssetStore,
  type TLBookmarkAsset,
  Tldraw,
  type TLUserPreferences,
  type TLUserStore,
  uniqueId,
  UserRecordType,
  useTldrawCurrentUser,
} from 'tldraw'
import 'tldraw/tldraw.css'
import { serverUrl } from '../../lib/api'

export function CollaborativeBoard({
  user,
  roomId,
  shareToken,
}: {
  user: DrawlyUser
  roomId: string
  shareToken?: string
}) {
  const [userPreferences, setUserPreferences] = useState<TLUserPreferences>(() =>
    toUserPreferences(user)
  )
  const userPreferencesAtom = useRef(
    atom<TLUserPreferences>(`drawly-user-${user.id}`, userPreferences)
  ).current

  useEffect(() => {
    const nextPreferences = toUserPreferences(user)
    setUserPreferences(nextPreferences)
    userPreferencesAtom.set(nextPreferences)
  }, [user, userPreferencesAtom])

  useEffect(() => {
    userPreferencesAtom.set(userPreferences)
  }, [userPreferences, userPreferencesAtom])

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
  const syncUrl = `${serverUrl}/connect/${encodeURIComponent(roomId)}${
    shareToken ? `?shareToken=${encodeURIComponent(shareToken)}` : ''
  }`
  const store = useSync({
    uri: syncUrl,
    assets: multiplayerAssets,
    users,
  })

  return (
    <div className="canvas-container">
      <Tldraw
        store={store}
        user={currentUser}
        onMount={(editor) => {
          editor.registerExternalAssetHandler('url', unfurlBookmarkUrl)
        }}
      />
    </div>
  )
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
