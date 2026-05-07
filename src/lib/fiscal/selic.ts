// Adapter para taxa Selic meta (BACEN — Série SGS 4189)
// Retorna taxa anual como decimal (ex: 0.1475 para 14.75% a.a.)
// Nunca exposta diretamente nas páginas — sempre via funções deste módulo.

const BACEN_URL =
  'https://api.bcb.gov.br/dados/serie/bcdata.sgs.4189/dados/ultimos/1?formato=json'

// Fallback conservador caso BACEN esteja indisponível.
// Atualizar junto com LAST_RULE_REVIEW quando a taxa mudar.
export const SELIC_FALLBACK_AA = 0.1475 // 14.75% a.a.

export async function getSelicAnual(): Promise<{ value: number; source: 'bacen' | 'fallback' }> {
  try {
    const res = await fetch(BACEN_URL, {
      next: { revalidate: 21600 }, // cache 6h no Next.js Data Cache
    })
    if (!res.ok) throw new Error(`BACEN HTTP ${res.status}`)
    const data = (await res.json()) as [{ data: string; valor: string }]
    const raw = data[0]?.valor
    if (!raw) throw new Error('Resposta BACEN sem valor')
    return { value: parseFloat(raw.replace(',', '.')) / 100, source: 'bacen' }
  } catch {
    return { value: SELIC_FALLBACK_AA, source: 'fallback' }
  }
}

// Converte taxa anual em taxa mensal equivalente (capitalização composta)
export function anualParaMensal(aa: number): number {
  return Math.pow(1 + aa, 1 / 12) - 1
}

// Formata taxa para exibição (ex: 1.18% a.m.)
export function formatSelicMensal(mensal: number): string {
  return `${(mensal * 100).toFixed(2)}% a.m.`
}

export function formatSelicAnual(aa: number): string {
  return `${(aa * 100).toFixed(2)}% a.a.`
}
