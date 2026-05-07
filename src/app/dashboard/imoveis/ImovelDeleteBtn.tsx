'use client'

import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { deletePropertyAction } from './actions'

export default function ImovelDeleteBtn({ id }: { id: string }) {
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async () => {
    // Alerta Vanilla clássico para UX B2B (Mínimo de Código possível)
    if (!window.confirm("Atenção Perigo: Você tem certeza que deseja deletar permanentemente este imóvel? Se houver contratos e finanças em cache sobre ele, esta destruição pode gerar buracos na base de dados.")) {
      return
    }

    setIsLoading(true)
    const error = await deletePropertyAction(id)
    setIsLoading(false)
    
    if (error) {
       alert("O Banco de Dados impediu a exclusão física: " + error)
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
