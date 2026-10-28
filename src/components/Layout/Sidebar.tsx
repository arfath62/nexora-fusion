import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CreditCard, GitMerge, Lock, Menu, MessageSquare, Settings, Video, X } from 'lucide-react';
import databaseService, { type WorkspaceSettings } from '../../services/DatabaseService';
import { getFeatureAccess, type FeatureKey } from '../../lib/featureAccess';

const navItems = [
  { icon: MessageSquare, label: 'AI Chat', path: '/app/chat' },
  { icon: GitMerge, label: 'AI Agents', path: '/app/agent-builder', feature: 'agents' },
  { icon: Video, label: 'Video Editor', path: '/app/video-editor', feature: 'video' },
  { icon: CreditCard, label: 'Billing', path: '/app/billing' },
  { icon: Settings, label: 'Settings', path: '/app/settings' },
] satisfies Array<{ icon: typeof MessageSquare; label: string; path: string; feature?: FeatureKey }>;

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [plan, setPlan] = useState<WorkspaceSettings['plan']>('Starter');

  useEffect(() => {
    let cancelled = false;
    databaseService
      .getWorkspaceSettings()
      .then((workspace) => {
        if (!cancelled) setPlan(workspace.plan);
      })
      .catch(() => {
        if (!cancelled) setPlan('Starter');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {/* Mobile menu button */}
      <div className="fixed top-4 left-4 z-50 md:hidden">
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 rounded-full bg-black/20 backdrop-blur-lg text-white hover:bg-black/30 transition-all"
        >
          {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={{ x: '-100%' }}
        animate={{ 
          x: isMobileOpen ? 0 : isCollapsed ? 'calc(-100% + 72px)' : 0,
          width: isCollapsed ? '72px' : '240px' 
        }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className={`fixed top-0 left-0 h-full z-40 flex flex-col
                   bg-black/30 backdrop-blur-xl border-r border-white/10
                   md:relative md:translate-x-0 md:z-0`}
      >
        <div className="flex items-center h-16 px-4">
          <Link
            to="/"
            className={`flex items-center min-w-0 ${isCollapsed ? 'justify-center w-full' : ''}`}
            title="Nexora home"
          >
            <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-full opacity-80" />
              <span className="relative font-bold text-white text-xl">N</span>
            </div>
            {!isCollapsed && (
              <span className="ml-3 font-bold text-xl bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 text-transparent bg-clip-text truncate">
                Nexora
              </span>
            )}
          </Link>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="ml-auto p-1 rounded-full hover:bg-white/10 transition-colors hidden md:block"
          >
            <Menu size={16} className="text-gray-400" />
          </button>
        </div>

        <nav className="flex-1 py-6 px-2">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const access = item.feature ? getFeatureAccess(item.feature, plan) : null;
              const locked = Boolean(access && !access.available);
              const target = locked ? '/app/billing' : item.path;
              return (
                <li key={item.path}>
                  <NavLink
                    to={target}
                    title={access?.message}
                    onClick={() => setIsMobileOpen(false)}
                    className={({ isActive }) => `
                      flex items-center px-3 py-2 rounded-lg transition-all
                      ${isActive && !locked
                        ? 'bg-white/10 text-white'
                        : locked
                          ? 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                          : 'text-gray-400 hover:bg-white/5 hover:text-white'
                      }
                    `}
                  >
                    <item.icon size={20} />
                    {!isCollapsed && (
                      <span className="ml-3 flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span className="truncate">{item.label}</span>
                        {locked && <Lock size={13} className="shrink-0 text-gray-500" />}
                      </span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4">
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : ''} p-3 rounded-lg bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-white/10`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center">
              <span className="text-xs font-bold text-white">AI</span>
            </div>
            {!isCollapsed && (
              <div className="ml-3">
                <p className="text-xs text-white">Nexora Pro</p>
                <p className="text-xs text-gray-400">AI Powered</p>
              </div>
            )}
          </div>
        </div>
      </motion.aside>
    </>
  );
}
