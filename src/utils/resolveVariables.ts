export function resolveVariableValue({
  origin,
  defaultValue,
  lease,
  property,
  tenant,
  owner
}: {
  origin: string;
  defaultValue: string | null;
  lease: any;
  property: any;
  tenant: any;
  owner: any;
}) {
  const fmtDate = (d: string | null) => {
    if (!d) return ''
    const parts = d.split('T')[0].split('-')
    if (parts.length !== 3) return d
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }

  const fmtMaritalStatus = (status: string | null | undefined) => {
    if (!status) return ''
    switch (status) {
      case 'single': return 'solteiro(a)'
      case 'married': return 'casado(a)'
      case 'divorced': return 'divorciado(a)'
      case 'widowed': return 'viúvo(a)'
      case 'stable_union': return 'união estável'
      default: return status
    }
  }

  const fmtPropertyType = (type: string | null | undefined) => {
    if (!type) return ''
    switch (type) {
      case 'residential_apartment': return 'Apartamento Residencial'
      case 'residential_house': return 'Casa Residencial'
      case 'commercial_room': return 'Sala Comercial'
      case 'commercial_store': return 'Loja Comercial'
      case 'industrial': return 'Galpão/Industrial'
      case 'land': return 'Terreno'
      default: return type
    }
  }

  const buildTenantAddress = (t: any) => {
    return [
      t.street && t.street_number ? `${t.street}, ${t.street_number}` : t.street,
      t.district,
      t.city && t.state ? `${t.city} - ${t.state}` : (t.city ?? t.state),
      t.zip_code ? `CEP ${t.zip_code}` : null
    ].filter(Boolean).join(', ')
  }

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  switch (origin) {
    // Inquilino
    case 'db_tenant_name':        return tenant?.name || '';
    case 'db_tenant_document':    return tenant?.document || '';
    case 'db_tenant_rg':          return tenant?.rg || '';
    case 'db_tenant_email':       return tenant?.email || '';
    case 'db_tenant_phone':       return tenant?.phone || '';
    case 'db_tenant_birth_date':  return fmtDate(tenant?.birth_date);
    case 'db_tenant_profession':  return tenant?.profession || '';
    case 'db_tenant_nationality': return tenant?.nationality || '';
    case 'db_tenant_marital_status': return fmtMaritalStatus(tenant?.marital_status);
    case 'db_tenant_address':     return tenant ? buildTenantAddress(tenant) : '';
    case 'db_tenant_zip_code':    return tenant?.zip_code || '';
    // Fiador
    case 'db_guarantor_name':     return tenant?.guarantor_name || '';
    case 'db_guarantor_document': return tenant?.guarantor_document || '';
    // Locador
    case 'db_landlord_name':      return owner?.name || '';
    case 'db_landlord_document':  return owner?.document || '';
    case 'db_landlord_email':     return owner?.email || '';
    case 'db_landlord_phone':     return owner?.phone || '';
    case 'db_landlord_address':   return owner?.address || '';
    // Imóvel
    case 'db_property_name':      return property?.name || '';
    case 'db_property_type':      return fmtPropertyType(property?.type);
    case 'db_property_zip_code':  return property?.zip_code || '';
    case 'db_property_city':      return property?.city || '';
    case 'db_property_state':     return property?.state || '';
    case 'db_property_street':
      return property?.street
        ? (property.street_number ? `${property.street}, ${property.street_number}` : property.street)
        : '';
    case 'db_property_district':  return property?.district || '';
    case 'db_property_address':
      return [
        property?.street && property?.street_number
          ? `${property.street}, ${property.street_number}`
          : property?.street || property?.address,
        property?.district,
        property?.city && property?.state ? `${property.city} - ${property.state}` : (property?.city ?? property?.state),
        property?.zip_code ? `CEP ${property.zip_code}` : null
      ].filter(Boolean).join(', ');
    // Contrato
    case 'db_rent_value':
      return lease?.rent_value ? formatBRL(lease.rent_value) : '';
    case 'db_due_day':            return lease?.due_day ? String(lease.due_day).padStart(2, '0') : '';
    case 'db_start_date':         return lease?.start_date ? fmtDate(lease.start_date) : '';
    case 'db_end_date':           return lease?.end_date ? fmtDate(lease.end_date) : 'Indeterminado';
    default:
      return defaultValue || '';
  }
}
