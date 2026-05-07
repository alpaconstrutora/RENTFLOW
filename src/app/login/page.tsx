import { loginWithMagicLink, verifyOtpCode } from './actions'
import { LogIn, KeyRound, Key } from 'lucide-react'
import styles from './login.module.css'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; step?: string; email?: string }>
}) {
  const resolvedParams = await searchParams
  const message = resolvedParams?.message
  const step = resolvedParams?.step
  const email = resolvedParams?.email

  return (
    <div className={styles.container}>
      <div className={styles.glowCenter} />

      <div className={styles.wrapper}>
        <div className={styles.header}>
           <div className={styles.iconBox}>
             <KeyRound size={32} />
           </div>
           <h1 className={styles.title}>RentFlow</h1>
           <p className={styles.subtitle}>Portal Financeiro Institucional</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardGradient} />

          {step !== 'verify' ? (
            <form action={loginWithMagicLink} className={styles.form}>
              <div className={styles.inputGroup}>
                <label htmlFor="email" className={styles.label}>
                  E-mail de Investidor
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="nome@corporacao.com"
                  required
                  className={styles.input}
                />
              </div>

              <button type="submit" className={styles.btnSubmit}>
                <span>Receber Código de Acesso</span>
                <LogIn size={20} className={styles.btnIcon} />
              </button>

              {message && (
                <div className={styles.messageBox}>
                  <p className={styles.message}>
                    {message}
                  </p>
                </div>
              )}
            </form>
          ) : (
            <form action={verifyOtpCode} className={styles.form}>
              <div className={styles.inputGroup}>
                <label htmlFor="token" className={styles.label}>
                  Código de Segurança
                </label>
                <input type="hidden" name="email" value={email} />
                <input
                  id="token"
                  name="token"
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  required
                  autoComplete="one-time-code"
                  className={styles.input}
                  style={{ textAlign: 'center', letterSpacing: '0.4em', fontSize: '1.25rem', fontFamily: 'Courier New, monospace' }}
                />
                <div className={styles.messageBox} style={{marginTop: '0.2rem'}}>
                  <p className={styles.message} style={{ background: 'transparent', border: 'none', color: '#9496a1'}}>
                    Código seguro enviado para:<br/><strong style={{color:"white"}}>{email}</strong>
                  </p>
                </div>
              </div>

              <button type="submit" className={styles.btnSubmit}>
                <span>Validar e Entrar</span>
                <Key size={20} className={styles.btnIcon} />
              </button>

              {message && message !== 'Cheque o Mailpit!' && (
                <div className={styles.messageBox} style={{marginTop: '0.5rem'}}>
                  <p className={styles.message} style={{ background: 'rgba(255,50,50,0.1)', color: '#ffaaaa', borderColor: 'rgba(255,50,50,0.2)'}}>
                    {message}
                  </p>
                </div>
              )}
            </form>
          )}
        </div>
        
        <p className={styles.footer}>
          Acesso rigorosamente monitorado. O uso de senhas foi desativado.
        </p>
      </div>
    </div>
  )
}
