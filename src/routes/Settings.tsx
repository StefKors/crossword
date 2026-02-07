import { Navigate } from "react-router-dom"
import { Switch } from "@base-ui-components/react/switch"
import { motion } from "motion/react"
import { db } from "../lib/db"
import { useUserSettings } from "../lib/useUserSettings"
import styles from "./Settings.module.css"

function SettingsContent() {
  const user = db.useUser()
  const { settings, updateSettings } = useUserSettings()

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <h2>Settings</h2>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Profile</h3>
        <div className={styles.card}>
          <div className={styles.profileRow}>
            <span className={styles.label}>Email</span>
            <span className={styles.value}>{user.email}</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Puzzle</h3>
        <div className={styles.card}>
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Show Timer</span>
              <span className={styles.settingDescription}>
                Display a timer while solving puzzles
              </span>
            </div>
            <Switch.Root
              checked={settings.showTimer}
              onCheckedChange={(checked) => updateSettings({ showTimer: checked })}
              className={styles.switch}
            >
              <Switch.Thumb className={styles.thumb} />
            </Switch.Root>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Account</h3>
        <div className={styles.card}>
          <motion.button
            className={styles.signOutBtn}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => db.auth.signOut()}
          >
            Sign out
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

export function Settings() {
  const { isLoading, user } = db.useAuth()

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <SettingsContent />
}
