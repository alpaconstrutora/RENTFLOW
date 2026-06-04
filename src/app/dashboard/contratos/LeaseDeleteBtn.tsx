'use client'

import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { deleteLeaseAction } from './actions'

export default function LeaseDeleteBtn({ id }: { id: string }) {
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async () => {
    if (!window.confirm("ATENÇÃO: O banco de dados operará em CASCADE. Se você excluir este contrato, todas as parcelas e faturas dependentes dele vão SUMIR do Fluxo de Caixa permanentemente (mesmo as que já foram pagas!). Deseja realmente aniquilar este contrato?")) {
      return
    }

    setIsLoading(true)
    const error = await deleteLeaseAction(id)
    setIsLoading(false)
    
    if (error) {
       alert("Erro de Deleção: " + error)
    }
  }

  return (
    <button 
      onClick={handleDelete}
      disabled={isLoading}
      title="Excluir"
      style={{ color: 'var(--danger-color)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px', opacity: isLoading ? 0.4 : 1 }}
    >
      <Trash2 size={16} />
    </button>
  )
}
