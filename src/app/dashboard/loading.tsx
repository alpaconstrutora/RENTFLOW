import s from './skeleton.module.css'

export default function DashboardLoading() {
  return (
    <>
      {/* header */}
      <div className={s.header}>
        <div>
          <div className={`${s.bone} ${s.headerTitle}`} />
          <div className={`${s.bone} ${s.headerSub}`} />
        </div>
        <div className={`${s.bone} ${s.headerBtn}`} />
      </div>

      {/* DRE do mês — 3 cards */}
      <div className={`${s.bone} ${s.sectionLabel}`} />
      <div className={s.grid3}>
        {[0, 1, 2].map(i => (
          <div key={i} className={s.card}>
            <div className={s.cardRow}>
              <div className={`${s.bone} ${s.cardLabel}`} />
              <div className={`${s.bone} ${s.cardIcon}`} />
            </div>
            <div className={`${s.bone} ${s.cardValue}`} />
            <div className={`${s.bone} ${s.cardSub}`} />
          </div>
        ))}
      </div>

      {/* Performance anual — 2 cards */}
      <div className={`${s.bone} ${s.sectionLabel}`} />
      <div className={s.grid2}>
        {[0, 1].map(i => (
          <div key={i} className={s.card}>
            <div className={s.cardRow}>
              <div className={`${s.bone} ${s.cardLabel}`} />
              <div className={`${s.bone} ${s.cardIcon}`} />
            </div>
            <div className={`${s.bone} ${s.cardValue}`} />
            <div className={`${s.bone} ${s.cardSub}`} />
          </div>
        ))}
      </div>

      {/* Risco e Ocupação — 3 cards */}
      <div className={`${s.bone} ${s.sectionLabel}`} />
      <div className={s.grid3}>
        {[0, 1, 2].map(i => (
          <div key={i} className={s.card}>
            <div className={s.cardRow}>
              <div className={`${s.bone} ${s.cardLabel}`} />
              <div className={`${s.bone} ${s.cardIcon}`} />
            </div>
            <div className={`${s.bone} ${s.cardValue}`} />
            <div className={`${s.bone} ${s.cardSub}`} />
          </div>
        ))}
      </div>

      {/* Alertas e Ranking — 3 cards */}
      <div className={`${s.bone} ${s.sectionLabel}`} />
      <div className={s.grid3}>
        {[0, 1, 2].map(i => (
          <div key={i} className={s.card}>
            <div className={s.cardRow}>
              <div className={`${s.bone} ${s.cardLabel}`} />
              <div className={`${s.bone} ${s.cardIcon}`} />
            </div>
            {[0, 1, 2].map(j => (
              <div key={j} className={s.cardRow}>
                <div className={`${s.bone} ${s.cardSub}`} />
                <div className={`${s.bone}`} style={{ width: 80, height: 14 }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
