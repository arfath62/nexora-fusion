import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import RequireAuth from './components/RequireAuth';
import AppLayout from './components/Layout/AppLayout';
import ChatPage from './pages/ChatPage';
import AgentBuilderPage from './pages/AgentBuilderPage';
import VideoEditorPage from './pages/VideoEditorPage';
import SettingsPage from './pages/SettingsPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<RegisterPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Navigate to="/app/chat" replace />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="agent-builder" element={<AgentBuilderPage />} />
            <Route path="video-editor" element={<VideoEditorPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="/agent-builder" element={<Navigate to="/app/agent-builder" replace />} />
        <Route path="/video-editor" element={<Navigate to="/app/video-editor" replace />} />
        <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
        <Route path="/chat" element={<Navigate to="/app/chat" replace />} />
        <Route path="/info/:slug" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/app/chat" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
