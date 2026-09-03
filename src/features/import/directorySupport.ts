export function supportsDirectorySelection(userAgent: string, attributeSupported: boolean): boolean {
  if (!attributeSupported) return false
  const isIos = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && /Mobile\//.test(userAgent))
  if (!isIos) return true
  const version = userAgent.match(/(?:OS |Version\/)(\d+)[._](\d+)/)
  if (!version) return false
  const major = Number(version[1])
  const minor = Number(version[2])
  return major > 18 || (major === 18 && minor >= 4)
}
