import s from '../skeleton.module.css'

export default function ImoveisLoading() {
  return (
    <>
      <div className={s.header}>
        <div>
          <div className={`${s.bone} ${s.headerTitle}`} />
          <div className={`${s.bone} ${s.headerSub}`} />
        </div>
        <div className={`${s.bone} ${s.headerBtn}`} />
      </div>

      <div className={s.grid3}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={s.card} style={{ gap: 16 }}>
            {/* photo placeholder */}
            <div className={`${s.bone}`} style={{ width: '100%', height: 140, borderRadius: 10 }} />
            <div className={s.cardRow}>
              <div className={`${s.bone} ${s.cardLabel}`} style={{ width: 140 }} />
              <div className={`${s.bone}`} style={{ width: 60, height: 22, borderRadius: 20 }} />
            </div>
            <div className={`${s.bone} ${s.cardSub}`} style={{ width: 200 }} />
            <div className={s.cardRow}>
              {[0, 1].map(j => (
                <div key={j} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className={`${s.bone}`} style={{ width: 80, height: 22 }} />
                  <div className={`${s.bone}`} style={{ width: 60, height: 12 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
