import { useCallback, useEffect, useState } from "react"
import { Toggle } from "@base-ui-components/react/toggle"
import { motion } from "motion/react"
import styles from "./ThemeToggle.module.css"

type Theme = "light" | "dark"

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function getStoredTheme(): Theme | null {
  const stored = localStorage.getItem("theme")
  if (stored === "light" || stored === "dark") return stored
  return null
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    return getStoredTheme() ?? getSystemTheme()
  })

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
    localStorage.setItem("theme", theme)
  }, [theme])

  // Listen for system theme changes when no manual override
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = (e: MediaQueryListEvent) => {
      if (!getStoredTheme()) {
        setTheme(e.matches ? "dark" : "light")
      }
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const handleToggle = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"))
  }, [])

  const isDark = theme === "dark"

  return (
    <Toggle
      pressed={isDark}
      onPressedChange={handleToggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={styles.toggle}
    >
      <div className={styles.track}>
        <motion.div
          className={styles.knob}
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
        <span className={styles.icon} aria-hidden>
          {isDark ? "🌙" : "☀️"}
        </span>
      </div>
    </Toggle>
  )
}
