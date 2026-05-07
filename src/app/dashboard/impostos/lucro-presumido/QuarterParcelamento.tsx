'use client'

import { useState } from 'react'
import type { ParcelamentoResult } from '../../../../lib/fiscal/parcelamento'

interface Props {
  quarter: string    // "Q1"
  year: number
  bruto: number
  csll: number
  irpj: number
  total: number
  due: string        // vencimento à vista (DD/MM/YYYY)
  months: string[]   // ex: ["2025-01","2025-02","2025-03"]
  parcelamento2: ParcelamentoResult
  parcelamento3: ParcelamentoResult
  selicAnual: number
  fmt: (v: number) => string
  fmtPct: (v: number) => string
}

type Mode = 'avista' | '2quotas' | '3quotas'

export default function QuarterParcelamento({
  quarter, year, bruto, csll, irpj, total, due, months,
  parcelamento2, parcelamento3, selicAnual, fmt, fmtPct,
}: Props) {
  const [mode, setMode] = useState<Mode>('avista')

  const btnBase: React.CSSProperties = {
    fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px',
    cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
  }
  const btn = (active: boolean, color = '#fb923c'): React.CSSProperties => ({
    ...btnBase,
    background: active ? `${color}22` : 'transparent',
    borderColor: active ? color : 'rgba(255,255,255,0.1)',
    color: active ? color : 'var(--text-muted)',
  })

  const activeResult = mode === '2quotas' ? parcelamento2 : mode === '3quotas' ? parcelamento3 : null

  const monthLabels = months
    .map(m => new Date(m + '-01').toLocaleDateString('pt-BR', { month: 'short' }))
    .join(', ')

  return (
    <>
      {/* Linha principal da tabela */}
      <tr style={{ borderBottom: activeResult ? 'none' : '1px solid rgba(255,255,255,0.03)' }}>
        <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>
          {quarter} / {year}
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '6px' }}>
            ({monthLabels})
          </span>
        </td>
        <td style={{ padding: '7px 10px', color: 'var(--text-secondary)', textAlign: 'right' }}>{fmt(bruto)}</td>
        <td style={{ padding: '7px 10px', color: '#34d399', textAlign: 'right' }}>{fmt(csll)}</td>
        <td style={{ padding: '7px 10px', color: '#fb923c', textAlign: 'right' }}>{fmt(irpj)}</td>
        <td style={{ padding: '7px 10px', color: 'white', fontWeight: 600, textAlign: 'right' }}>{fmt(total)}</td>
        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
            <span style={{ color: mode === 'avista' ? 'white' : 'var(--text-muted)', fontSize: '12px' }}>{due}</span>
            {/* Toggle de parcelamento */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button style={btn(mode === 'avista')} onClick={() => setMode('avista')}>À vista</button>
              <button
                style={btn(mode === '2quotas')}
                onClick={() => setMode('2quotas')}
                disabled={!parcelamento2.parcelavel}
                title={!parcelamento2.parcelavel ? parcelamento2.motivo : undefined}
              >2×</button>
              <button
                style={btn(mode === '3quotas')}
                onClick={() => setMode('3quotas')}
                disabled={!parcelamento3.parcelavel}
                title={!parcelamento3.parcelavel ? parcelamento3.motivo : undefined}
              >3×</button>
            </div>
          </div>
        </td>
      </tr>

      {/* Linha expandida com detalhamento das quotas */}
      {activeResult?.parcelavel && (
        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: 'rgba(251,146,60,0.03)' }}>
          <td colSpan={6} style={{ padding: '0 10px 10px 10px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              {activeResult.quotas.map(q => (
                <div
                  key={q.numero}
                  style={{
                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(251,146,60,0.2)',
                    borderRadius: '10px', padding: '10px 14px', minWidth: '160px',
                  }}
                >
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#fb923c', margin: '0 0 4px', textTransform: 'uppercase' }}>
                    {q.numero}ª Quota
                  </p>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: 'white', margin: '0 0 2px' }}>
                    {fmt(q.total)}
                  </p>
                  {q.juros > 0 ? (
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 0 4px' }}>
                      Base {fmt(q.base)} + juros {fmt(q.juros)}
                    </p>
                  ) : (
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 0 4px' }}>sem acréscimo</p>
                  )}
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>Vence {q.due}</p>
                </div>
              ))}

              {/* Resumo */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '10px 14px', borderLeft: '1px solid rgba(255,255,255,0.06)', marginLeft: '4px' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 2px' }}>Total com juros</p>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#fb923c', margin: '0 0 4px' }}>{fmt(activeResult.totalComJuros)}</p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>
                  Selic {fmtPct(selicAnual)} a.a. · acréscimo {fmt(activeResult.totalComJuros - total)}
                </p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  Lei 9.430/96, art. 5°
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}

      {/* Linha de aviso quando não parcelável */}
      {mode !== 'avista' && activeResult && !activeResult.parcelavel && (
        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <td colSpan={6} style={{ padding: '0 10px 8px 10px' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
              {activeResult.motivo}
            </p>
          </td>
        </tr>
      )}
    </>
  )
}
