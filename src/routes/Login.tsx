import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { motion } from "motion/react"
import { db } from "../lib/db"
import styles from "./Login.module.css"

export function Login() {
  const { user } = db.useAuth()
  const navigate = useNavigate()
  const [sentEmail, setSentEmail] = useState("")

  // Already logged in — redirect to home
  if (user) {
    return <Navigate to="/" replace />
  }

  return (
    <div className={styles.page}>
      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h2 className={styles.title}>Sign in</h2>
        {!sentEmail ? (
          <EmailStep onSendEmail={setSentEmail} />
        ) : (
          <CodeStep
            sentEmail={sentEmail}
            onBack={() => setSentEmail("")}
            onSuccess={() => navigate("/")}
          />
        )}
      </motion.div>
    </div>
  )
}

function EmailStep({ onSendEmail }: { onSendEmail: (email: string) => void }) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    db.auth
      .sendMagicCode({ email })
      .then(() => onSendEmail(email))
      .catch((err) => {
        alert("Error: " + (err.body?.message ?? err.message))
        setLoading(false)
      })
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <p className={styles.description}>
        Enter your email and we&apos;ll send you a verification code.
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className={styles.input}
        required
        autoFocus
      />
      <motion.button
        type="submit"
        className={styles.button}
        disabled={loading}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
      >
        {loading ? "Sending..." : "Send Code"}
      </motion.button>
    </form>
  )
}

function CodeStep({
  sentEmail,
  onBack,
  onSuccess,
}: {
  sentEmail: string
  onBack: () => void
  onSuccess: () => void
}) {
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code) return
    setLoading(true)
    db.auth
      .signInWithMagicCode({ email: sentEmail, code })
      .then(() => onSuccess())
      .catch((err) => {
        setCode("")
        setLoading(false)
        alert("Error: " + (err.body?.message ?? err.message))
      })
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <p className={styles.description}>
        We sent a code to <strong>{sentEmail}</strong>. Check your email and enter it below.
      </p>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter code"
        className={styles.input}
        required
        autoFocus
      />
      <motion.button
        type="submit"
        className={styles.button}
        disabled={loading}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
      >
        {loading ? "Verifying..." : "Verify Code"}
      </motion.button>
      <button type="button" className={styles.backLink} onClick={onBack}>
        Use a different email
      </button>
    </form>
  )
}
