import Link from 'next/link'
import { ArrowRight, KeyRound } from 'lucide-react'
import styles from './landing.module.css'
import { redirect } from 'next/navigation'

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  if (error) redirect('/login?message=Link expirado. Solicite um novo código abaixo.')
  return (
    <div className={styles.container}>
      <div className={styles.glowTop} />
      <div className={styles.glowBottom} />

      <main className={styles.main}>
        <div className={styles.iconBox}>
          <KeyRound size={40} />
        </div>
        
        <h1 className={styles.title}>
          O Futuro da <br/> <span className={styles.highlight}>Gestão Imobiliária</span>
        </h1>
        
        <p className={styles.subtitle}>
          RentFlow v6.0 é a plataforma institucional projetada para investidores de alta performance. Automação financeira, controle otimista e invariantes estruturais puras.
        </p>
        
        <div className={styles.actions}>
          <Link href="/login" className={styles.btnPrimary}>
            Acesso B2B
            <ArrowRight size={20} />
          </Link>
          
          <a href="mailto:contato@rentflow.com" className={styles.btnSecondary}>
            Solicitar Demonstração
          </a>
        </div>
      </main>

      <footer className={styles.footer}>
        &copy; 2026 RentFlow SaaS. Todos os direitos reservados.
      </footer>
    </div>
  )
}
