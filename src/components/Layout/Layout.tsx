import { Outlet } from "react-router-dom"
import { Header } from "../Header/Header"
import styles from "./Layout.module.css"

export function Layout() {
  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.main}>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
