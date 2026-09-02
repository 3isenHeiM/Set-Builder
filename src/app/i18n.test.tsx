import { render, screen } from '@testing-library/react'
import { makeScore } from '../test/fixtures'
import { GenerateScreen } from '../features/generator/GenerateScreen'
import { FolderPicker } from '../features/import/FolderPicker'
import { detectLocale, localizedKnownMessage } from './i18n'

describe('browser language', () => {
  it('selects French only for French browser locales', () => {
    expect(detectLocale('fr')).toBe('fr')
    expect(detectLocale('fr-BE')).toBe('fr')
    expect(detectLocale('en-FR')).toBe('en')
    expect(detectLocale('de')).toBe('en')
  })

  it('renders the interface and domain messages in French', () => {
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('fr-BE')
    render(<FolderPicker mode="import" directorySupport onSnapshot={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Importer les morceaux de ce dossier' })).toBeVisible()

    render(<GenerateScreen scores={[makeScore()]} hasPerformance={false} onGenerated={vi.fn(() => Promise.resolve())} />)
    expect(screen.getByRole('heading', { name: 'Créer des sets' })).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('Il faut 24 morceaux éligibles')
  })

  it('translates validation messages with their details', () => {
    expect(localizedKnownMessage('Score number 7 has no name.', 'fr')).toBe('Le numéro 7 n’a pas de nom.')
  })
})
