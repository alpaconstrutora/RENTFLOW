import styles from '../../page.module.css'
import { createClientWithUser } from '../../../utils/supabase/server'
import Link from 'next/link'
import { Calculator, ChevronRight, Landmark, Building2, GitCompare } from 'lucide-react'

export default async function ImpostosPage() {
  const { supabase, user } = await createClientWithUser()
  const { data: todayStr } = await supabase.rpc('user_today', { p_user_id: user?.id })
  const currentMonth = ((todayStr as string) || new Date().toISOString()).slice(0, 7)

  const cards = [
    {
      href:    `/dashboard/impostos/carne-leao/${currentMonth}`,
      icon:    <Calculator size={22} color="#818cf8" />,
      iconBg:  'rgba(99,102,241,0.15)',
      border:  'rgba(99,102,241,0.25)',
      bg:      'rgba(99,102,241,0.08)',
      accent:  '#818cf8',
      title:   'Carnê-Leão IRPF',
      desc:    'Apuração mensal — regime de caixa. Faixas progressivas, deduções e IRRF retido na fonte.',
      badge:   null,
    },
    {
      href:    '/dashboard/impostos/lucro-presumido',
      icon:    <Building2 size={22} color="#f472b6" />,
      iconBg:  'rgba(244,114,182,0.12)',
      border:  'rgba(244,114,182,0.25)',
      bg:      'rgba(244,114,182,0.05)',
      accent:  '#f472b6',
      title:   'Lucro Presumido — PJ',
      desc:    'PIS, COFINS, CSLL e IRPJ sobre receitas de aluguel. Base de presunção 32% (Lei 9.249/95).',
      badge:   null,
    },
    {
      href:    '/dashboard/impostos/ibs-cbs',
      icon:    <Landmark size={22} color="#94a3b8" />,
      iconBg:  'rgba(148,163,184,0.1)',
      border:  'rgba(148,163,184,0.15)',
      bg:      'rgba(0,0,0,0.2)',
      accent:  '#94a3b8',
      title:   'IBS / CBS',
      desc:    'Estimativa de retenção automática sobre receitas. Configuração de alíquotas e simulador anual.',
      badge:   'Legado',
    },
    {
      href:    '/dashboard/impostos/simulador',
      icon:    <GitCompare size={22} color="#34d399" />,
      iconBg:  'rgba(52,211,153,0.12)',
      border:  'rgba(52,211,153,0.25)',
      bg:      'rgba(52,211,153,0.05)',
      accent:  '#34d399',
      title:   'Simulador PF × PJ',
      desc:    'Compare Carnê-Leão IRPF com Lucro Presumido. Encontre o ponto de equilíbrio para a sua receita.',
      badge:   null,
    },
  ]

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Tributos e Impostos</h1>
          <p className={styles.subtitle}>Selecione o módulo tributário.</p>
        </div>
      </header>

      {/* Calendário tributário */}
      <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '20px 24px', maxWidth: '800px', marginBottom: '4px' }}>
        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
          Calendário de Vencimentos
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Tributo', 'Responsável', 'Regime', 'Vencimento'].map(h => (
                <th key={h} style={{ padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 500, textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { tributo: 'IRRF',         badge: '#fb923c', resp: 'PJ locatária retém',    regime: 'Paga para locador PF',  venc: 'Até o dia 20 do mês seguinte',        note: 'Cód. 3208 · 2º decêndio — antecipa se fim de semana/feriado' },
              { tributo: 'PIS / COFINS', badge: '#f472b6', resp: 'PJ locadora recolhe',   regime: 'Lucro Presumido',       venc: 'Dia 25 do mês seguinte',              note: 'Antecipa para dia útil anterior se não-útil' },
              { tributo: 'CSLL / IRPJ',  badge: '#34d399', resp: 'PJ locadora recolhe',   regime: 'Lucro Presumido',       venc: 'Último dia útil pós-trimestre',       note: 'Trimestral: 30/04 · 31/07 · 31/10 · 31/01 (com antecipação)' },
              { tributo: 'Carnê-Leão',   badge: '#818cf8', resp: 'PF locadora recolhe',   regime: 'Sem retenção na fonte', venc: 'Último dia útil do mês seguinte',     note: 'Antecipa para dia útil anterior se não-útil' },
            ].map(r => (
              <tr key={r.tributo} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ background: `${r.badge}22`, border: `1px solid ${r.badge}44`, color: r.badge, fontWeight: 700, fontSize: '11px', padding: '2px 8px', borderRadius: '6px' }}>
                    {r.tributo}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', color: 'white', fontWeight: 500 }}>{r.resp}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{r.regime}</td>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{r.venc}</span>
                  <br />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{r.note}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '10px 0 0' }}>
          Regra federal: antecipação para o dia útil anterior quando o vencimento cair em fim de semana ou feriado bancário nacional. Calendário calculado com base em feriados do Banco Central.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '800px' }}>
        {cards.map(c => (
          <Link key={c.href} href={c.href} style={{ textDecoration: 'none' }}>
            <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ background: c.iconBg, borderRadius: '12px', padding: '12px', display: 'flex', flexShrink: 0 }}>
                  {c.icon}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <p style={{ margin: 0, color: 'white', fontWeight: 600, fontSize: '16px' }}>{c.title}</p>
                    {c.badge && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {c.badge}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>{c.desc}</p>
                </div>
              </div>
              <ChevronRight size={20} color={c.accent} style={{ flexShrink: 0 }} />
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
