import s from '../../skeleton.module.css'

export default function ImovelDetalheLoading() {
  return (
    <>
      <div className={s.header}>
        <div>
          <div className={`${s.bone} ${s.headerTitle}`} />
          <div className={`${s.bone} ${s.headerSub}`} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className={`${s.bone} ${s.headerBtn}`} />
          <div className={`${s.bone} ${s.headerBtn}`} />
        </div>
      </div>

      {/* KPIs */}
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

      {/* Contrato ativo */}
      <div className={`${s.bone} ${s.sectionLabel}`} />
      <div className={s.card} style={{ marginBottom: 32 }}>
        <div className={s.cardRow}>
          <div className={`${s.bone} ${s.cardLabel}`} style={{ width: 200 }} />
          <div className={`${s.bone}`} style={{ width: 90, height: 22, borderRadius: 20 }} />
        </div>
        <div className={s.grid3} style={{ marginBottom: 0 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className={`${s.bone}`} style={{ width: 80, height: 12 }} />
              <div className={`${s.bone}`} style={{ width: 120, height: 20 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Transações */}
      <div className={`${s.bone} ${s.sectionLabel}`} />
      <div className={s.tableWrap}>
        <div className={s.tableHead}>
          {[80, 120, 100, 90, 80].map((w, i) => (
            <div key={i} className={`${s.bone} ${s.tableHeadCell}`} style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={s.tableRow}>
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 80 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 160, flex: 1 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 100 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 70, borderRadius: 20 }} />
            <div className={`${s.bone} ${s.tableCell}`} style={{ width: 80 }} />
          </div>
        ))}
      </div>
    </>
  )
}
