// Busca IGP-M e IPCA do BACEN SGS com cache em memória (TTL 6h).
// Fonte: series mensais (189 = IGP-M, 433 = IPCA). Compõe N valores
// mensais para obter o acumulado do período do contrato.

const BACEN_SERIES: Record<string, string> = {
  IGPM: '189',
  IPCA: '433',
}

const cache: Record<string, { pct: number; ref: string; fetchedAt: number }> = {}
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6h

export type IndiceResult = {
  pct: number    // acumulado no período (%), pronto para pre-preencher o campo
  ref: string    // ex: "abril de 2026" — mês mais recente disponível
  source: 'bacen' | 'fallback'
}

export async function getAdjustmentIndex(
  index: 'IGPM' | 'IPCA',
  periodMonths: number
): Promise<IndiceResult> {
  const key = `${index}_${periodMonths}`
  const now = Date.now()
  if (cache[key] && now - cache[key].fetchedAt < CACHE_TTL_MS) {
    return { pct: cache[key].pct, ref: cache[key].ref, source: 'bacen' }
  }

  const serie = BACEN_SERIES[index]
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/${periodMonths}?formato=json`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const rows: { data: string; valor: string }[] = await res.json()
    if (!rows.length) throw new Error('empty')

    // Composição geométrica dos retornos mensais
    const pct = (rows.reduce((acc, r) => acc * (1 + parseFloat(r.valor) / 100), 1) - 1) * 100

    const last = rows[rows.length - 1]
    const [dd, mm, yyyy] = last.data.split('/')
    const ref = new Date(+yyyy, +mm - 1, +dd)
      .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    cache[key] = { pct, ref, fetchedAt: now }
    return { pct, ref, source: 'bacen' }
  } catch {
    return { pct: 0, ref: '', source: 'fallback' }
  }
}
