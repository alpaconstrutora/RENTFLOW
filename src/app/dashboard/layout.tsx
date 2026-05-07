import { Building2 } from 'lucide-react'
import styles from '../page.module.css'
import Navigation from './Navigation'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={styles.container}>
      
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <Building2 size={20} color="white" />
          </div>
          RentFlow
        </div>
        
        {/* Componente Client-Side minúsculo roteando nosso HMR */}
        <Navigation />
      </aside>

      <main className={styles.main}>
        {children}
      </main>

    </div>
  )
}
