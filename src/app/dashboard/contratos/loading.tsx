import s from '../skeleton.module.css'

export default function ContratosLoading() {
  return (
    <>
      <div className={s.header}>
        <div>
          <div className={`${s.bone} ${s.headerTitle}`} />
          <div className={`${s.bone} ${s.headerSub}`} />
        </div>
        <div className={`${s.bone} ${s.headerBtn}`} />
      </div>

      {/* KPI cards */}
      <div className={s.grid4} style={{ marginBottom: 32 }}>
        {[0, 1, 2, 3].map(i => (
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

      {/* Table */}
      <div className={s.tableWrap}>
        <div className={s.tableHead}>
          {[180, 150, 110, 110, 90, 80].map((w, i) => (
            <div key={i} className={`${s.bone} ${s.tableHeadCell}`} style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className={s.tableRow}>
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 180, flex: 1 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 150 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 110 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 110 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 70, borderRadius: 20 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 80 }} />
          </div>
        ))}
      </div>
    </>
  )
}
