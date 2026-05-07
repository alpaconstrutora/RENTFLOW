import { getFiscalDisclaimer, type FiscalDisclaimerOptions } from '../../../lib/fiscal/disclaimers'

export default function FiscalDisclaimer(opts: FiscalDisclaimerOptions) {
  const d = getFiscalDisclaimer(opts)

  return (
    <div style={{
      background: 'rgba(255,180,0,0.05)',
      border: '1px solid rgba(255,180,0,0.2)',
      padding: '16px 20px',
      borderRadius: '14px',
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: '18px', flexShrink: 0, lineHeight: 1.4 }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {d.lines.map((line, i) => (
            <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.6 }}>
              {line}
            </li>
          ))}
        </ul>
        <p style={{
          margin: '10px 0 0',
          fontSize: '10px',
          color: 'var(--text-muted)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          paddingTop: '8px',
        }}>
          Regras fiscais revisadas em{' '}
          <strong style={{ color: 'var(--text-secondary)' }}>{d.lastReviewFormatted}</strong>
          {' '}· versão{' '}
          <strong style={{ color: 'var(--text-secondary)' }}>{d.rulesetVersion}</strong>
        </p>
      </div>
    </div>
  )
}
