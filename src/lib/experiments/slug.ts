// Slug generation for experiments (URL-safe, unique per project).

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

// Given a base slug and the set of slugs already used within a project,
// return a unique slug by appending -2, -3, ... as needed.
export function uniqueSlug(base: string, existing: Iterable<string>): string {
  const used = new Set(existing)
  const root = base || 'experiment'
  if (!used.has(root)) return root
  let n = 2
  while (used.has(`${root}-${n}`)) n++
  return `${root}-${n}`
}
