import s from '../../skeleton.module.css'

export default function SimuladorLoading() {
  return (
    <>
      <div className={s.header}>
        <div>
          <div className={`${s.bone} ${s.headerTitle}`} />
          <div className={`${s.bone} ${s.headerSub}`} />
        </div>
      </div>

      <div className={s.grid2}>
        {/* inputs */}
        <div className={s.card} style={{ gap: 18 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className={`${s.bone}`} style={{ width: 120, height: 12 }} />
              <div className={`${s.bone}`} style={{ width: '100%', height: 40, borderRadius: 8 }} />
            </div>
          ))}
          <div className={`${s.bone}`} style={{ width: '100%', height: 44, borderRadius: 10, marginTop: 8 }} />
        </div>

        {/* resultado */}
        <div className={s.card} style={{ gap: 20 }}>
          <div className={`${s.bone} ${s.cardLabel}`} style={{ width: 160 }} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={s.cardRow}>
              <div className={`${s.bone}`} style={{ width: 150, height: 14 }} />
              <div className={`${s.bone}`} style={{ width: 100, height: 22 }} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
