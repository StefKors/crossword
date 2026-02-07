import { Suspense, lazy } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Layout } from "./components/Layout/Layout"

// Lazy-load all route pages for code splitting
const DailyCrossword = lazy(() =>
  import("./routes/DailyCrossword").then((m) => ({ default: m.DailyCrossword })),
)
const AdminDashboard = lazy(() =>
  import("./routes/AdminDashboard").then((m) => ({ default: m.AdminDashboard })),
)
const Login = lazy(() => import("./routes/Login").then((m) => ({ default: m.Login })))
const Settings = lazy(() => import("./routes/Settings").then((m) => ({ default: m.Settings })))

function PageLoader() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "4rem",
        color: "var(--color-text-secondary)",
      }}
    >
      Loading...
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<DailyCrossword />} />
            <Route path="/login" element={<Login />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
