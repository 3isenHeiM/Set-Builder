import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { makeScore } from '../../test/fixtures'
import { ConfigurationEditor } from './ConfigurationEditor'

const point = (x: number, y: number, identifier = 1) => ({ identifier, clientX: x, clientY: y })

function swipe(target: Element, moves = [point(150, 110)]) {
  fireEvent.touchStart(target, { touches: [point(30, 100)] })
  for (const position of moves) fireEvent.touchMove(target, { touches: [position] })
  fireEvent.touchEnd(target, { touches: [], changedTouches: [moves.at(-1)!] })
}

describe('piece detail swipe Back', () => {
  it('awaits the same draft save as Back and ignores another swipe while that save is pending', async () => {
    let finish!: () => void
    const pending = new Promise<void>((resolve) => { finish = resolve })
    const onDraftChange = vi.fn(() => pending)
    const onClose = vi.fn()
    const view = render(<ConfigurationEditor score={makeScore()} onSave={vi.fn()} onDraftChange={onDraftChange} onClose={onClose} />)
    fireEvent.change(screen.getByRole('textbox', { name: /Custom drummer note/ }), { target: { value: 'Quiet verse' } })
    const editor = view.container.querySelector('.editor-panel')!
    swipe(editor)
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ drummerNotes: 'Quiet verse' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
    swipe(editor)
    expect(onDraftChange).toHaveBeenCalledOnce()
    await act(async () => { finish(); await pending })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps the draft on a failed swipe save and lets the user retry', async () => {
    const onDraftChange = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error('Save failed. Try again.')).mockResolvedValue(undefined)
    const onClose = vi.fn()
    const view = render(<ConfigurationEditor score={makeScore()} onSave={vi.fn()} onDraftChange={onDraftChange} onClose={onClose} />)
    const notes = screen.getByRole('textbox', { name: /Custom drummer note/ })
    fireEvent.change(notes, { target: { value: 'Keep this draft' } })
    swipe(view.container.querySelector('.editor-panel')!)
    expect(await screen.findByRole('status')).toHaveTextContent('Save failed')
    expect(notes).toHaveValue('Keep this draft')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled()
    swipe(view.container.querySelector('.editor-panel')!)
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it.each([
    ['short tap', [point(45, 104)]],
    ['left swipe', [point(-100, 100)]],
    ['vertical scroll', [point(35, 240)]],
    ['diagonal scroll', [point(150, 190)]],
    ['vertical movement followed by a right turn', [point(35, 170), point(170, 100)]],
    ['left movement followed by a right turn', [point(5, 100), point(170, 100)]],
  ] as const)('does not navigate during a %s', (_name, moves) => {
    const onClose = vi.fn()
    const view = render(<ConfigurationEditor score={makeScore()} onSave={vi.fn()} onClose={onClose} />)
    swipe(view.container.querySelector('.editor-panel')!, [...moves])
    expect(onClose).not.toHaveBeenCalled()
  })

  it.each(['textarea', 'select', 'button', 'label', 'input'])('leaves %s gestures to the control', (selector) => {
    const onClose = vi.fn()
    const view = render(<ConfigurationEditor score={makeScore()} onSave={vi.fn()} onClose={onClose} />)
    swipe(view.container.querySelector(selector)!)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('ignores interrupted and multiple-finger gestures without consuming vertical touch movement', () => {
    const onClose = vi.fn()
    const view = render(<ConfigurationEditor score={makeScore()} onSave={vi.fn()} onClose={onClose} />)
    const editor = view.container.querySelector('.editor-panel')!
    fireEvent.touchStart(editor, { touches: [point(30, 100)] })
    const vertical = createEvent.touchMove(editor, { touches: [point(35, 220)], cancelable: true })
    fireEvent(editor, vertical)
    expect(vertical.defaultPrevented).toBe(false)
    fireEvent.touchEnd(editor, { touches: [], changedTouches: [point(170, 100)] })
    fireEvent.touchStart(editor, { touches: [point(30, 100)] })
    fireEvent.touchCancel(editor)
    fireEvent.touchEnd(editor, { touches: [], changedTouches: [point(170, 100)] })
    fireEvent.touchStart(editor, { touches: [point(30, 100)] })
    fireEvent.touchMove(editor, { touches: [point(80, 100), point(100, 100, 2)] })
    fireEvent.touchEnd(editor, { touches: [], changedTouches: [point(170, 100)] })
    fireEvent.touchStart(editor, { touches: [point(30, 100), point(50, 100, 2)] })
    fireEvent.touchEnd(editor, { touches: [], changedTouches: [point(170, 100)] })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('preserves text selection and ignores a long hold', () => {
    const onClose = vi.fn()
    const view = render(<ConfigurationEditor score={makeScore()} onSave={vi.fn()} onClose={onClose} />)
    const editor = view.container.querySelector('.editor-panel')!
    const selection = window.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(screen.getByRole('heading', { name: 'Take On Me' }))
    selection.addRange(range)
    swipe(editor)
    selection.removeAllRanges()
    const start = createEvent.touchStart(editor, { touches: [point(30, 100)] })
    const end = createEvent.touchEnd(editor, { touches: [], changedTouches: [point(170, 100)] })
    Object.defineProperty(start, 'timeStamp', { value: 100 })
    Object.defineProperty(end, 'timeStamp', { value: 1500 })
    fireEvent(editor, start)
    fireEvent(editor, end)
    expect(onClose).not.toHaveBeenCalled()
  })
})
