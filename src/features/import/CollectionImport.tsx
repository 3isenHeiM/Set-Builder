import { useId, useState } from 'react'
import { DEFAULT_COLLECTION, collectionKey, collectionName } from '../../domain/collections'
import type { FolderSnapshot } from '../../domain/types'
import { useI18n } from '../../app/i18n'
import { FolderPicker } from './FolderPicker'

export function CollectionImport({ collections, onSnapshot }: { collections: string[]; onSnapshot: (snapshot: FolderSnapshot) => void }) {
  const { t } = useI18n()
  const id = useId()
  const [collection, setCollection] = useState(DEFAULT_COLLECTION)
  const [mode, setMode] = useState<'add' | 'realign'>('add')
  const target = collectionName(collection)
  return <div className="collection-import">
    <label><span>{t('importCollection')}</span><input type="text" maxLength={120} list={id} value={collection} onChange={(event) => setCollection(event.target.value)} /></label>
    <datalist id={id}>{collections.map((name) => <option key={name} value={name} />)}</datalist>
    <p className="secondary">{t('collectionHelp')}</p>
    <label><span>{t('importMode')}</span><select value={mode} onChange={(event) => setMode(event.target.value === 'realign' ? 'realign' : 'add')}><option value="add">{t('addPieces')}</option><option value="realign">{t('realignCollection')}</option></select></label>
    {mode === 'realign' && <p className="notice">{t('realignCollectionHelp')}</p>}
    {collection.trim() && <FolderPicker mode={mode === 'add' ? 'import' : 'realign'} onSnapshot={(snapshot) => onSnapshot({ ...snapshot, collection: collections.find((name) => collectionKey(name) === collectionKey(target)) ?? target, mode })} />}
  </div>
}
