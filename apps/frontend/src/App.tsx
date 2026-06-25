import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SetupPage from './pages/SetupPage';
import TeachingPage from './pages/TeachingPage';
import EvaluationPage from './pages/EvaluationPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/teaching" element={<TeachingPage />} />
        <Route path="/evaluation" element={<EvaluationPage />} />
      </Routes>
    </BrowserRouter>
  );
}
