import type {
  DuplicateScoreNumber,
  FolderSnapshot,
  MalformedReason,
  MalformedScoreFile,
  ParsedScoreFile,
} from './types'

export type ParseScoreFileResult =
  | { ok: true; value: ParsedScoreFile }
  | { ok: false; reason: MalformedReason }

export interface FileMetadata {
  readonly name: string
  readonly webkitRelativePath?: string
}

const finalMsczExtension = /\.mscz$/i
const contract = /^\s*(\d+)\s*-\s*(.+?)\s*\.mscz$/i

export function parseScoreFileName(fileName: string, relativePath = fileName): ParseScoreFileResult {
  if (!finalMsczExtension.test(fileName)) return { ok: false, reason: 'not-mscz' }

  const match = contract.exec(fileName)
  if (!match) {
    const withoutExtension = fileName.replace(finalMsczExtension, '')
    if (/^\s*(?:-\d+|0+)\s*-/.test(withoutExtension)) {
      return { ok: false, reason: 'non-positive-number' }
    }
    if (/^\s*\d+\s*-\s*$/.test(withoutExtension)) return { ok: false, reason: 'empty-title' }
    return { ok: false, reason: 'invalid-format' }
  }

  const displayNumber = match[1]
  const title = match[2]?.trim()
  if (!displayNumber) return { ok: false, reason: 'invalid-format' }
  if (!title) return { ok: false, reason: 'empty-title' }
  const scoreNumber = Number(displayNumber)
  if (!Number.isSafeInteger(scoreNumber)) return { ok: false, reason: 'number-too-large' }
  if (scoreNumber <= 0) return { ok: false, reason: 'non-positive-number' }

  return {
    ok: true,
    value: { scoreNumber, displayNumber, title, fileName, relativePath },
  }
}

export function buildFolderSnapshot(files: Iterable<FileMetadata>, scannedAt: string): FolderSnapshot {
  const parsed: ParsedScoreFile[] = []
  const malformed: MalformedScoreFile[] = []
  let ignoredCount = 0

  for (const file of files) {
    const relativePath = file.webkitRelativePath || file.name
    const result = parseScoreFileName(file.name, relativePath)
    if (result.ok) parsed.push(result.value)
    else if (result.reason === 'not-mscz') ignoredCount += 1
    else malformed.push({ fileName: file.name, relativePath, reason: result.reason })
  }

  const byNumber = new Map<number, ParsedScoreFile[]>()
  for (const file of parsed) {
    const group = byNumber.get(file.scoreNumber) ?? []
    group.push(file)
    byNumber.set(file.scoreNumber, group)
  }

  const duplicates: DuplicateScoreNumber[] = []
  const valid: ParsedScoreFile[] = []
  for (const [scoreNumber, group] of byNumber) {
    if (group.length > 1) duplicates.push({ scoreNumber, files: group })
    else {
      const only = group[0]
      if (only) valid.push(only)
    }
  }

  valid.sort((a, b) => a.scoreNumber - b.scoreNumber || a.title.localeCompare(b.title))
  duplicates.sort((a, b) => a.scoreNumber - b.scoreNumber)
  return { scannedAt, valid, malformed, duplicates, ignoredCount }
}
