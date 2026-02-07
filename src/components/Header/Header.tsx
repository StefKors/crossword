import { Link, useLocation } from "react-router-dom"
import { motion } from "motion/react"
import { ThemeToggle } from "../ThemeToggle/ThemeToggle"
import { db } from "../../lib/db"
import { useIsAdmin } from "../../lib/useIsAdmin"
import styles from "./Header.module.css"

export function Header() {
  const location = useLocation()
  const { user } = db.useAuth()
  const { isAdmin } = useIsAdmin()

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          <h1 className={styles.logoText}>Crossword</h1>
        </Link>

        <nav className={styles.nav}>
          <NavLink to="/" label="Daily" active={location.pathname === "/"} />
          {isAdmin && <NavLink to="/admin" label="Admin" active={location.pathname === "/admin"} />}
        </nav>

        <div className={styles.actions}>
          <ThemeToggle />
          {user ? (
            <Link to="/settings" className={styles.settingsLink} aria-label="Settings">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="10" cy="10" r="3" />
                <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M3.4 3.4l1.4 1.4M15.2 15.2l1.4 1.4M3.4 16.6l1.4-1.4M15.2 4.8l1.4-1.4" />
              </svg>
            </Link>
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
