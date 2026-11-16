import { useState } from 'react'
import { readDrummerNotesPreference, saveDrummerNotesPreference } from './sharedViewPreference'

export function useDrummerView(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(readDrummerNotesPreference)
  return [enabled, (next) => { setEnabled(next); saveDrummerNotesPreference(next) }]
}
