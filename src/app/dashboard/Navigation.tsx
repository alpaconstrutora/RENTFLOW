'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from '../page.module.css'

export default function Navigation() {
  const pathname = usePathname()

  const navs = [
    { name: 'Painel Resumo', href: '/dashboard' },
    { name: 'Fluxo de Caixa', href: '/dashboard/fluxo' },
    { name: 'Meus Imóveis', href: '/dashboard/imoveis' },
    { name: 'Inquilinos e Gestão', href: '/dashboard/inquilinos' },
    { name: 'Contratos', href: '/dashboard/contratos' },
    { name: 'Tributos e Impostos', href: '/dashboard/impostos' },
    { name: 'Relatórios', href: '/dashboard/relatorios' },
    { name: 'Configurações', href: '/dashboard/configuracoes' },
  ]

  return (
    <nav className={styles.nav}>
      {navs.map(n => (
        <Link 
          key={n.href} 
          href={n.href} 
          className={`${styles.navItem} ${pathname === n.href ? styles.navItemActive : ''}`}
        >
          {n.name}
        </Link>
      ))}
    </nav>
  )
}
