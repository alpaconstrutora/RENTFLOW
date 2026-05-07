import { mesAno, formatBRL, formatDate } from '../../valorPorExtenso'

export interface ReciboEmailData {
  transactionId: string
  tenantName: string
  propertyName: string
  propertyAddress: string | null
  netAmount: number
  billingMonth: string | null
  paidDate: string | null
  ownerName: string
}

export function reciboEmailSubject(data: ReciboEmailData): string {
  return `Recibo de aluguel — ${data.propertyName} · ${mesAno(data.billingMonth)}`
}

export function reciboEmailHtml(data: ReciboEmailData): string {
  const receiptNum = data.transactionId.split('-')[0].toUpperCase()
  const valor = formatBRL(data.netAmount)
  const referencia = mesAno(data.billingMonth)
  const liquidacao = formatDate(data.paidDate)

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recibo de Aluguel</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Cabeçalho -->
          <tr>
            <td style="background:#1a1a2e;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#818cf8;font-weight:700;">RentFlow</p>
              <h1 style="margin:8px 0 4px;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:0.02em;">Recibo de Aluguel</h1>
              <p style="margin:0;font-size:13px;color:#94a3b8;">N.º ${receiptNum}</p>
            </td>
          </tr>

          <!-- Valor -->
          <tr>
            <td style="background:#ffffff;padding:0 40px;">
              <div style="background:#f8faff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;text-align:center;margin:28px 0;">
                <p style="margin:0 0 6px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Valor Recebido</p>
                <p style="margin:0;font-size:36px;font-weight:800;color:#1a1a2e;">${valor}</p>
              </div>
            </td>
          </tr>

          <!-- Detalhes -->
          <tr>
            <td style="background:#ffffff;padding:0 40px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.07em;font-weight:600;">Referência</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;">
                    <span style="font-size:14px;font-weight:600;color:#1a1a2e;">${referencia}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.07em;font-weight:600;">Data de Liquidação</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;">
                    <span style="font-size:14px;font-weight:600;color:#1a1a2e;">${liquidacao}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.07em;font-weight:600;">Imóvel</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;">
                    <span style="font-size:14px;font-weight:600;color:#1a1a2e;">${escHtml(data.propertyName)}</span>
                    ${data.propertyAddress ? `<br/><span style="font-size:12px;color:#64748b;">${escHtml(data.propertyAddress)}</span>` : ''}
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;">
                    <span style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.07em;font-weight:600;">Recebido por</span>
                  </td>
                  <td style="padding:10px 0;text-align:right;">
                    <span style="font-size:14px;font-weight:600;color:#1a1a2e;">${escHtml(data.ownerName)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Nota PDF -->
          <tr>
            <td style="background:#f8faff;border-left:3px solid #818cf8;margin:0 40px;padding:16px 24px;">
              <p style="margin:0;font-size:13px;color:#475569;line-height:1.5;">
                O recibo em PDF está anexado a este e-mail para arquivo e comprovação.
              </p>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="background:#1a1a2e;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#475569;line-height:1.6;">
                Este é um documento gerado automaticamente pelo <strong style="color:#818cf8;">RentFlow</strong>.<br/>
                Guarde o PDF em anexo como comprovante de pagamento.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
