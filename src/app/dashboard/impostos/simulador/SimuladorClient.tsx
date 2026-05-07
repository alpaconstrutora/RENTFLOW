'use client'

import { useState, useMemo } from 'react'
import {
  calcSimuladorPF,
  calcSimuladorPJ,
  findBreakeven,
  type IrpfBracket,
  type SimuladorPJRates,
} from '../../../../lib/fiscal/simulador'
import {
  PIS_RATE_DEFAULT,
  COFINS_RATE_DEFAULT,
  CSLL_RATE_DEFAULT,
  IRPJ_RATE_DEFAULT,
  FISCAL_RULESET_VERSION,
  LAST_RULE_REVIEW,
} from '../../../../lib/fiscal/rules'

interface Props {
  brackets: IrpfBracket[]
  rates: SimuladorPJRates
  bracketYear: number
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`

function Slider({
  label, value, onChange, min, max, step, format,
}: {
  label: string; value: number; onChange: (v: number) => void
  min: number; max: number; step: number; format: (v: number) => string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</label>
        <span style={{ fontSize: '15px', fontWeight: 700, color: 'white' }}>{format(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#818cf8' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  )
}

function NumberInput({
  label, value, onChange, min, max, step, prefix, hint,
}: {
  label: string; value: number; onChange: (v: number) => void
  min?: number; max?: number; step?: number; prefix?: string; hint?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {prefix && <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{prefix}</span>}
        <input
          type="number"
          min={min} max={max} step={step ?? 100}
          value={value}
          onChange={e => onChange(Math.max(min ?? 0, Number(e.target.value)))}
          style={{
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '14px',
            fontWeight: 600, width: '140px', outline: 'none',
          }}
        />
      </div>
      {hint && <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  )
}

function ResultCard({
  label, value, sub, accent, isWinner,
}: {
  label: string; value: string; sub: string; accent: string; isWinner: boolean
}) {
  return (
    <div style={{
      flex: 1, background: isWinner ? `rgba(${accent},0.1)` : 'rgba(0,0,0,0.25)',
      border: `1px solid ${isWinner ? `rgba(${accent},0.35)` : 'rgba(255,255,255,0.07)'}`,
      borderRadius: '14px', padding: '20px 24px', position: 'relative', transition: 'all 0.2s',
    }}>
      {isWinner && (
        <span style={{
          position: 'absolute', top: '-10px', right: '16px',
          fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
          background: `rgb(${accent})`, color: 'black', padding: '3px 10px', borderRadius: '20px',
        }}>
          Mais vantajoso
        </span>
      )}
      <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ margin: '0 0 4px', fontSize: '26px', fontWeight: 800, color: isWinner ? `rgb(${accent})` : 'white' }}>
        {value}
      </p>
      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</p>
    </div>
  )
}

export default function SimuladorClient({ brackets, rates, bracketYear }: Props) {
  const [receitaMensal,       setReceitaMensal]       = useState(8000)
  const [deducoesMensais,     setDeducoesMensais]     = useState(1000)
  const [custoOperacionalMes, setCustoOperacionalMes] = useState(600)

  const pf  = useMemo(
    () => calcSimuladorPF(receitaMensal, deducoesMensais, brackets),
    [receitaMensal, deducoesMensais, brackets],
  )
  const pj  = useMemo(
    () => calcSimuladorPJ(receitaMensal, custoOperacionalMes, rates),
    [receitaMensal, custoOperacionalMes, rates],
  )
  const bk  = useMemo(
    () => findBreakeven(deducoesMensais, custoOperacionalMes, brackets, rates),
    [deducoesMensais, custoOperacionalMes, brackets, rates],
  )

  const pfWins  = pf.tributoAnual <= pj.totalBurdenAnual
  const economy = Math.abs(pf.tributoAnual - pj.totalBurdenAnual)

  const pisRate    = rates.pisRate    ?? PIS_RATE_DEFAULT
  const cofinsRate = rates.cofinsRate ?? COFINS_RATE_DEFAULT
  const csllRate   = rates.csllRate   ?? CSLL_RATE_DEFAULT
  const irpjRate   = rates.irpjRate   ?? IRPJ_RATE_DEFAULT

  const card: React.CSSProperties = {
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px', padding: '24px',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '860px' }}>

      {/* ── Inputs ───────────────────────────────────────────────── */}
      <div style={{ ...card }}>
        <p style={{ margin: '0 0 20px', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Parâmetros
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
          <NumberInput
            label="Receita mensal bruta"
            value={receitaMensal}
            onChange={setReceitaMensal}
            min={0} max={150000} step={500}
            prefix="R$"
            hint="Total de aluguéis recebidos por mês"
          />
          <NumberInput
            label="Deduções mensais (PF)"
            value={deducoesMensais}
            onChange={setDeducoesMensais}
            min={0} max={50000} step={100}
            prefix="R$"
            hint="IPTU, condomínio, taxas de adm. pagas pelo locador"
          />
          <NumberInput
            label="Custo operacional PJ/mês"
            value={custoOperacionalMes}
            onChange={setCustoOperacionalMes}
            min={0} max={10000} step={50}
            prefix="R$"
            hint="Contador, abertura/manutenção da empresa, etc."
          />
        </div>
      </div>

      {/* ── Resultado principal ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <ResultCard
          label="Carnê-Leão PF — carga anual"
          value={fmt(pf.tributoAnual)}
          sub={`Alíquota efetiva ${fmtPct(pf.aliquotaEfetiva)} sobre base de ${fmt(pf.baseMensal)}/mês`}
          accent="129,140,248"
          isWinner={pfWins}
        />
        <ResultCard
          label="Lucro Presumido PJ — carga anual"
          value={fmt(pj.totalBurdenAnual)}
          sub={`Tributos ${fmt(pj.totalTributosAnual)} + custos op. ${fmt(pj.custoOperacionalAnual)}`}
          accent="244,114,182"
          isWinner={!pfWins}
        />
      </div>

      {/* ── Banner de economia ────────────────────────────────────── */}
      <div style={{
        padding: '14px 20px',
        background: pfWins ? 'rgba(129,140,248,0.07)' : 'rgba(244,114,182,0.07)',
        border: `1px solid ${pfWins ? 'rgba(129,140,248,0.2)' : 'rgba(244,114,182,0.2)'}`,
        borderRadius: '12px',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <span style={{ fontSize: '22px' }}>{pfWins ? '🏠' : '🏢'}</span>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 700, color: 'white' }}>
            {pfWins
              ? `Carnê-Leão PF é ${fmt(economy)} mais barato por ano`
              : `Lucro Presumido PJ é ${fmt(economy)} mais barato por ano`}
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
            {pfWins
              ? 'Nesta faixa de receita e deduções, a tributação PF é menor que a PJ.'
              : 'Nesta faixa de receita, a carga tributária PJ (incluindo custos operacionais) é menor.'}
          </p>
        </div>
      </div>

      {/* ── Ponto de equilíbrio ───────────────────────────────────── */}
      {bk.encontrado && bk.receitaMensalBreakeven !== null && (
        <div style={{
          padding: '14px 20px',
          background: 'rgba(251,191,36,0.06)',
          border: '1px solid rgba(251,191,36,0.2)',
          borderRadius: '12px',
        }}>
          <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: '#fbbf24' }}>
            Ponto de equilíbrio: {fmt(bk.receitaMensalBreakeven)}/mês
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{bk.nota}</p>
        </div>
      )}
      {!bk.encontrado && (
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
          {bk.nota}
        </p>
      )}

      {/* ── Detalhamento ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* PF */}
        <div style={{ ...card }}>
          <p style={{ margin: '0 0 14px', fontSize: '12px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Carnê-Leão IRPF — Detalhamento
          </p>
          <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Receita bruta</span><span style={{ color: 'white' }}>{fmt(receitaMensal)}/mês</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>( - ) Deduções</span><span style={{ color: '#93c5fd' }}>({fmt(deducoesMensais)}/mês)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '4px' }}>
              <span>Base de cálculo</span><span style={{ color: 'white' }}>{fmt(pf.baseMensal)}/mês</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Faixa aplicada</span>
              <span style={{ color: '#818cf8' }}>
                {pf.faixa ? `${fmtPct(pf.faixa.rate)} − R$ ${pf.faixa.deduction.toFixed(2)}` : 'isento'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '4px' }}>
              <span>IRPF mensal</span><span style={{ color: 'white', fontWeight: 700 }}>{fmt(pf.tributoMensal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>IRPF anual</span>
              <span style={{ color: '#818cf8', fontWeight: 700 }}>{fmt(pf.tributoAnual)}</span>
            </div>
          </div>
          <p style={{ margin: '12px 0 0', fontSize: '10px', color: 'var(--text-muted)' }}>
            Tabela vigente: mai/{bracketYear} (IN RFB 2.178/2024)
          </p>
        </div>

        {/* PJ */}
        <div style={{ ...card }}>
          <p style={{ margin: '0 0 14px', fontSize: '12px', fontWeight: 700, color: '#f472b6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Lucro Presumido PJ — Detalhamento
          </p>
          <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Receita bruta</span><span style={{ color: 'white' }}>{fmt(receitaMensal)}/mês</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '4px' }}>
              <span>PIS ({fmtPct(pisRate)})</span>
              <span style={{ color: '#f87171' }}>{fmt(pj.pisAnual / 12)}/mês</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>COFINS ({fmtPct(cofinsRate)})</span>
              <span style={{ color: '#f87171' }}>{fmt(pj.cofinsAnual / 12)}/mês</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>CSLL ({fmtPct(csllRate)})</span>
              <span style={{ color: '#f87171' }}>{fmt(pj.csllAnual / 12)}/mês</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>IRPJ ({fmtPct(irpjRate)})</span>
              <span style={{ color: '#f87171' }}>{fmt(pj.irpjAnual / 12)}/mês</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '4px' }}>
              <span>Total tributos</span>
              <span style={{ color: 'white', fontWeight: 700 }}>
                {fmt(pj.totalTributosAnual / 12)}/mês · {fmt(pj.totalTributosAnual)}/ano
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>+ Custo operacional</span>
              <span style={{ color: '#fb923c' }}>{fmt(custoOperacionalMes)}/mês</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '4px' }}>
              <span>Carga total anual</span>
              <span style={{ color: '#f472b6', fontWeight: 700 }}>{fmt(pj.totalBurdenAnual)}</span>
            </div>
          </div>
          <p style={{ margin: '12px 0 0', fontSize: '10px', color: 'var(--text-muted)' }}>
            Alíquota efetiva tributos: {fmtPct(pj.aliquotaEfetivaTributos)} sobre receita bruta · Base presunção 32%
          </p>
        </div>
      </div>

      {/* ── Disclaimer ───────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(0,0,0,0.15)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '12px', padding: '16px 20px',
      }}>
        <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Avisos Importantes
        </p>
        <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.8 }}>
          <li>Este simulador tem finalidade exclusivamente ilustrativa. Consulte um contador para decisões fiscais.</li>
          <li>Carnê-Leão PF: calcula IRPF mensal pela tabela progressiva. Não considera IRRF já retido na fonte, deduções com dependentes nem planos de saúde.</li>
          <li>Lucro Presumido PJ: não contempla o adicional de IRPJ de 10% sobre base presumida acima de R$ 60.000/trimestre (receita bruta acima de ~R$ 62.500/mês). A vantagem PJ pode ser subestimada nesses casos.</li>
          <li>Custo operacional PJ é estimativa livre (contador, certificado digital, abertura de empresa, etc.).</li>
          <li>A migração entre regimes envolve aspectos jurídicos, societários e de planejamento tributário além desta simulação.</li>
        </ul>
        <p style={{ margin: '10px 0 0', fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>
          Ruleset {FISCAL_RULESET_VERSION} · Revisão {new Date(LAST_RULE_REVIEW).toLocaleDateString('pt-BR')}
        </p>
      </div>

    </div>
  )
}
