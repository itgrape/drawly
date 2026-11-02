import { type FormEvent, useEffect, useRef, useState } from 'react'

export function BoardNameDialog({
  mode,
  initialTitle = '',
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'rename'
  initialTitle?: string
  submitting: boolean
  error: string
  onClose: () => void
  onSubmit: (title: string) => void
}) {
  const [title, setTitle] = useState(initialTitle)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const normalized = title.trim()
    if (normalized) onSubmit(normalized)
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="board-name-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="board-name-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="board-name-title">{mode === 'create' ? '新建画板' : '重命名画板'}</h2>
        <form onSubmit={handleSubmit}>
          <label>
            画板名称
            <input
              ref={inputRef}
              value={title}
              maxLength={80}
              placeholder="例如：产品讨论"
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <div className="dialog-actions">
            <button type="button" className="secondary-button" onClick={onClose}>取消</button>
            <button type="submit" className="primary-button" disabled={submitting || !title.trim()}>
              {submitting ? '处理中…' : mode === 'create' ? '创建' : '保存'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
