import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './features/landing/LandingPage'
import MarketingLayout from './features/marketing/MarketingLayout'
import ProductPage from './features/marketing/pages/ProductPage'
import StudentsPage from './features/marketing/pages/StudentsPage'
import DebriefPage from './features/marketing/pages/DebriefPage'
import PricingPage from './features/marketing/pages/PricingPage'
import TechnologyPage from './features/marketing/pages/TechnologyPage'
import AboutPage from './features/marketing/pages/AboutPage'
import HomePage from './features/home/HomePage'
import WorkspacePage from './routes/workspace/Workspace'
import EvaluationPage from './routes/evaluation/Evaluation'
import { useLocale } from './i18n/LanguageProvider'
import { setVoiceAvailable } from './features/teaching-session/hooks/useLearnerVoice'

export default function App() {
  const { sessionLocale } = useLocale()

  // The learner only has an English voice, so an Indonesian session runs silent.
  // Keyed on the session's language, not the interface's: an Indonesian session
  // stays silent even when its reader has the interface in English.
  // Wired here rather than inside the player: the player knows whether it has a
  // voice, and the language layer knows nothing about audio.
  useEffect(() => {
    setVoiceAvailable(sessionLocale === 'en')
  }, [sessionLocale])

  return (
    <Routes>
      {/* The public site is the front door: the landing page plus the pages
          its menus link to, all sharing one nav and footer. The workspace
          dashboard that used to live at / moved to /home. */}
      <Route element={<MarketingLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/product" element={<ProductPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/debrief" element={<DebriefPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/technology" element={<TechnologyPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Route>
      <Route path="/home" element={<HomePage />} />
      <Route path="/workspace/:id" element={<WorkspacePage />} />
      <Route path="/evaluation/:id" element={<EvaluationPage />} />
      {/* Unknown URLs land on the landing page — still the right introduction
          for someone who arrived from a stale or mistyped link. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
