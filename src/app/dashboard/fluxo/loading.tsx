import s from '../skeleton.module.css'

export default function FluxoLoading() {
  return (
    <>
      {/* Header Skeleton */}
      <div className={s.header}>
        <div>
          <div className={`${s.bone} ${s.headerTitle}`} style={{ width: 180 }} />
          <div className={`${s.bone} ${s.headerSub}`} style={{ width: 320 }} />
        </div>
        <div className={`${s.bone} ${s.headerBtn}`} style={{ width: 140 }} />
      </div>

      {/* 3 Top Cards Skeletons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={s.card} style={{ height: 90 }}>
            <div className={`${s.bone}`} style={{ width: 120, height: 12, marginBottom: 8 }} />
            <div className={`${s.bone}`} style={{ width: 160, height: 26 }} />
          </div>
        ))}
      </div>

      {/* Filters Skeleton */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[100, 150, 120, 110].map((w, i) => (
          <div key={i} className={`${s.bone}`} style={{ width: w, height: 36, borderRadius: 8 }} />
        ))}
      </div>

      {/* Table Skeleton */}
      <div className={s.card} style={{ padding: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            {[150, 100, 100, 100, 80, 80, 50].map((w, i) => (
              <div key={i} className={`${s.bone}`} style={{ width: w, height: 16 }} />
            ))}
          </div>
          {/* Table Body Rows */}
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div className={`${s.bone}`} style={{ width: 36, height: 36, borderRadius: '50%' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div className={`${s.bone}`} style={{ width: 140, height: 14 }} />
                  <div className={`${s.bone}`} style={{ width: 90, height: 11 }} />
                </div>
              </div>
              <div className={`${s.bone}`} style={{ width: 100, height: 14, alignSelf: 'center' }} />
              <div className={`${s.bone}`} style={{ width: 100, height: 14, alignSelf: 'center' }} />
              <div className={`${s.bone}`} style={{ width: 100, height: 14, alignSelf: 'center' }} />
              <div className={`${s.bone}`} style={{ width: 80, height: 14, alignSelf: 'center' }} />
              <div className={`${s.bone}`} style={{ width: 80, height: 20, borderRadius: 4, alignSelf: 'center' }} />
              <div className={`${s.bone}`} style={{ width: 32, height: 32, borderRadius: '50%', alignSelf: 'center' }} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
