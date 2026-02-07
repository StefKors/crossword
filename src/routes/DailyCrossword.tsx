import styles from "./DailyCrossword.module.css"

export function DailyCrossword() {
  return (
    <div className={styles.page}>
      <h2>Daily Crossword</h2>
      <p className={styles.subtitle}>Today&apos;s puzzle will appear here.</p>
    </div>
  )
}
