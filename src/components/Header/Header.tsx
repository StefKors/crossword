import { Link, useLocation } from "react-router-dom"
import { motion } from "motion/react"
import { ThemeToggle } from "../ThemeToggle/ThemeToggle"
import { db } from "../../lib/db"
import styles from "./Header.module.css"

export function Header() {
  const location = useLocation()
  const { user } = db.useAuth()

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          <h1 className={styles.logoText}>Crossword</h1>
        </Link>

        <nav className={styles.nav}>
          <NavLink to="/" label="Daily" active={location.pathname === "/"} />
          {user && <NavLink to="/admin" label="Admin" active={location.pathname === "/admin"} />}
        </nav>

        <div className={styles.actions}>
          <ThemeToggle />
          {user ? (
            <div className={styles.userMenu}>
              <span className={styles.email}>{user.email}</span>
              <motion.button
                className={styles.signOut}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => db.auth.signOut()}
              >
                Sign out
              </motion.button>
            </div>
          ) : (
            <Link to="/login" className={styles.signIn}>
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

function NavLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link to={to} className={`${styles.navLink} ${active ? styles.active : ""}`}>
      {label}
      {active && (
        <motion.div
          className={styles.activeIndicator}
          layoutId="nav-indicator"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
    </Link>
  )
}
