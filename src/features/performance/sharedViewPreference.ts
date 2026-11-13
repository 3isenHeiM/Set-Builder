const DRUMMER_NOTES_PREFERENCE = 'piece-selector-shared-drummer-notes'

export function readDrummerNotesPreference(): boolean {
  try { return localStorage.getItem(DRUMMER_NOTES_PREFERENCE) === 'true' }
  catch { return false }
}

export function saveDrummerNotesPreference(enabled: boolean): void {
  try { localStorage.setItem(DRUMMER_NOTES_PREFERENCE, String(enabled)) }
  catch { /* The in-memory toggle remains usable when browser storage is unavailable. */ }
}
