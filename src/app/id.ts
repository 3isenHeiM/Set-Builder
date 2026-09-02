export function createLocalId(): string {
  return crypto.randomUUID()
}

export function createSeed(): number {
  const value = new Uint32Array(1)
  crypto.getRandomValues(value)
  return value[0] ?? 0
}
