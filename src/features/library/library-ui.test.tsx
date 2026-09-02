import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeScore } from '../../test/fixtures'
import { LibraryScreen } from './LibraryScreen'

describe('library configuration UI', () => {
  it('shows empty onboarding with the filename contract', () => {
    render(<LibraryScreen scores={[]} lastScan={undefined} onFolder={vi.fn()} onSave={vi.fn(() => Promise.resolve())} />)
    expect(screen.getByRole('heading', { name: /Turn a scores folder/ })).toBeVisible()
    expect(screen.getByText(/01 - Take On Me.mscz/)).toBeVisible()
  })

  it('saves explicit configuration and advances the pending queue', async () => {
    const user = userEvent.setup()
    const scores = [
      makeScore({ id: 'one', configuration: 'pending', canStart: null, hotness: null, drumsIntro: null }),
      makeScore({ id: 'two', scoreNumber: 2, displayNumber: '02', title: 'Africa', configuration: 'pending', canStart: null, hotness: null, drumsIntro: null }),
    ]
    const onSave = vi.fn(() => Promise.resolve())
    render(<LibraryScreen scores={scores} lastScan={undefined} onFolder={vi.fn()} onSave={onSave} />)
    await user.click(screen.getByRole('button', { name: 'Configure 2' }))
    expect(screen.getByText('1 of 2')).toBeVisible()
    await user.click(within(screen.getByRole('group', { name: 'Can start a set?' })).getByRole('radio', { name: 'Yes' }))
    await user.click(within(screen.getByRole('group', { name: 'Hotness' })).getByRole('radio', { name: 'Hotness 3 of 3' }))
    await user.click(within(screen.getByRole('group', { name: 'Drums intro?' })).getByRole('radio', { name: 'No' }))
    await user.click(within(screen.getByRole('group', { name: 'Goes high?' })).getByRole('radio', { name: 'Yes' }))
    await user.click(screen.getByRole('button', { name: 'Save and next' }))
    expect(onSave).toHaveBeenCalledWith('one', expect.objectContaining({ canStart: true, hotness: 3, drumsIntro: false, goesHigh: true }))
    expect(screen.getByText('2 of 2')).toBeVisible()
  })
})
