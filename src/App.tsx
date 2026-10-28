import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import RequireAuth from './components/RequireAuth';
import AppLayout from './components/Layout/AppLayout';
import ChatPage from './pages/ChatPage';
import VideoEditorPage from './pages/VideoEditorPage';
import SettingsPage from './pages/SettingsPage';
import BillingPage from './pages/BillingPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import './index.css';

function AgentBuilderBetaGate() {
  return <main className="flex min-h-full flex-1 items-center justify-center bg-[#09090b] p-6 text-white"><section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl sm:p-10"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-200"><Lock size={25} /></div><p className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200"><Sparkles size={14} /> Private beta</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Agent Builder is not open yet.</h1><p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-slate-300">We are hardening workflow security and reliability before inviting beta users. Access is disabled for every plan while the private beta is closed.</p><Link to="/app/chat" className="mt-7 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200">Return to AI Chat</Link></section></main>;
}

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
            <Route path="agent-builder" element={<AgentBuilderBetaGate />} />
            <Route path="video-editor" element={<VideoEditorPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="/agent-builder" element={<Navigate to="/app/agent-builder" replace />} />
        <Route path="/video-editor" element={<Navigate to="/app/video-editor" replace />} />
        <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
        <Route path="/billing" element={<Navigate to="/app/billing" replace />} />
        <Route path="/chat" element={<Navigate to="/app/chat" replace />} />
        <Route path="/info/:slug" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/app/chat" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
