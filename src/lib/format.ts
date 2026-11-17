export default function fmtAmount(amount?: string, currency?: string) {
  if (amount == null || amount === '') return '—'
  const n = Number(amount)
  if (Number.isNaN(n)) return `${amount} ${currency || ''}`.trim()
  try {
    return new Intl.NumberFormat('it-IT', {
      style: currency ? 'currency' : 'decimal',
      currency: currency || undefined,
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return `${amount} ${currency || ''}`.trim()
  }
}
