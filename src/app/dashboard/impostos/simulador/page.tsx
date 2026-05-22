import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import styles from '../../../../app/page.module.css'
import { createClient } from '../../../../utils/supabase/server'
import { getCurrentUserId } from '../../../../utils/supabase/user'
import SimuladorClient from './SimuladorClient'
import type { IrpfBracket, SimuladorPJRates } from '../../../../lib/fiscal/simulador'

export default async function SimuladorPage() {
  const userId = await getCurrentUserId()
  if (!userId) redirect('/login')

  const supabase = await createClient()

  // Faixas IRPF vigentes hoje (mais recentes)
  const { data: bracketsRaw } = await supabase
    .from('irpf_brackets')
    .select('min_income, max_income, rate, deduction, effective_from')
    .order('effective_from', { ascending: false })
    .order('min_income',     { ascending: true })

  // Pega o effective_from mais recente e filtra só aquelas faixas
  const latestFrom = bracketsRaw?.[0]?.effective_from ?? null
  const brackets: IrpfBracket[] = (bracketsRaw ?? [])
    .filter(b => b.effective_from === latestFrom)
    .map(b => ({
      min_income: Number(b.min_income),
      max_income: b.max_income !== null ? Number(b.max_income) : null,
      rate:       Number(b.rate),
      deduction:  Number(b.deduction),
    }))

  // Alíquotas PJ do usuário (fallback para defaults se não configurado)
  const { data: pjConfig } = await supabase
    .from('pj_tax_config')
    .select('pis_rate, cofins_rate, csll_rate, irpj_rate')
    .eq('user_id', userId)
    .maybeSingle()

  const rates: SimuladorPJRates = {
    pisRate:    pjConfig ? Number(pjConfig.pis_rate)    : undefined,
    cofinsRate: pjConfig ? Number(pjConfig.cofins_rate) : undefined,
    csllRate:   pjConfig ? Number(pjConfig.csll_rate)   : undefined,
    irpjRate:   pjConfig ? Number(pjConfig.irpj_rate)   : undefined,
  }

  const bracketYear = latestFrom
    ? new Date(latestFrom).getFullYear()
    : new Date().getFullYear()

  return (
    <>
      <header className={styles.header}>
        <div>
          <Link
            href="/dashboard/impostos"
            style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}
          >
            <ArrowLeft size={14} /> Tributos e Impostos
          </Link>
          <h1 className={styles.title}>Simulador PF × PJ</h1>
          <p className={styles.subtitle}>Compare a carga tributária entre Carnê-Leão e Lucro Presumido.</p>
        </div>
      </header>

      <SimuladorClient
        brackets={brackets}
        rates={rates}
        bracketYear={bracketYear}
      />
    </>
  )
}
