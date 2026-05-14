import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from './Header';
import Sidebar from './Sidebar';
import databaseService from '../../services/DatabaseService';

type LayoutSettings = {
  theme?: 'dark' | 'light' | 'system';
  accentColor?: string;
};

export default function AppLayout() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // Add Inter font
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  useEffect(() => {
    const applySettings = (settings?: LayoutSettings | null) => {
      const mode = settings?.theme ?? 'dark';
      const resolved =
        mode === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : mode === 'light'
            ? 'light'
            : 'dark';
      setTheme(resolved);
      document.documentElement.dataset.nexoraTheme = mode;
      document.documentElement.dataset.nexoraAccent = settings?.accentColor ?? 'indigo';
    };

    databaseService.getSettings<LayoutSettings>().then(applySettings).catch(() => undefined);
    const onSettings = (event: Event) => applySettings((event as CustomEvent<LayoutSettings>).detail);
    window.addEventListener('nexora:settings-updated', onSettings);
    return () => window.removeEventListener('nexora:settings-updated', onSettings);
  }, []);

  return (
    <div
      className={`flex h-screen w-screen overflow-hidden font-inter ${
        theme === 'light' ? 'bg-slate-100 text-slate-950' : 'bg-[#0A0A0C] text-white'
      }`}
    >
      <Sidebar />
      
      <motion.div
        className="flex-1 flex flex-col overflow-hidden relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Background gradients */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute top-0 left-[5%] w-[30%] h-[30%] bg-indigo-900/20 rounded-full filter blur-[120px] opacity-40" />
          <div className="absolute bottom-[5%] right-[10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full filter blur-[120px] opacity-30" />
          <div className="absolute bottom-[30%] left-[20%] w-[20%] h-[20%] bg-pink-900/30 rounded-full filter blur-[100px] opacity-30" />
        </div>
        
        <Header />
        
        <main className="flex-1 overflow-auto">
          <div className="h-full relative">
            <Outlet />
          </div>
        </main>
      </motion.div>
    </div>
  );
}
