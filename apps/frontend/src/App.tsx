import { Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './features/home/HomePage'
import WorkspacePage from './routes/workspace/Workspace'
import EvaluationPage from './routes/evaluation/Evaluation'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/workspace/:id" element={<WorkspacePage />} />
      <Route path="/evaluation/:id" element={<EvaluationPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}