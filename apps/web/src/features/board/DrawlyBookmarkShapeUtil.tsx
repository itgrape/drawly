import type { PointerEvent } from 'react'
import {
  AssetRecordType, BookmarkShapeUtil, getHashForString, HTMLContainer,
  tlenv, useEditor, useSvgExportContext, useValue, Vec, type TLBookmarkShape,
} from 'tldraw'
import { getBoardLink } from './boardLinks'

// Keep tldraw's bookmark geometry, URL handling, and asset hydration.
export class DrawlyBookmarkShapeUtil extends BookmarkShapeUtil {
  override getAriaDescriptor(shape: TLBookmarkShape) {
    return shape.meta.customBookmarkTitleUrl === shape.props.url && typeof shape.meta.customBookmarkTitle === 'string'
      ? shape.meta.customBookmarkTitle : super.getAriaDescriptor(shape)
  }

  override component(shape: TLBookmarkShape) {
    return <BookmarkCard shape={shape} height={this.getGeometry(shape).bounds.height} />
  }
}

function BookmarkCard({ shape, height }: { shape: TLBookmarkShape; height: number }) {
  const editor = useEditor()
  const { url, assetId } = shape.props
  const safariExport = !!useSvgExportContext() && tlenv.isSafari
  const rotation = editor.getShapePageTransform(shape)?.rotation() ?? 0
  const shadow = [
    { offset: 2, blur: 4, color: '#00000029' },
    { offset: 3, blur: 6, color: '#0000001f' },
  ].map(({ offset, blur, color }) => {
    const { x, y } = new Vec(0, offset).rot(-rotation)
    return `${x}px ${y}px ${blur}px 0px ${color}`
  }).join(', ')
  const asset = useValue('bookmark card asset', () => {
    const record = editor.getAsset(assetId ?? AssetRecordType.createId(getHashForString(url)))
    return record?.type === 'bookmark' ? record : undefined
  }, [editor, assetId, url])
  const title = shape.meta.customBookmarkTitleUrl === url && typeof shape.meta.customBookmarkTitle === 'string'
    ? shape.meta.customBookmarkTitle : asset?.props.title ?? ''
  const boardLink = getBoardLink(url)
  function handlePointer(event: PointerEvent<HTMLAnchorElement>) {
    if (!editor.inputs.getShiftKey()) editor.markEventAsHandled(event)
  }
  const linkProps = {
    href: url, target: '_blank', rel: 'noopener noreferrer', draggable: false,
    onPointerDown: handlePointer, onPointerUp: handlePointer,
  } as const

  return (
    <HTMLContainer>
      <div
        className={`tl-bookmark__container drawly-bookmark${safariExport ? ' tl-bookmark__container--safariExport' : ''}`}
        style={{ maxHeight: height, boxShadow: safariExport ? undefined : shadow }}
      >
        {(!asset || asset.props.image) && (
          <div className="tl-bookmark__image_container">
            {asset?.props.image
              ? <img className="tl-bookmark__image" src={asset.props.image} alt={title} draggable={false} referrerPolicy="strict-origin-when-cross-origin" />
              : <div className="tl-bookmark__placeholder" />}
            {asset?.props.image && (
              <a {...linkProps} className="drawly-bookmark__open" aria-label="打开链接" title={url}>
                <LinkIcon />
              </a>
            )}
          </div>
        )}
        <div className="tl-bookmark__copy_container drawly-bookmark__copy">
          {title && (
            <a {...linkProps} className="tl-bookmark__link drawly-bookmark__title" title={title}>
              <h2 className="tl-bookmark__heading">{title}</h2>
            </a>
          )}
          {!boardLink && asset?.props.description && asset.props.image && (
            <p className="tl-bookmark__description">{asset.props.description}</p>
          )}
          <a {...linkProps} className="tl-bookmark__link drawly-bookmark__url" title={url}>
            <LinkIcon />
            <span dir="ltr">{url}</span>
          </a>
        </div>
      </div>
    </HTMLContainer>
  )
}

function LinkIcon() {
  return (
    <svg className="drawly-bookmark__link-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M14 4h6v6M20 4l-9 9M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
    </svg>
  )
}
