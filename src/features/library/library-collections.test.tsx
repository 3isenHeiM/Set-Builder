import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeScore } from '../../test/fixtures'
import { LibraryScreen } from './LibraryScreen'

function fixture() {
  const scores = [
    makeScore({ id: 'general', title: 'Take On Me' }),
    makeScore({ id: 'missing', scoreNumber: 2, displayNumber: '02', title: 'Missing piece', availability: 'missing' }),
    makeScore({ id: 'bells', scoreNumber: 'A', displayNumber: 'A', title: 'Bells', collection: 'Christmas' }),
    makeScore({ id: 'noel', scoreNumber: 'B', displayNumber: 'B', title: 'Noël', collection: 'Christmas', enabled: false }),
  ]
  return { scores, collections: ['General', 'Christmas', 'Summer'], lastScan: undefined, onFolder: vi.fn(), onSave: vi.fn(() => Promise.resolve()) }
}

describe('Library collection browsing', () => {
  it('starts with compact groups, supports keyboard expansion, and preserves the opened group after editing', async () => {
    const user = userEvent.setup()
    render(<LibraryScreen {...fixture()} />)
    const general = screen.getByRole('button', { name: /General 2 pieces/ })
    const christmas = screen.getByRole('button', { name: /Christmas 2 pieces/ })
    expect(general).toHaveAttribute('aria-expanded', 'false')
    expect(christmas).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: /Take On Me/ })).not.toBeInTheDocument()
    general.focus()
    await user.keyboard('{Enter}')
    expect(general).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('button', { name: /Take On Me/ }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('button', { name: /General 2 pieces/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Christmas 2 pieces/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /Take On Me/ })).toHaveFocus()
  })

  it('combines collection, search, and status filters and clears them in one action', async () => {
    const user = userEvent.setup()
    render(<LibraryScreen {...fixture()} />)
    const collection = screen.getByRole('combobox', { name: 'Collection' })
    expect(collection.closest('details')).toBeNull()
    await user.selectOptions(collection, 'Christmas')
    expect(screen.getByRole('button', { name: /Bells/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /Noël/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: /Take On Me/ })).not.toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'Bells')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'disabled')
    expect(screen.getByText('No matches.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(collection).toHaveValue('')
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('all')
    expect(screen.getByRole('button', { name: /Christmas 2 pieces/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows search and status matches immediately and targets an empty collection for import', async () => {
    const user = userEvent.setup()
    render(<LibraryScreen {...fixture()} />)
    const search = screen.getByRole('searchbox')
    await user.type(search, 'Bells')
    expect(screen.getByRole('button', { name: /Bells/ })).toBeVisible()
    await user.clear(search)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'missing')
    expect(screen.getByRole('button', { name: /Missing piece/ })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Collection' }), 'Summer')
    expect(screen.getByText('No matches.')).toBeVisible()
    await user.click(screen.getByText('Manage library', { selector: 'summary span' }))
    await user.click(screen.getByText('Import pieces', { selector: 'summary' }))
    expect(screen.getByRole('combobox', { name: 'Import into collection' })).toHaveValue('Summer')
  })

  it('keeps selection across groups and shows a count on collapsed groups before applying a bulk edit', async () => {
    const user = userEvent.setup()
    const props = fixture()
    const frozen = structuredClone(props.scores)
    const onBulkSave = vi.fn(() => Promise.resolve())
    render(<LibraryScreen {...props} onBulkSave={onBulkSave} />)
    await user.click(screen.getByRole('button', { name: 'Select pieces' }))
    await user.click(screen.getByRole('button', { name: /General 2 pieces/ }))
    await user.click(screen.getByRole('button', { name: /Take On Me/ }))
    await user.click(screen.getByRole('button', { name: /Christmas 2 pieces/ }))
    await user.click(screen.getByRole('button', { name: /Bells/ }))
    await user.click(screen.getByRole('button', { name: /Christmas 2 pieces/ }))
    expect(screen.getByRole('button', { name: /Christmas 2 pieces/ })).toHaveTextContent('1 selected')
    expect(screen.getByRole('status')).toHaveTextContent('2 selected')
    await user.click(screen.getByRole('button', { name: 'Edit settings' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Drums intro' }), 'true')
    await user.click(screen.getByRole('button', { name: 'Apply to selected' }))
    expect(onBulkSave).toHaveBeenCalledWith(['general', 'bells'], { drumsIntro: true })
    expect(await screen.findByRole('button', { name: 'Select pieces' })).toBeVisible()
    expect(props.scores).toEqual(frozen)
  })

  it('opens a single collection directly and provides French filter controls', async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-BE')
    const user = userEvent.setup()
    render(<LibraryScreen scores={[makeScore({ collection: ' general ' })]} lastScan={undefined} onFolder={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Take On Me/ })).toBeVisible()
    expect(screen.getByText('Gérer la bibliothèque')).toBeVisible()
    await user.type(screen.getByRole('searchbox', { name: 'Rechercher' }), 'inconnu')
    expect(screen.getByText('Aucun résultat.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Effacer les filtres' }))
    expect(screen.getByRole('button', { name: /Take On Me/ })).toBeVisible()
  })
})
