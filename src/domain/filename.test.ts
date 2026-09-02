import { buildFolderSnapshot, parseScoreFileName, type FileMetadata } from './filename'

describe('parseScoreFileName', () => {
  it('parses the filename contract and preserves display zeroes', () => {
    expect(parseScoreFileName('01 - Take On Me.mscz')).toEqual({
      ok: true,
      value: {
        scoreNumber: 1,
        displayNumber: '01',
        title: 'Take On Me',
        fileName: '01 - Take On Me.mscz',
        relativePath: '01 - Take On Me.mscz',
      },
    })
  })

  it.each([
    ['  2-  Ça plane pour moi.MSCZ', 2, '2', 'Ça plane pour moi'],
    ['1000   -   永遠に.mscz', 1000, '1000', '永遠に'],
    ['0009 - Billie Jean.mscz', 9, '0009', 'Billie Jean'],
  ])('accepts whitespace, Unicode and extension case in %s', (name, number, display, title) => {
    const result = parseScoreFileName(name)
    expect(result).toMatchObject({ ok: true, value: { scoreNumber: number, displayNumber: display, title } })
  })

  it.each([
    ['0 - Zero.mscz', 'non-positive-number'],
    ['-1 - Negative.mscz', 'non-positive-number'],
    ['No number.mscz', 'invalid-format'],
    ['01 _ No.mscz', 'invalid-format'],
    ['01 -   .mscz', 'empty-title'],
    ['01 Take On Me.mscz', 'invalid-format'],
    ['01 - Take On Me.mscz.backup', 'not-mscz'],
  ])('rejects %s with a typed reason', (name, reason) => {
    expect(parseScoreFileName(name)).toEqual({ ok: false, reason })
  })
})

describe('buildFolderSnapshot', () => {
  it('retains relative paths, skips non-mscz files and never reads content', () => {
    const metadataOnlyFile: FileMetadata & { text: () => never; arrayBuffer: () => never; stream: () => never } = {
      name: '12 - Africa.mscz',
      webkitRelativePath: 'Band/Nested/12 - Africa.mscz',
      text: () => {
        throw new Error('content read')
      },
      arrayBuffer: () => {
        throw new Error('content read')
      },
      stream: () => {
        throw new Error('content read')
      },
    }
    const snapshot = buildFolderSnapshot([metadataOnlyFile, { name: 'notes.txt' }], 'now')
    expect(snapshot.valid[0]?.relativePath).toBe('Band/Nested/12 - Africa.mscz')
    expect(snapshot.ignoredCount).toBe(1)
  })

  it('reports all files with a duplicate numeric number and excludes them from valid entries', () => {
    const snapshot = buildFolderSnapshot(
      [{ name: '02 - First.mscz' }, { name: '2 - Second.MSCZ' }, { name: '03 - Good.mscz' }],
      'now',
    )
    expect(snapshot.valid.map((file) => file.scoreNumber)).toEqual([3])
    expect(snapshot.duplicates[0]?.files.map((file) => file.fileName)).toEqual([
      '02 - First.mscz',
      '2 - Second.MSCZ',
    ])
  })
})
