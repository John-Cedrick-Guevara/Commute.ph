import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import HomePage from './pages/HomePage'
import HowItWorksPage from './pages/HowItWorksPage'

// Loaded only when an admin opens /admin, so commuters don't download it
const AdminApp = lazy(() => import('./admin/AdminApp'))

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="how-it-works" element={<HowItWorksPage />} />
      </Route>
      <Route path="/admin/*" element={<Suspense fallback={null}><AdminApp /></Suspense>} />
    </Routes>
  )
}
