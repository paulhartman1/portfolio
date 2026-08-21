// Masks an email address for display without revealing its real length,
// e.g. "first@gmail.com" -> "fi******st@gmail.com".
export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@')
  if (atIndex === -1) return email

  const local = email.slice(0, atIndex)
  const domain = email.slice(atIndex + 1)

  if (local.length <= 2) {
    return `${local[0] ?? ''}******@${domain}`
  }
  if (local.length <= 4) {
    return `${local.slice(0, 1)}******${local.slice(-1)}@${domain}`
  }

  return `${local.slice(0, 2)}******${local.slice(-2)}@${domain}`
}
