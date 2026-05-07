'use client'

import { useState } from 'react'
import { ServerCog, CheckCircle } from 'lucide-react'
import { triggerBillingEngineAction } from './actions'

export default function RunBillingBtn() {
  const [isLoading, setIsLoading] = useState(false)
  const [resultMsg, setResultMsg] = useState('')

  const handleRun = async () => {
    setIsLoading(true)
    setResultMsg('')
    const res = await triggerBillingEngineAction()
    setIsLoading(false)

    if (res.error) {
      alert("Falha no Motor Assíncrono: " + res.error)
    } else {
      if (res.count === 0) {
         setResultMsg("Cofre Sincronizado: Nenhuma fatura nova foi necessária para a competência deste mês.")
      } else {
         setResultMsg(`RPA Sucesso: O robô injetou ${res.count} notas de cobrança no seu Caixa em 1 segundo.`)
      }
      setTimeout(() => setResultMsg(''), 7000)
    }
  }

  return (
     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', position: 'relative' }}>
      <button 
        onClick={handleRun}
        disabled={isLoading}
        style={{ padding: '14px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255, 255, 255, 0.05)', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s', opacity: isLoading ? 0.6 : 1 }}
      >
        <ServerCog size={18} color="var(--accent-color)" />
        {isLoading ? 'Rodando RPA Financeiro...' : 'Executar RPA (Faturar o Mês)'}
      </button>
      
      {resultMsg && (
         <div style={{ position: 'absolute', top: '110%', right: '0', background: 'var(--bg-card)', border: resultMsg.includes('Sucesso') ? '1px solid var(--success-color)' : '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', fontSize: '13px', color: resultMsg.includes('Sucesso') ? 'var(--success-color)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', zIndex: 10, boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
            <CheckCircle size={14} />
            {resultMsg}
         </div>
      )}
     </div>
  )
}
