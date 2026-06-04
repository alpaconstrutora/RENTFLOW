import { NextRequest } from 'next/server'
import { createClient } from '../../../../../utils/supabase/server'
import Pizzip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { resolveVariableValue } from '../../../../../utils/resolveVariables'

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ leaseId: string }> }
) {
  const { leaseId } = await context.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Não autorizado', { status: 401 })

  // 1. Obter locação
  const { data: lease } = await supabase
    .from('leases')
    .select('id, code, rent_value, start_date, end_date, due_day, adjustment_index, adjustment_period_months, property_id, tenant_id, landlord_profile_id, guarantee_type, iptu_paid_by, condo_paid_by')
    .eq('id', leaseId)
    .single()

  if (!lease) return new Response('Contrato não encontrado', { status: 404 })

  // 2. Obter dados relacionados
  const [{ data: propertyRaw }, { data: tenantRaw }, { data: landlordProfileRaw }] = await Promise.all([
    supabase.from('properties').select('name, address, city, state, type, zip_code, street, street_number, district').eq('id', lease.property_id).single(),
    supabase.from('tenants').select('name, document, rg, email, phone, street, street_number, district, city, state, zip_code, birth_date, marital_status, profession, nationality, guarantor_name, guarantor_document').eq('id', lease.tenant_id).single(),
    lease.landlord_profile_id
      ? supabase.from('landlord_profiles').select('id, name, document, phone, address, email').eq('id', lease.landlord_profile_id).single()
      : supabase.from('landlord_profiles').select('id, name, document, phone, address, email').eq('user_id', user.id).eq('is_default', true).maybeSingle(),
  ])

  const meta = user.user_metadata as { name?: string; phone?: string; document?: string; address?: string }
  const ownerProfile = landlordProfileRaw as { name: string; document: string | null; phone: string | null; address: string | null; email: string | null } | null

  const owner = {
    name:     ownerProfile?.name     ?? meta.name     ?? user.email ?? '—',
    document: ownerProfile?.document ?? meta.document ?? null,
    phone:    ownerProfile?.phone    ?? meta.phone    ?? null,
    address:  ownerProfile?.address  ?? meta.address  ?? null,
    email:    ownerProfile?.email    ?? user.email    ?? null,
  }

  // 3. Verificar se já existe uma instância gerada
  const { data: instanceRaw } = await supabase
    .from('contract_instances')
    .select('id, template_id')
    .eq('lease_id', leaseId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let templateToUse: any = null
  const resolvedValues: Record<string, string> = {}

  if (instanceRaw) {
    // Caso exista instância, buscamos o template dela e os valores salvos das variáveis
    const { data: t } = await supabase
      .from('contract_templates')
      .select('id, docx_storage_path, name')
      .eq('id', instanceRaw.template_id)
      .single()

    templateToUse = t

    const { data: vals } = await supabase
      .from('contract_variable_values')
      .select('value, variable:contract_variables(code)')
      .eq('instance_id', instanceRaw.id)

    if (vals) {
      vals.forEach((v: any) => {
        resolvedValues[v.variable.code] = v.value
      })
    }
  } else {
    // Caso contrário, buscamos o modelo ativo e resolvemos on-the-fly
    const { data: activeTemplate } = await supabase
      .from('contract_templates')
      .select('id, docx_storage_path, name')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    templateToUse = activeTemplate

    if (activeTemplate) {
      const { data: variables } = await supabase
        .from('contract_variables')
        .select('code, origin, default_value')
        .eq('template_id', activeTemplate.id)

      if (variables) {
        variables.forEach(v => {
          resolvedValues[v.code] = resolveVariableValue({
            origin: v.origin,
            defaultValue: v.default_value,
            lease,
            property: propertyRaw,
            tenant: tenantRaw,
            owner
          })
        })
      }
    }
  }

  if (!templateToUse) {
    return new Response('Nenhum modelo de contrato encontrado', { status: 404 })
  }

  // 5. Baixar o arquivo do Storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('lease-documents')
    .download(templateToUse.docx_storage_path)

  if (downloadError || !fileData) {
    return new Response('Erro ao baixar o modelo de contrato', { status: 500 })
  }

  const arrayBuffer = await fileData.arrayBuffer()
  const zip = new Pizzip(arrayBuffer)

  // Detectar delimitadores
  const fileObj = zip.file ? zip.file('word/document.xml') : (zip.files ? zip.files['word/document.xml'] : null)
  const docXml = fileObj ? fileObj.asText() : ''
  const cleanText = docXml ? docXml.replace(/<[^>]+>/g, '') : ''
  
  let delimiters = { start: '{', end: '}' }
  if (cleanText.includes('##P{')) {
    delimiters = { start: '##P{', end: '}##' }
  } else if (cleanText.includes('{{')) {
    delimiters = { start: '{{', end: '}}' }
  }

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters
  })

  doc.render(resolvedValues)

  const generatedZipBuffer = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  })

  const contractNum = lease.code ? String(lease.code).padStart(3, '0') : leaseId.split('-')[0].toUpperCase()

  return new Response(new Uint8Array(generatedZipBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="contrato-${contractNum}.docx"`,
    },
  })
}
