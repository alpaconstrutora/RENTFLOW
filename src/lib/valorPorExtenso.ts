export function valorPorExtenso(valor: number): string {
  if (valor === 0) return 'zero reais'
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

  function grupo(n: number): string {
    if (n === 0) return ''
    if (n === 100) return 'cem'
    const c = Math.floor(n / 100)
    const resto = n % 100
    const d = Math.floor(resto / 10)
    const u = resto % 10
    const p: string[] = []
    if (c > 0) p.push(centenas[c])
    if (resto >= 10 && resto <= 19) p.push(especiais[resto - 10])
    else { if (d > 0) p.push(dezenas[d]); if (u > 0) p.push(unidades[u]) }
    return p.join(' e ')
  }

  const inteiro = Math.floor(valor)
  const centavos = Math.round((valor - inteiro) * 100)
  const partes: string[] = []
  const milhoes = Math.floor(inteiro / 1000000)
  if (milhoes > 0) partes.push(grupo(milhoes) + (milhoes === 1 ? ' milhão' : ' milhões'))
  const milhares = Math.floor((inteiro % 1000000) / 1000)
  if (milhares > 0) partes.push(grupo(milhares) + ' mil')
  const resto = inteiro % 1000
  if (resto > 0) partes.push(grupo(resto))
  let resultado = partes.join(' e ')
  if (inteiro === 1) resultado += ' real'
  else if (inteiro > 1) resultado += ' reais'
  if (centavos > 0) {
    if (inteiro > 0) resultado += ' e '
    resultado += grupo(centavos) + (centavos === 1 ? ' centavo' : ' centavos')
  }
  return resultado
}

export function formatBRL(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

export function formatDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('T')[0].split('-')
  return `${day}/${m}/${y}`
}

export function mesAno(billing: string | null) {
  if (!billing) return '—'
  const [y, m] = billing.split('T')[0].split('-')
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${meses[parseInt(m) - 1]} / ${y}`
}
