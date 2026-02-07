import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Layout } from "./components/Layout/Layout"
import { DailyCrossword } from "./routes/DailyCrossword"
import { AdminDashboard } from "./routes/AdminDashboard"
import { Login } from "./routes/Login"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DailyCrossword />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
