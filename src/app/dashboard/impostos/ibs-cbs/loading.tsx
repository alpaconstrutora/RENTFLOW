import s from '../../skeleton.module.css'

export default function IbsCbsLoading() {
  return (
    <>
      <div className={s.header}>
        <div>
          <div className={`${s.bone} ${s.headerTitle}`} />
          <div className={`${s.bone} ${s.headerSub}`} />
        </div>
      </div>

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

      <div className={s.tableWrap}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={s.tableRow}>
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 120, flex: 1 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 100 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 100 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 100 }} />
          </div>
        ))}
      </div>
    </>
  )
}
