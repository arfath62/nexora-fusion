import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Check,
  CircleHelp,
  Copy,
  Eye,
  EyeOff,
  Key,
  Lock,
  Moon,
  Save,
  Sun,
  Trash2,
  Upload,
  User,
  Wand2,
} from 'lucide-react';
import databaseService from '../services/DatabaseService';
import { useAuth } from '../contexts/AuthContext';

type ThemeMode = 'dark' | 'light' | 'system';

type ApiKeyRecord = {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsedAt?: string;
};

type SupportTicket = {
  id: string;
  subject: string;
  message: string;
  createdAt: string;
  status: 'Open';
};

interface UserSettings {
  name: string;
  email: string;
  username: string;
  language: string;
  theme: ThemeMode;
  accentColor: string;
  avatarDataUrl?: string;
  notifications: {
    product: boolean;
    workflow: boolean;
    security: boolean;
    emailDigest: boolean;
  };
  privacy: {
    saveHistory: boolean;
    trainingOptIn: boolean;
    publicProfile: boolean;
  };
  apiKeys: ApiKeyRecord[];
  supportTickets: SupportTicket[];
}

const accentOptions = [
  { id: 'indigo', label: 'Indigo', className: 'bg-indigo-500' },
  { id: 'sky', label: 'Sky', className: 'bg-sky-500' },
  { id: 'emerald', label: 'Emerald', className: 'bg-emerald-500' },
  { id: 'rose', label: 'Rose', className: 'bg-rose-500' },
  { id: 'amber', label: 'Amber', className: 'bg-amber-500' },
];

const defaultSettings = (user?: { name: string | null; email: string } | null): UserSettings => ({
  name: user?.name || 'Nexora user',
  email: user?.email || 'local@nexora.app',
  username: (user?.email?.split('@')[0] || 'nexora-user').replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
  language: 'English (US)',
  theme: 'dark',
  accentColor: 'indigo',
  notifications: {
    product: true,
    workflow: true,
    security: true,
    emailDigest: false,
  },
  privacy: {
    saveHistory: true,
    trainingOptIn: false,
    publicProfile: false,
  },
  apiKeys: [],
  supportTickets: [],
});

const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const makeApiKey = () => `nx_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;

function settingEvent(settings: UserSettings) {
  window.dispatchEvent(new CustomEvent('nexora:settings-updated', { detail: settings }));
}

export default function SettingsPage() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<UserSettings>(() => defaultSettings(user));
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState('All changes are local until saved.');
  const [newKeyName, setNewKeyName] = useState('Production key');
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      try {
        const stored = await databaseService.getSettings<Partial<UserSettings>>();
        if (cancelled) return;
        const merged = {
          ...defaultSettings(user),
          ...stored,
          notifications: {
            ...defaultSettings(user).notifications,
            ...(stored?.notifications ?? {}),
          },
          privacy: {
            ...defaultSettings(user).privacy,
            ...(stored?.privacy ?? {}),
          },
          apiKeys: stored?.apiKeys ?? [],
          supportTickets: stored?.supportTickets ?? [],
        };
        setSettings(merged);
        settingEvent(merged);
      } catch (error) {
        console.error('Failed to load settings:', error);
        setStatus('Could not load saved settings.');
      }
    };

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    document.documentElement.dataset.nexoraTheme = settings.theme;
    document.documentElement.dataset.nexoraAccent = settings.accentColor;
  }, [settings.theme, settings.accentColor]);

  const initials = useMemo(() => {
    return settings.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'NX';
  }, [settings.name]);

  const updateSettings = (next: Partial<UserSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...next };
      settingEvent(updated);
      return updated;
    });
    setStatus('Unsaved changes.');
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await databaseService.saveSettings(settings);
      settingEvent(settings);
      setStatus('Saved.');
    } catch (error) {
      console.error('Failed to save settings:', error);
      setStatus('Save failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const onAvatarSelected = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatus('Choose an image file for your profile photo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateSettings({ avatarDataUrl: String(reader.result) });
    };
    reader.readAsDataURL(file);
  };

  const generateApiKey = () => {
    const trimmedName = newKeyName.trim() || 'API key';
    const key: ApiKeyRecord = {
      id: makeId(),
      name: trimmedName,
      key: makeApiKey(),
      createdAt: new Date().toISOString(),
    };
    updateSettings({ apiKeys: [key, ...settings.apiKeys] });
    setRevealedKeys((prev) => ({ ...prev, [key.id]: true }));
    setNewKeyName('Production key');
  };

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setStatus('API key copied.');
    } catch {
      setStatus('Copy failed. Reveal the key and copy it manually.');
    }
  };

  const revokeApiKey = (id: string) => {
    updateSettings({ apiKeys: settings.apiKeys.filter((key) => key.id !== id) });
  };

  const createSupportTicket = () => {
    const subject = supportSubject.trim();
    const message = supportMessage.trim();
    if (!subject || !message) {
      setStatus('Add a subject and message before sending support.');
      return;
    }

    const ticket: SupportTicket = {
      id: makeId(),
      subject,
      message,
      createdAt: new Date().toISOString(),
      status: 'Open',
    };
    updateSettings({ supportTickets: [ticket, ...settings.supportTickets] });
    setSupportSubject('');
    setSupportMessage('');
    setStatus(`Support request ${ticket.id.slice(0, 8)} created. Save to keep it.`);
  };

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <motion.div
        className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="mt-2 text-sm text-gray-400">Real account, workspace, privacy, and API preferences.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{status}</span>
          <button
            type="button"
            onClick={saveSettings}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            <Save size={16} />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="h-fit rounded-lg border border-white/10 bg-white/5 p-2">
          {[
            ['account', User, 'Account'],
            ['appearance', Moon, 'Appearance'],
            ['notifications', Bell, 'Notifications'],
            ['privacy', Lock, 'Privacy'],
            ['api', Key, 'API Keys'],
            ['support', CircleHelp, 'Support'],
          ].map(([id, Icon, label]) => (
            <a
              key={String(id)}
              href={`#${id}`}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
            >
              <Icon size={16} />
              {String(label)}
            </a>
          ))}
        </nav>

        <div className="space-y-6">
          <section id="account" className="rounded-lg border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-white">Account</h2>
            </div>
            <div className="space-y-5 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-indigo-500 to-sky-500 text-xl font-bold text-white">
                  {settings.avatarDataUrl ? (
                    <img src={settings.avatarDataUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => onAvatarSelected(event.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
                  >
                    <Upload size={15} />
                    Upload photo
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ avatarDataUrl: undefined })}
                    className="inline-flex items-center gap-2 rounded-md bg-white/5 px-3 py-2 text-sm text-gray-300 hover:bg-white/10"
                  >
                    <Trash2 size={15} />
                    Remove
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-gray-400">
                  Name
                  <input
                    value={settings.name}
                    onChange={(event) => updateSettings({ name: event.target.value })}
                    className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-indigo-400"
                  />
                </label>
                <label className="space-y-1 text-sm text-gray-400">
                  Email
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(event) => updateSettings({ email: event.target.value })}
                    className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-indigo-400"
                  />
                </label>
                <label className="space-y-1 text-sm text-gray-400">
                  Username
                  <input
                    value={settings.username}
                    onChange={(event) => updateSettings({ username: event.target.value })}
                    className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-indigo-400"
                  />
                </label>
                <label className="space-y-1 text-sm text-gray-400">
                  Language
                  <select
                    value={settings.language}
                    onChange={(event) => updateSettings({ language: event.target.value })}
                    className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-indigo-400"
                  >
                    <option>English (US)</option>
                    <option>Spanish</option>
                    <option>French</option>
                    <option>German</option>
                    <option>Japanese</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section id="appearance" className="rounded-lg border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-white">Appearance</h2>
            </div>
            <div className="space-y-5 p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  ['dark', Moon, 'Dark'],
                  ['light', Sun, 'Light'],
                  ['system', Wand2, 'System'],
                ].map(([mode, Icon, label]) => (
                  <button
                    key={String(mode)}
                    type="button"
                    onClick={() => updateSettings({ theme: mode as ThemeMode })}
                    className={`flex items-center justify-between rounded-lg border p-4 text-left transition ${
                      settings.theme === mode ? 'border-indigo-400 bg-indigo-500/15' : 'border-white/10 bg-black/20 hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm text-white">
                      <Icon size={16} />
                      {String(label)}
                    </span>
                    {settings.theme === mode && <Check size={16} className="text-indigo-300" />}
                  </button>
                ))}
              </div>

              <div>
                <p className="mb-3 text-sm text-gray-400">Accent color</p>
                <div className="flex flex-wrap gap-3">
                  {accentOptions.map((accent) => (
                    <button
                      key={accent.id}
                      type="button"
                      title={accent.label}
                      aria-label={`Use ${accent.label} accent`}
                      onClick={() => updateSettings({ accentColor: accent.id })}
                      className={`h-9 w-9 rounded-full ${accent.className} ${
                        settings.accentColor === accent.id ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section id="notifications" className="rounded-lg border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-white">Notifications</h2>
            </div>
            <div className="divide-y divide-white/10">
              {[
                ['product', 'Product updates', 'Show releases and workspace notices in the header.'],
                ['workflow', 'Workflow alerts', 'Notify when agents or video jobs need attention.'],
                ['security', 'Security alerts', 'Keep sign-in and API key warnings enabled.'],
                ['emailDigest', 'Weekly email digest', 'Send a summary to your account email.'],
              ].map(([key, title, description]) => (
                <ToggleRow
                  key={key}
                  title={title}
                  description={description}
                  checked={settings.notifications[key as keyof UserSettings['notifications']]}
                  onChange={(checked) =>
                    updateSettings({
                      notifications: { ...settings.notifications, [key]: checked },
                    })
                  }
                />
              ))}
            </div>
          </section>

          <section id="privacy" className="rounded-lg border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-white">Privacy</h2>
            </div>
            <div className="divide-y divide-white/10">
              {[
                ['saveHistory', 'Save chat and project history', 'Turn this off before starting private sessions.'],
                ['trainingOptIn', 'Allow product improvement data', 'Keeps your content out unless you choose to opt in.'],
                ['publicProfile', 'Public profile', 'Make your name and avatar visible to shared workspaces.'],
              ].map(([key, title, description]) => (
                <ToggleRow
                  key={key}
                  title={title}
                  description={description}
                  checked={settings.privacy[key as keyof UserSettings['privacy']]}
                  onChange={(checked) =>
                    updateSettings({
                      privacy: { ...settings.privacy, [key]: checked },
                    })
                  }
                />
              ))}
            </div>
          </section>

          <section id="api" className="rounded-lg border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-white">API Keys</h2>
            </div>
            <div className="space-y-4 p-5">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={newKeyName}
                  onChange={(event) => setNewKeyName(event.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-indigo-400"
                />
                <button
                  type="button"
                  onClick={generateApiKey}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  <Key size={16} />
                  Generate key
                </button>
              </div>

              <div className="space-y-2">
                {settings.apiKeys.length === 0 && (
                  <p className="rounded-md border border-dashed border-white/10 p-4 text-sm text-gray-400">No API keys yet.</p>
                )}
                {settings.apiKeys.map((apiKey) => {
                  const shown = revealedKeys[apiKey.id];
                  return (
                    <div key={apiKey.id} className="rounded-md border border-white/10 bg-black/20 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-medium text-white">{apiKey.name}</p>
                          <p className="mt-1 truncate font-mono text-xs text-gray-400">
                            {shown ? apiKey.key : `${apiKey.key.slice(0, 8)}${'*'.repeat(24)}`}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Created {new Date(apiKey.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setRevealedKeys((prev) => ({ ...prev, [apiKey.id]: !shown }))}
                            className="rounded-md bg-white/10 p-2 text-gray-200 hover:bg-white/15"
                            aria-label={shown ? 'Hide key' : 'Reveal key'}
                          >
                            {shown ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyKey(apiKey.key)}
                            className="rounded-md bg-white/10 p-2 text-gray-200 hover:bg-white/15"
                            aria-label="Copy key"
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => revokeApiKey(apiKey.id)}
                            className="rounded-md bg-red-500/15 p-2 text-red-200 hover:bg-red-500/25"
                            aria-label="Revoke key"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section id="support" className="rounded-lg border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-white">Support</h2>
            </div>
            <div className="space-y-4 p-5">
              <input
                value={supportSubject}
                onChange={(event) => setSupportSubject(event.target.value)}
                placeholder="Subject"
                className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white outline-none placeholder:text-gray-500 focus:border-indigo-400"
              />
              <textarea
                value={supportMessage}
                onChange={(event) => setSupportMessage(event.target.value)}
                placeholder="What do you need help with?"
                rows={4}
                className="w-full resize-none rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white outline-none placeholder:text-gray-500 focus:border-indigo-400"
              />
              <button
                type="button"
                onClick={createSupportTicket}
                className="rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
              >
                Create support request
              </button>
              {settings.supportTickets.length > 0 && (
                <div className="space-y-2">
                  {settings.supportTickets.slice(0, 3).map((ticket) => (
                    <div key={ticket.id} className="rounded-md border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium text-white">{ticket.subject}</p>
                        <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200">{ticket.status}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-400">{ticket.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-1 text-xs text-gray-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-indigo-500' : 'bg-white/20'}`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`}
        />
      </button>
    </div>
  );
}
