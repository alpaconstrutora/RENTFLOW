import s from '../skeleton.module.css'

export default function FluxoLoading() {
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
      <div className={s.grid4} style={{ marginBottom: 24 }}>
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

      {/* Filters */}
      <div className={s.filtersBar}>
        {[120, 100, 90, 110, 80].map((w, i) => (
          <div key={i} className={`${s.bone} ${s.filterChip}`} style={{ width: w }} />
        ))}
      </div>

      {/* Table */}
      <div className={s.tableWrap}>
        <div className={s.tableHead}>
          {[80, 100, 140, 100, 90, 80].map((w, i) => (
            <div key={i} className={`${s.bone} ${s.tableHeadCell}`} style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={s.tableRow}>
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 80 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 100 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 180, flex: 1 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 100 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 70, borderRadius: 20 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 80 }} />
          </div>
        ))}
      </div>
    </>
  )
}
