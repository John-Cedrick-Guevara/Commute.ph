import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import HomePage from './pages/HomePage'
import HowItWorksPage from './pages/HowItWorksPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="how-it-works" element={<HowItWorksPage />} />
      </Route>
    </Routes>
  )
}
