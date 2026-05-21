import s from '../skeleton.module.css'

export default function ImpostosLoading() {
  return (
    <>
      <div className={s.header}>
        <div>
          <div className={`${s.bone} ${s.headerTitle}`} />
          <div className={`${s.bone} ${s.headerSub}`} />
        </div>
      </div>

      {/* 4 módulos fiscais */}
      <div className={s.grid2}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={s.card} style={{ gap: 18, minHeight: 160 }}>
            <div className={s.cardRow}>
              <div className={`${s.bone} ${s.cardLabel}`} style={{ width: 160 }} />
              <div className={`${s.bone} ${s.cardIcon}`} style={{ width: 48, height: 48, borderRadius: 10 }} />
            </div>
            <div className={`${s.bone} ${s.cardSub}`} style={{ width: '80%' }} />
            <div className={`${s.bone} ${s.cardSub}`} style={{ width: '60%' }} />
            <div className={`${s.bone}`} style={{ width: 110, height: 36, borderRadius: 10, marginTop: 4 }} />
          </div>
        ))}
      </div>

      {/* Resumo fiscal */}
      <div className={`${s.bone} ${s.sectionLabel}`} />
      <div className={s.tableWrap}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={s.tableRow}>
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 140, flex: 1 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 100 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 100 }} />
          </div>
        ))}
      </div>
    </>
  )
}
