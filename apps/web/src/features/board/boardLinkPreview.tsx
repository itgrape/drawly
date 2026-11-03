import { createRoot } from 'react-dom/client'
import { commentSchemaRecords, createTLStore, loadSnapshot, Tldraw, type TLStoreSnapshot } from 'tldraw'
import { apiRequest } from '../../lib/api'
import { getBoardLink } from './boardLinks'
import { DrawlyBookmarkShapeUtil } from './DrawlyBookmarkShapeUtil'
export { getBoardLink } from './boardLinks'

export async function getBoardLinkPreview(url: string) {
  const link = getBoardLink(url)
  if (!link) return null
  const query = new URLSearchParams({ [link.kind === 'share' ? 'shareToken' : 'boardId']: link.id })
  const { title, snapshot } = await apiRequest<{ title: string; snapshot: TLStoreSnapshot }>(
    `/api/board-preview?${query}`
  )
  const store = createTLStore({ records: commentSchemaRecords })
  loadSnapshot(store, snapshot)
  const host = document.createElement('div')
  // Keep the renderer measurable while excluding it from interaction and accessibility.
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:600px;pointer-events:none'
  host.setAttribute('aria-hidden', 'true')
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    const image = await new Promise<string>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('画板预览生成超时')), 20000)
      root.render(
        <Tldraw
          store={store}
          shapeUtils={[DrawlyBookmarkShapeUtil]}
          hideUi
          autoFocus={false}
          licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY}
          onMount={(editor) => {
            void (async () => {
              try {
                editor.updateInstanceState({ isReadonly: true })
                const pages = editor.getPages()
                const page = pages.find((page) => editor.getPageShapeIds(page.id).size > 0)
                if (page) editor.setCurrentPage(page.id)
                const shapes = [...editor.getCurrentPageShapeIds()]
                if (!shapes.length) {
                  resolve(`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360"><rect width="100%" height="100%" fill="#f5f6fa"/><text x="300" y="180" text-anchor="middle" fill="#64748b" font-size="24">空白画板</text></svg>')}`)
                } else {
                  const allBounds = editor.getCurrentPageBounds()
                  const scale = allBounds ? Math.min(1, 600 / (Math.max(allBounds.width, allBounds.height) + 48)) : 1
                  const { url } = await editor.toImageDataUrl(shapes, {
                    format: 'png', background: true, padding: 24, scale, pixelRatio: 1,
                  })
                  resolve(url)
                }
              } catch (error) {
                reject(error)
              } finally {
                window.clearTimeout(timeout)
              }
            })()
          }}
        />
      )
    })
    return { title, image, description: '' }
  } finally {
    root.unmount()
    host.remove()
  }
}
