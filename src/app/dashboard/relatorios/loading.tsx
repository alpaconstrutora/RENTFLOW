import s from '../skeleton.module.css'

export default function RelatoriosLoading() {
  return (
    <>
      <div className={s.header}>
        <div>
          <div className={`${s.bone} ${s.headerTitle}`} />
          <div className={`${s.bone} ${s.headerSub}`} />
        </div>
        <div className={`${s.bone} ${s.headerBtn}`} />
      </div>

      {/* DRE KPIs */}
      <div className={s.grid3} style={{ marginBottom: 32 }}>
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

      {/* DRE table */}
      <div className={`${s.bone} ${s.sectionLabel}`} />
      <div className={s.tableWrap}>
        <div className={s.tableHead}>
          {[200, 120, 120, 120].map((w, i) => (
            <div key={i} className={`${s.bone} ${s.tableHeadCell}`} style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={s.tableRow}>
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 200, flex: 1 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 120 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 120 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 120 }} />
          </div>
        ))}
      </div>
    </>
  )
}
