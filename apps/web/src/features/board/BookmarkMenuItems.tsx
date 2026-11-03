import { useState } from 'react'
import {
  AssetRecordType, defineMessages, getHashForString, TldrawUiMenuGroup, TldrawUiMenuItem,
  TldrawUiDialogHeader, TldrawUiDialogTitle, TldrawUiDialogBody,
  TldrawUiDialogCloseButton, TldrawUiDialogFooter,
  useDialogs, useEditor, useToasts, useValue,
  type Editor, type TLBookmarkAsset, type TLBookmarkShape, type TLUiDialogProps,
} from 'tldraw'
import { getBoardLink, getBoardLinkPreview } from './boardLinkPreview'

const messages = defineMessages({
  edit: { id: 'drawly.edit-link-title', defaultMessage: '编辑卡片标题' },
  refresh: { id: 'drawly.refresh-link-preview', defaultMessage: '刷新画板预览' },
})

function getBookmarkAsset(editor: Editor, shape: TLBookmarkShape) {
  return editor.getAsset(shape.props.assetId ?? AssetRecordType.createId(getHashForString(shape.props.url)))
}

// Each card gets its own asset so renaming one does not rename every card with the same URL.
function updateBookmark(editor: Editor, shape: TLBookmarkShape, props: TLBookmarkAsset['props'], customTitle?: string) {
  editor.markHistoryStoppingPoint('update bookmark')
  editor.run(() => {
    const id = AssetRecordType.createId()
    editor.createAssets([{ id, typeName: 'asset', type: 'bookmark', meta: {}, props }])
    editor.updateShapes([{
      id: shape.id, type: 'bookmark', props: { assetId: id },
      ...(customTitle === undefined ? {} : {
        meta: { ...shape.meta, customBookmarkTitle: customTitle, customBookmarkTitleUrl: shape.props.url },
      }),
    }])
  })
}

export function BookmarkMenuItems() {
  const editor = useEditor()
  const { addDialog } = useDialogs()
  const { addToast, removeToast } = useToasts()
  const bookmark = useValue('selected bookmark', () => {
    const shapes = editor.getSelectedShapes()
    return shapes.length === 1 && shapes[0].type === 'bookmark'
      ? shapes[0] as TLBookmarkShape : null
  }, [editor])
  const readonly = useValue('readonly bookmarks', () => editor.getIsReadonly(), [editor])
  if (!bookmark || readonly) return null

  async function refreshPreview(shape: TLBookmarkShape) {
    const toast = addToast({ title: '正在生成画板预览…', keepOpen: true })
    try {
      const preview = await getBoardLinkPreview(shape.props.url)
      if (editor.isDisposed) return
      const current = editor.getShape<TLBookmarkShape>(shape.id)
      if (!preview || !current || current.props.url !== shape.props.url || editor.getIsReadonly()) return
      updateBookmark(editor, current, {
        src: current.props.url, favicon: '', ...preview,
        title: current.meta.customBookmarkTitleUrl === current.props.url && typeof current.meta.customBookmarkTitle === 'string'
          ? current.meta.customBookmarkTitle : preview.title,
      })
    } catch (error) {
      if (!editor.isDisposed) addToast({ severity: 'error', title: '预览生成失败', description: error instanceof Error ? error.message : '请稍后重试' })
    } finally {
      removeToast(toast)
    }
  }

  return (
    <TldrawUiMenuGroup id="drawly-bookmark">
      <TldrawUiMenuItem id="edit-link-title" label={messages.edit.id}
        onSelect={() => { addDialog({
          component: (props) => <BookmarkTitleDialog {...props} bookmark={bookmark} />,
        }) }} />
      {getBoardLink(bookmark.props.url) && (
        <TldrawUiMenuItem id="refresh-link-preview" label={messages.refresh.id}
          onSelect={() => { void refreshPreview(bookmark) }} />
      )}
    </TldrawUiMenuGroup>
  )
}

function BookmarkTitleDialog({ bookmark, onClose }: TLUiDialogProps & { bookmark: TLBookmarkShape }) {
  const editor = useEditor()
  const asset = getBookmarkAsset(editor, bookmark)
  const [title, setTitle] = useState(
    bookmark.meta.customBookmarkTitleUrl === bookmark.props.url && typeof bookmark.meta.customBookmarkTitle === 'string'
      ? bookmark.meta.customBookmarkTitle : asset?.type === 'bookmark' ? asset.props.title : ''
  )
  const [error, setError] = useState('')
  return (
    <form onSubmit={(event) => {
      event.preventDefault()
      const current = editor.getShape<TLBookmarkShape>(bookmark.id)
      if (!current || current.props.url !== bookmark.props.url || editor.getIsReadonly()) {
        setError('卡片已更改或无法编辑，请关闭后重试')
        return
      }
      if (!title.trim()) return
      const currentAsset = getBookmarkAsset(editor, current)
      updateBookmark(editor, current, {
        src: current.props.url, image: '', description: '', favicon: '',
        ...(currentAsset?.type === 'bookmark' ? currentAsset.props : {}), title: title.trim(),
      }, title.trim())
      onClose()
    }}>
      <TldrawUiDialogHeader>
        <TldrawUiDialogTitle>编辑卡片标题</TldrawUiDialogTitle>
        <TldrawUiDialogCloseButton />
      </TldrawUiDialogHeader>
      <TldrawUiDialogBody>
        <label className="bookmark-title-label">卡片标题
          <input autoFocus value={title} maxLength={160} required
            onChange={(event) => setTitle(event.target.value)} />
        </label>
        {error && <p className="form-error">{error}</p>}
      </TldrawUiDialogBody>
      <TldrawUiDialogFooter>
        <button type="button" className="secondary-button" onClick={onClose}>取消</button>
        <button className="primary-button" type="submit" disabled={!title.trim()}>保存</button>
      </TldrawUiDialogFooter>
    </form>
  )
}
