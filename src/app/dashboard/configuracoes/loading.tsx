import s from '../skeleton.module.css'

export default function ConfiguracoesLoading() {
  return (
    <>
      <div className={s.header}>
        <div>
          <div className={`${s.bone} ${s.headerTitle}`} />
          <div className={`${s.bone} ${s.headerSub}`} />
        </div>
      </div>

      {/* Perfil */}
      <div className={`${s.bone} ${s.sectionLabel}`} />
      <div className={s.card} style={{ marginBottom: 32, gap: 20 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div className={`${s.bone}`} style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            <div className={`${s.bone}`} style={{ width: 200, height: 20 }} />
            <div className={`${s.bone}`} style={{ width: 160, height: 14 }} />
          </div>
        </div>
        {[180, 240, 160].map((w, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className={`${s.bone}`} style={{ width: 100, height: 12 }} />
            <div className={`${s.bone}`} style={{ width: '100%', height: 40, borderRadius: 8 }} />
          </div>
        ))}
      </div>

      {/* Alertas */}
      <div className={`${s.bone} ${s.sectionLabel}`} />
      <div className={s.alertStrip}>
        {[0, 1, 2].map(i => (
          <div key={i} className={s.alertRow}>
            <div className={`${s.bone} ${s.alertLeft}`} />
            <div className={`${s.bone}`} style={{ width: 44, height: 24, borderRadius: 12 }} />
          </div>
        ))}
      </div>
    </>
  )
}
