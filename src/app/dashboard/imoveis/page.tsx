import { TrendingUp } from 'lucide-react'
import styles from '../../page.module.css'
import { createClient } from '../../../utils/supabase/server'
import ImovelButtonWithModal from './ImovelButtonWithModal'
import ImovelEditBtn from './ImovelEditBtn'
import ImovelDeleteBtn from './ImovelDeleteBtn'

const TYPE_LABELS: Record<string, string> = {
  residential:     'Residencial',
  commercial:      'Comercial',
  apartment:       'Apartamento',
  house:           'Casa',
  studio:          'Kitnet / Studio',
  commercial_room: 'Sala Comercial',
  store:           'Loja',
  warehouse:       'Galpão',
  land:            'Terreno',
}

interface PropertyRow {
  id: string
  name: string
  type: string
  status: string
  expected_rent: number | null
  purchase_value: number | null
  photo_url: string | null
  zip_code: string | null
  street: string | null
  street_number: string | null
  district: string | null
  city: string | null
  state: string | null
  address: string | null
  notes: string | null
  leases: { rent_value: number; active: boolean }[]
}

export default async function ImoveisPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: propertiesRaw }, { data: profitSummary }] = await Promise.all([
    supabase
      .from('properties')
      .select(`
        id, name, type, status, expected_rent, purchase_value,
        address, notes, photo_url,
        zip_code, street, street_number, district, city, state,
        leases ( rent_value, active )
      `)
      .eq('user_id', user?.id ?? '')
      .order('created_at', { ascending: false }),
    supabase.rpc('get_property_profit_summary'),
  ])

  const properties = (propertiesRaw ?? []) as PropertyRow[]

  const profitMap: Record<string, number>  = {}
  const monthsMap: Record<string, number>  = {}
  for (const r of profitSummary ?? []) {
    profitMap[r.property_id] = Number(r.total_profit)
    monthsMap[r.property_id] = r.months_count
  }

  const formatBRL = (val: number | null | undefined) =>
    val == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  const formatPct = (val: number | null) =>
    val == null ? '—' : `${val.toFixed(2)}%`

  function addressLine(p: PropertyRow): string | null {
    if (p.street) {
      const parts = [p.street, p.street_number, p.district, p.city && p.state ? `${p.city} - ${p.state}` : p.city].filter(Boolean)
      return parts.join(', ')
    }
    return p.address
  }

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Meus Imóveis</h1>
          <p className={styles.subtitle}>Portfólio físico com ROI, Yield e status de ocupação em tempo real.</p>
        </div>
        <div className={styles.actions}>
          <ImovelButtonWithModal userId={user?.id ?? ''} />
        </div>
      </header>

      <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '16px', fontWeight: 500 }}>Imóvel</th>
              <th style={{ padding: '16px', fontWeight: 500 }}>Tipo</th>
              <th style={{ padding: '16px', fontWeight: 500 }}>Status</th>
              <th style={{ padding: '16px', fontWeight: 500 }}>Aluguel / Yield Anual</th>
              <th style={{ padding: '16px', fontWeight: 500 }}>ROI Acumulado</th>
              <th style={{ padding: '16px', fontWeight: 500 }}>ROI Anualizado</th>
              <th style={{ padding: '16px', fontWeight: 500, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {properties?.map(prop => {
              const activeLeases  = prop.leases?.filter(l => l.active) || []
              const currentRent   = activeLeases[0]?.rent_value ?? null
              const purchaseValue = prop.purchase_value != null && prop.purchase_value > 0 ? prop.purchase_value : null
              const yield_        = purchaseValue && currentRent ? (currentRent * 12) / purchaseValue * 100 : null
              const totalProfit   = profitMap[prop.id] || 0
              const roiAcum       = purchaseValue && totalProfit !== 0 ? (totalProfit / purchaseValue) * 100 : null
              const mesesComDados = monthsMap[prop.id] ?? 0
              const roiAnualizado = purchaseValue && mesesComDados >= 3 ? (totalProfit / mesesComDados * 12) / purchaseValue * 100 : null
              const addr          = addressLine(prop)

              return (
                <tr key={prop.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {/* Imóvel */}
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* Thumbnail ou placeholder */}
                      <div style={{ width: '52px', height: '52px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {prop.photo_url ? (
                          <img src={prop.photo_url} alt={prop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '22px' }}>🏠</span>
                        )}
                      </div>
                      <div>
                        <span style={{ fontWeight: 500, display: 'block' }}>{prop.name}</span>
                        {addr && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{addr}</span>}
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {TYPE_LABELS[prop.type] ?? prop.type}
                  </td>

                  <td style={{ padding: '16px' }}>
                    {prop.status === 'rented' ? (
                      <span style={{ color: 'var(--success-color)', background: 'var(--success-bg)', padding: '5px 12px', borderRadius: '24px', fontSize: '13px', fontWeight: 600 }}>Locado</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--warning-color)', background: 'var(--warning-bg)', padding: '5px 12px', borderRadius: '24px', fontSize: '13px', fontWeight: 600 }}>Vago</span>
                        <a href="/dashboard/contratos" style={{ fontSize: '11px', color: 'var(--accent-color)', textDecoration: 'none' }}>Criar contrato →</a>
                      </div>
                    )}
                  </td>

                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: 500, color: 'var(--success-color)' }}>
                        {formatBRL(currentRent ?? prop.expected_rent)}/mês
                      </span>
                      <span style={{ fontSize: '12px', color: yield_ ? 'var(--accent-color)' : 'var(--text-muted)' }}>
                        {yield_ ? (
                          <><TrendingUp size={11} style={{ display: 'inline', marginRight: '3px' }} />{formatPct(yield_)} yield/ano</>
                        ) : (
                          <span style={{ fontSize: '11px' }}>
                            {purchaseValue === null ? '— Adicionar valor de compra →' : '— Sem contrato ativo'}
                          </span>
                        )}
                      </span>
                    </div>
                  </td>

                  <td style={{ padding: '16px' }}>
                    {roiAcum !== null ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 600, color: roiAcum >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>{formatPct(roiAcum)}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatBRL(totalProfit)} lucro total</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{purchaseValue === null ? '—' : 'Sem dados ainda'}</span>
                    )}
                  </td>

                  <td style={{ padding: '16px' }}>
                    {roiAnualizado !== null ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 600, color: roiAnualizado >= 0 ? 'var(--accent-color)' : 'var(--danger-color)' }}>{formatPct(roiAnualizado)}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{mesesComDados} meses de dados</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {mesesComDados < 3 && mesesComDados > 0 ? `${mesesComDados} meses — mín. 3` : purchaseValue === null ? '—' : 'Sem dados'}
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px' }}>
                      <a href={`/dashboard/imoveis/${prop.id}`} style={{ fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                        Detalhes
                      </a>
                      <ImovelEditBtn userId={user?.id ?? ''} property={prop} />
                      <ImovelDeleteBtn id={prop.id} />
                    </div>
                  </td>
                </tr>
              )
            })}

            {(!properties || properties.length === 0) && (
              <tr>
                <td colSpan={7} style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nenhum imóvel cadastrado. Clique em &quot;Cadastrar Imóvel&quot; para começar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
