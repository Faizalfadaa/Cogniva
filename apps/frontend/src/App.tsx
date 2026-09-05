import { Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './features/landing/LandingPage'
import HomePage from './features/home/HomePage'
import WorkspacePage from './routes/workspace/Workspace'
import EvaluationPage from './routes/evaluation/Evaluation'

export default function App() {
  return (
    <Routes>
      {/* Public marketing page is the front door; the workspace dashboard that
          used to live here moved to /home. */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/workspace/:id" element={<WorkspacePage />} />
      <Route path="/evaluation/:id" element={<EvaluationPage />} />
      {/* Unknown URLs land on the landing page — still the right introduction
          for someone who arrived from a stale or mistyped link. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
