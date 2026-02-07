import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Layout } from "./components/Layout/Layout"
import { DailyCrossword } from "./routes/DailyCrossword"
import { AdminDashboard } from "./routes/AdminDashboard"
import { Login } from "./routes/Login"
import { Settings } from "./routes/Settings"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DailyCrossword />} />
          <Route path="/login" element={<Login />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
