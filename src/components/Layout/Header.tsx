import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, Search, User, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import databaseService from '../../services/DatabaseService';

type HeaderSettings = {
  name?: string;
  email?: string;
  avatarDataUrl?: string;
  notifications?: {
    product?: boolean;
    workflow?: boolean;
    security?: boolean;
    emailDigest?: boolean;
  };
};

export default function Header() {
  const navigate = useNavigate();
  const { user, logout, isApiConfigured, token } = useAuth();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [settings, setSettings] = useState<HeaderSettings | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    databaseService
      .getSettings<HeaderSettings>()
      .then((stored) => {
        if (!cancelled) setSettings(stored);
      })
      .catch(() => undefined);

    const onSettings = (event: Event) => {
      setSettings((event as CustomEvent<HeaderSettings>).detail);
    };
    window.addEventListener('nexora:settings-updated', onSettings);
    return () => {
      cancelled = true;
      window.removeEventListener('nexora:settings-updated', onSettings);
    };
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <header className="z-10 flex h-16 items-center justify-between border-b border-white/10 bg-black/20 px-4 backdrop-blur-md">
      <div className="relative hidden max-w-md flex-1 md:block">
        <div
          className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 ${isSearchFocused ? 'text-indigo-400' : 'text-gray-400'}`}
        >
          <Search size={16} />
        </div>
        <motion.input
          type="search"
          placeholder="Search everything..."
          className="h-9 w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          animate={{
            boxShadow: isSearchFocused ? '0 0 0 2px rgba(99, 102, 241, 0.3)' : '0 0 0 0 rgba(99, 102, 241, 0)',
          }}
        />
      </div>

      <div className="ml-auto flex items-center space-x-2 sm:space-x-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => setBellOpen(!bellOpen)}
            className="relative rounded-full p-2 hover:bg-white/5"
            aria-expanded={bellOpen}
            aria-haspopup="true"
          >
            <Bell size={20} className="text-gray-300" />
            {(settings?.notifications?.product ?? true) && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-indigo-500" />
            )}
          </button>
          {bellOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-lg border border-white/10 bg-black/90 p-4 text-sm text-gray-300 shadow-xl backdrop-blur-xl">
              <p className="font-medium text-white">Notifications</p>
              <p className="mt-2 text-xs text-gray-400">
                {settings?.notifications?.product === false
                  ? 'Product notifications are turned off in Settings.'
                  : 'You are all caught up. Product and workflow alerts will show here.'}
              </p>
              <button
                type="button"
                className="mt-3 text-xs text-indigo-400 hover:text-indigo-300"
                onClick={() => setBellOpen(false)}
              >
                Close
              </button>
            </div>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
            aria-expanded={menuOpen}
            aria-haspopup="true"
            aria-label="Account menu"
          >
            {settings?.avatarDataUrl ? (
              <img src={settings.avatarDataUrl} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <User size={16} className="text-white" />
            )}
          </button>
          {menuOpen && (
            <motion.div
              className="absolute right-0 mt-2 w-52 origin-top-right overflow-hidden rounded-lg border border-white/10 bg-black/90 shadow-xl backdrop-blur-xl"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="border-b border-white/10 px-4 py-3">
                <p className="text-sm font-medium text-white">
                  {settings?.name?.trim() || user?.name?.trim() || 'Nexora user'}
                </p>
                <p className="text-xs text-gray-400">{settings?.email || user?.email || 'Local workspace'}</p>
                {isApiConfigured && !token && (
                  <p className="mt-1 text-[10px] text-amber-200/90">API mode: log in from the marketing site to sync.</p>
                )}
              </div>
              <div className="py-1">
                <Link
                  to="/app/settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-white/10"
                  onClick={() => setMenuOpen(false)}
                >
                  <Settings size={14} />
                  Settings
                </Link>
                {isApiConfigured && token && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/10"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                      navigate('/');
                    }}
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                )}
                {(!isApiConfigured || !token) && (
                  <Link
                    to="/login"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-300 hover:bg-white/10"
                    onClick={() => setMenuOpen(false)}
                  >
                    Log in for cloud sync
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </header>
  );
}
