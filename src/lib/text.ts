export function normalizeText(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('zh-CN')
}

export function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]
}

export function excerptText(value: string, max = 100) {
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}
