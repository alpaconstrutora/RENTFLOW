'use client'

import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { deleteTenantAction } from './actions'

export default function TenantDeleteBtn({ id }: { id: string }) {
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async () => {
    if (!window.confirm("Atenção Perigo: Deseja apagar o registro desta empresa ou inquilino? O banco de dados bloqueará a ação se ele possuir qualquer contrato de locação ativo amarrado ao nome dele para garantir integridade fiscal. Continuar?")) {
      return
    }

    setIsLoading(true)
    const error = await deleteTenantAction(id)
    setIsLoading(false)
    
    if (error) {
       alert("Operação Abortada: " + error)
    }
  }

  return (
    <button 
      onClick={handleDelete}
      disabled={isLoading}
      style={{ color: 'var(--danger-color)', fontSize: '14px', fontWeight: 600, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', opacity: isLoading ? 0.4 : 1 }}
    >
      <Trash2 size={14} />
      {isLoading ? 'Limpando...' : 'Excluir'}
    </button>
  )
}
