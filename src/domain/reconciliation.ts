import type {
  FolderScan,
  FolderSnapshot,
  ParsedScoreFile,
  ReconciliationPlan,
  RenumberingDecisions,
  Score,
} from './types'

export const EIGHTIES_TAG = '80s'

/** NFKC + lower case is used only for renumbering suggestions; display titles are preserved. */
export function normalizeTitle(title: string): string {
  return title.trim().normalize('NFKC').toLocaleLowerCase('en')
}

function possibleId(scoreId: string, file: ParsedScoreFile): string {
  return `${scoreId}:${file.scoreNumber}:${file.relativePath}`
}

export function classifyReconciliation(snapshot: FolderSnapshot, existing: readonly Score[]): ReconciliationPlan {
  const byNumber = new Map(existing.map((score) => [score.scoreNumber, score]))
  // A conflicted number is present but untrusted: preserve any matching database record unchanged.
  const incomingNumbers = new Set([
    ...snapshot.valid.map((file) => file.scoreNumber),
    ...snapshot.duplicates.map((duplicate) => duplicate.scoreNumber),
  ])
  const absentExisting = existing.filter((score) => !incomingNumbers.has(score.scoreNumber))
  const absentByTitle = new Map<string, Score[]>()
  const incomingTitleCounts = new Map<string, number>()
  for (const file of snapshot.valid) {
    const title = normalizeTitle(file.title)
    incomingTitleCounts.set(title, (incomingTitleCounts.get(title) ?? 0) + 1)
  }
  for (const score of absentExisting) {
    const title = normalizeTitle(score.title)
    absentByTitle.set(title, [...(absentByTitle.get(title) ?? []), score])
  }

  const unchanged = []
  const renamed = []
  const added = []
  const reappeared = []
  const possibleRenumberings = []

  for (const file of snapshot.valid) {
    const current = byNumber.get(file.scoreNumber)
    if (current) {
      const change = { scoreId: current.id, file }
      if (current.title !== file.title) renamed.push(change)
      else if (current.availability === 'missing') reappeared.push(change)
      else unchanged.push(change)
      continue
    }

    const titleMatches = absentByTitle.get(normalizeTitle(file.title)) ?? []
    if (titleMatches.length === 1 && incomingTitleCounts.get(normalizeTitle(file.title)) === 1) {
      const oldScore = titleMatches[0]
      if (oldScore) {
        possibleRenumberings.push({
          id: possibleId(oldScore.id, file),
          scoreId: oldScore.id,
          oldScoreNumber: oldScore.scoreNumber,
          oldDisplayNumber: oldScore.displayNumber,
          file,
        })
        continue
      }
    }
    added.push({ file })
  }

  return {
    scannedAt: snapshot.scannedAt,
    unchanged,
    renamed,
    added,
    missing: absentExisting.map((score) => ({
      scoreId: score.id,
      scoreNumber: score.scoreNumber,
      displayNumber: score.displayNumber,
      title: score.title,
    })),
    reappeared,
    possibleRenumberings,
    malformed: snapshot.malformed,
    duplicates: snapshot.duplicates,
    ignoredCount: snapshot.ignoredCount,
  }
}

function createScore(file: ParsedScoreFile, now: string, id: string): Score {
  return {
    id,
    ...file,
    availability: 'active',
    configuration: 'pending',
    canStart: null,
    hotness: null,
    drumsIntro: null,
    goesHigh: null,
    enabled: true,
    tags: [],
    firstImportedAt: now,
    lastSeenAt: now,
    updatedAt: now,
  }
}

function markSeen(score: Score, file: ParsedScoreFile, now: string): Score {
  return { ...score, ...file, availability: 'active', lastSeenAt: now, updatedAt: now }
}

export interface AppliedReconciliation {
  scores: Score[]
  scan: FolderScan
}

export function applyReconciliation(
  existing: readonly Score[],
  plan: ReconciliationPlan,
  decisions: RenumberingDecisions,
  appliedAt: string,
  createId: () => string,
  scanId: string,
): AppliedReconciliation {
  for (const suggestion of plan.possibleRenumberings) {
    if (!decisions[suggestion.id]) throw new Error('Resolve every possible renumbering before applying changes.')
  }

  const byId = new Map(existing.map((score) => [score.id, { ...score, tags: [...score.tags] }]))
  const get = (id: string): Score => {
    const score = byId.get(id)
    if (!score) throw new Error(`Score ${id} no longer exists. Scan the folder again.`)
    return score
  }

  for (const change of [...plan.unchanged, ...plan.renamed, ...plan.reappeared]) {
    byId.set(change.scoreId, markSeen(get(change.scoreId), change.file, appliedAt))
  }

  for (const change of plan.added) {
    const id = createId()
    byId.set(id, createScore(change.file, appliedAt, id))
  }

  const renumberedIds = new Set<string>()
  let addNewRenumberings = 0
  for (const suggestion of plan.possibleRenumberings) {
    if (decisions[suggestion.id] === 'same-score') {
      byId.set(suggestion.scoreId, markSeen(get(suggestion.scoreId), suggestion.file, appliedAt))
      renumberedIds.add(suggestion.scoreId)
    } else {
      const id = createId()
      byId.set(id, createScore(suggestion.file, appliedAt, id))
      addNewRenumberings += 1
    }
  }

  for (const change of plan.missing) {
    if (renumberedIds.has(change.scoreId)) continue
    const current = get(change.scoreId)
    if (current.availability !== 'missing') {
      byId.set(change.scoreId, { ...current, availability: 'missing', updatedAt: appliedAt })
    }
  }

  const scores = [...byId.values()].sort((a, b) => a.scoreNumber - b.scoreNumber || a.id.localeCompare(b.id))
  const duplicateFiles = plan.duplicates.reduce((total, conflict) => total + conflict.files.length, 0)
  return {
    scores,
    scan: {
      id: scanId,
      kind: existing.length === 0 ? 'import' : 'realignment',
      scannedAt: plan.scannedAt,
      appliedAt,
      summary: {
        unchanged: plan.unchanged.length,
        renamed: plan.renamed.length,
        added: plan.added.length + addNewRenumberings,
        missing: plan.missing.filter((change) => !renumberedIds.has(change.scoreId)).length,
        reappeared: plan.reappeared.length,
        renumbered: renumberedIds.size,
        malformed: plan.malformed.length,
        duplicateFiles,
        ignored: plan.ignoredCount,
      },
    },
  }
}
