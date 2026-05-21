import s from '../skeleton.module.css'

export default function InquilinosLoading() {
  return (
    <>
      <div className={s.header}>
        <div>
          <div className={`${s.bone} ${s.headerTitle}`} />
          <div className={`${s.bone} ${s.headerSub}`} />
        </div>
        <div className={`${s.bone} ${s.headerBtn}`} />
      </div>

      <div className={s.tableWrap}>
        <div className={s.tableHead}>
          {[200, 160, 130, 100, 90].map((w, i) => (
            <div key={i} className={`${s.bone} ${s.tableHeadCell}`} style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={s.tableRow}>
            {/* avatar */}
            <div className={`${s.bone}`} style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 160, flex: 1 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 130 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 100 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 70, borderRadius: 20 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 80 }} />
          </div>
        ))}
      </div>
    </>
  )
}
