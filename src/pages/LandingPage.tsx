import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getApiBaseUrl } from '../lib/apiEnv';
import { publicPlanCatalog } from '../lib/featureAccess';
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  ChevronDown,
  Clapperboard,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

const serif = '"Instrument Serif", Georgia, serif';

const featureCards = [
  {
    icon: MessageSquare,
    title: 'AI Chat Assistant',
    description:
      'Instant answers, written content, emails and problem solving — all from one intelligent assistant.',
  },
  {
    icon: Bot,
    title: 'AI Agents',
    description:
      'Private beta. The agent builder is locked for all users while we prepare it for production workflows.',
  },
  {
    icon: Clapperboard,
    title: 'Video studio',
    description:
      'Shape timelines, keep projects in sync, and queue renders when your backend is connected.',
  },
];

const faqItems = [
  {
    q: 'What is Nexora Fusion?',
    a: 'Nexora Fusion is an AI-powered workspace: chat, visual agent builder, and video tools in one place — built for focus and optional cloud sync.',
  },
  {
    q: 'Do I need to write code?',
    a: 'No. You can generate content, sketch agents, and automate workflows from the UI. Developers can still plug in their own API when they want.',
  },
  {
    q: 'Is there a free tier?',
    a: 'Nexora is moving to paid subscriptions: Starter at Rs. 500, Growth at Rs. 1,500, and Scale at Rs. 2,500 per month.',
  },
  {
    q: 'Who is Nexora for?',
    a: 'Students, freelancers, and creators who want one calm studio instead of a pile of single-purpose chat tabs.',
  },
];

function useMarketingPrimaryHref(): string {
  const { token, isApiConfigured } = useAuth();
  return !isApiConfigured || token ? '/app/chat' : '/signup';
}

function useProtectedAppHref(path: string): string {
  const { token, isApiConfigured } = useAuth();
  if (!isApiConfigured || token) return path;
  return `/login?next=${encodeURIComponent(path)}`;
}

function DotLogo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="grid grid-cols-3 gap-[3px]" aria-hidden>
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className="h-[5px] w-[5px] rounded-full bg-slate-900" />
        ))}
      </span>
      <span className="text-[1.05rem] font-semibold tracking-tight text-slate-900 lowercase">nexora</span>
    </span>
  );
}

function NavPill({ scrolled }: { scrolled: boolean }) {
  const { token, isApiConfigured } = useAuth();
  const primaryHref = !isApiConfigured || token ? '/app/chat' : '/signup';

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex justify-center px-3 pt-4 sm:px-6 sm:pt-5"
    >
      <div
        className={`pointer-events-auto flex w-full max-w-4xl items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 py-2 pl-3 pr-2 shadow-[0_8px_40px_-12px_rgba(15,23,42,0.15)] backdrop-blur-md transition-[box-shadow,background-color] duration-500 sm:gap-3 sm:py-2.5 sm:pl-4 sm:pr-2.5 ${
          scrolled ? 'bg-white/95 shadow-[0_12px_48px_-12px_rgba(15,23,42,0.2)]' : ''
        }`}
      >
        <Link to="/" className="shrink-0 pl-0.5">
          <DotLogo />
        </Link>
        <nav className="flex min-w-0 flex-1 items-center justify-center gap-3 overflow-x-auto whitespace-nowrap px-1 text-xs font-medium text-slate-600 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-5 sm:text-sm md:gap-6 [&::-webkit-scrollbar]:hidden">
          <a href="#about" className="transition-colors hover:text-slate-900">
            About
          </a>
          <a href="#features" className="transition-colors hover:text-slate-900">
            Features
          </a>
          <a href="#how" className="transition-colors hover:text-slate-900 sm:hidden">
            How
          </a>
          <a href="#how" className="hidden transition-colors hover:text-slate-900 sm:inline">
            How it works
          </a>
          <a href="#pricing" className="transition-colors hover:text-slate-900">
            Pricing
          </a>
        </nav>
        {isApiConfigured && !token && (
          <Link
            to="/login"
            className="hidden shrink-0 text-xs font-medium text-slate-600 transition hover:text-slate-900 sm:inline"
          >
            Log in
          </Link>
        )}
        <Link
          to={primaryHref}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800 sm:gap-1.5 sm:px-4 sm:text-sm"
        >
          <span className="hidden min-[400px]:inline">Get started</span>
          <span className="min-[400px]:hidden">Start</span>
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>
    </motion.header>
  );
}

export default function LandingPage() {
  const primaryHref = useMarketingPrimaryHref();
  const settingsHref = useProtectedAppHref('/app/settings');

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [scrolled, setScrolled] = useState(false);
  const [waitlistSent, setWaitlistSent] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const prevRootOverflow = root?.style.overflow ?? '';
    const prevRootHeight = root?.style.height ?? '';
    const prevScrollBehavior = html.style.scrollBehavior;
    const prevBodyBg = body.style.backgroundColor;
    const prevBodyColor = body.style.color;

    html.style.overflow = 'auto';
    body.style.overflow = 'auto';
    html.style.scrollBehavior = 'smooth';
    body.style.backgroundColor = '#f8fafc';
    body.style.color = '#0f172a';
    if (root) {
      root.style.overflow = 'visible';
      root.style.height = 'auto';
      root.style.minHeight = '100%';
    }

    const link = document.createElement('link');
    link.href =
      'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;1,14..32,400&family=JetBrains+Mono:wght@400;500&display=swap';
    link.rel = 'stylesheet';
    link.dataset.nexoraLandingFont = '1';
    document.head.appendChild(link);

    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      html.style.scrollBehavior = prevScrollBehavior;
      body.style.backgroundColor = prevBodyBg;
      body.style.color = prevBodyColor;
      if (root) {
        root.style.overflow = prevRootOverflow;
        root.style.height = prevRootHeight;
        root.style.minHeight = '';
      }
      document.querySelector('link[data-nexora-landing-font="1"]')?.remove();
    };
  }, []);

  async function onWaitlistSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setWaitlistError(null);
    const base = getApiBaseUrl();
    const form = e.currentTarget;
    const emailEl = form.elements.namedItem('email') as HTMLInputElement | null;
    const nameEl = form.elements.namedItem('name') as HTMLInputElement | null;
    const email = emailEl?.value?.trim() ?? '';
    const name = nameEl?.value?.trim() ?? '';
    if (!email) {
      setWaitlistError('Please enter your email.');
      return;
    }
    if (!base) {
      setWaitlistError('Start the Nexora API (see README) or set VITE_API_BASE_URL to join the waitlist.');
      return;
    }
    setWaitlistLoading(true);
    try {
      const res = await fetch(`${base}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: name || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { error?: string }).error || 'Could not join waitlist');
      }
      setWaitlistSent(true);
      form.reset();
    } catch (err) {
      setWaitlistError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setWaitlistLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen text-slate-900 antialiased selection:bg-sky-200/60 selection:text-slate-900"
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        background:
          'radial-gradient(ellipse 85% 55% at 50% -10%, rgba(186, 230, 253, 0.55) 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(224, 242, 254, 0.4) 0%, transparent 45%), linear-gradient(180deg, #f0f7ff 0%, #f8fafc 28%, #f8fafc 100%)',
      }}
    >
      <NavPill scrolled={scrolled} />

      <main className="pt-28">
        {/* Light hero */}
        <section className="mx-auto max-w-3xl px-4 pb-20 pt-8 text-center sm:px-6 sm:pb-24 sm:pt-10">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            <Sparkles className="h-3.5 w-3.5 text-sky-500" strokeWidth={2} />
            AI THAT WORKS FOR YOU
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.55 }}
            className="text-pretty text-4xl font-semibold leading-[1.12] tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.1] lg:text-[3.25rem] lg:leading-[1.08]"
          >
            Build, automate{' '}
            <span className="italic font-normal text-slate-800" style={{ fontFamily: serif }}>
              and
            </span>{' '}
            grow with AI.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.55 }}
            className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg"
          >
            Nexora is your all-in-one AI platform for students, freelancers and creators — generate content, automate
            workflows and ship smart agents without writing a line of code.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.55 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              to={primaryHref}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800"
            >
              Get started free
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-6 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-white"
            >
              Explore features
            </a>
          </motion.div>
        </section>

        {/* Brand artwork leads the product story. */}
        <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 sm:pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="aspect-[3/2] w-full overflow-hidden rounded-[2rem] border border-slate-200/80 bg-slate-950 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.35)] sm:rounded-[2.25rem]"
          >
            <img
              src="/images/nexora-hero.png"
              alt="Nexora — retro workstations above the clouds"
              className="h-full w-full object-cover"
            />
          </motion.div>
        </section>

        {/* Product previews follow the brand artwork. */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
          <div className="grid gap-5 lg:grid-cols-2">
            <motion.article initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-5 shadow-xl sm:p-6">
              <div className="mb-5 flex items-center justify-between text-white"><div><p className="text-xs font-medium text-sky-300">Nexora Video Studio</p><h3 className="mt-1 text-lg font-semibold">Edit by saying what you want.</h3></div><Clapperboard className="h-5 w-5 text-sky-300" /></div>
              <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-slate-900 to-cyan-500 p-4"><motion.div animate={{ scale: [1, 1.08, 1], x: [0, -6, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,.38),transparent_26%),radial-gradient(circle_at_70%_65%,rgba(34,211,238,.55),transparent_25%)]" /><div className="relative flex h-full items-end"><motion.div animate={{ width: ['27%', '60%', '42%'] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} className="h-2 rounded-full bg-white/90" /></div><motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2.2, repeat: Infinity }} className="absolute bottom-4 left-4 right-4 rounded-xl border border-white/15 bg-slate-950/80 p-3 text-xs text-white backdrop-blur"><span className="text-sky-300">AI edit</span> · Add a cinematic look, trim pauses, and add captions <span className="ml-1 inline-block h-3 w-px animate-pulse bg-white" /></motion.div></div>
            </motion.article>
            <motion.article initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.08 }} className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
              <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-medium text-sky-600">Nexora AI Chat</p><h3 className="mt-1 text-lg font-semibold text-slate-900">From prompt to polished work.</h3></div><MessageSquare className="h-5 w-5 text-sky-600" /></div>
              <div className="flex aspect-[16/10] flex-col rounded-2xl border border-slate-100 bg-slate-50 p-4"><motion.div initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="max-w-[76%] rounded-2xl rounded-tl-sm bg-white p-3 text-xs text-slate-600 shadow-sm">Turn this rough brief into a launch plan.</motion.div><motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.5 }} className="mt-3 max-w-[88%] self-end rounded-2xl rounded-tr-sm bg-slate-900 p-3 text-xs leading-relaxed text-white">I&apos;ve created the priorities, milestones and investor-ready narrative.</motion.div><div className="mt-auto flex gap-1.5"><motion.span animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 1.5, repeat: Infinity }} className="h-2 w-2 rounded-full bg-sky-500" /><span className="text-[11px] text-slate-400">Nexora is thinking</span></div></div>
            </motion.article>
          </div>
        </section>

        {/* About */}
        <section id="about" className="border-y border-slate-200/80 bg-white/60 py-20 backdrop-blur-sm sm:py-28">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-slate-200/90">
            <div className="lg:pr-14">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">• About Nexora</p>
              <h2 className="mt-4 max-w-md text-pretty text-3xl font-semibold leading-[1.15] tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem]">
                More than a
                <br />
                chatbot.
                <br />
                <span className="italic font-normal text-slate-700" style={{ fontFamily: serif }}>
                  An entire studio.
                </span>
              </h2>
            </div>
            <div className="lg:pl-14">
              <p className="text-base leading-relaxed text-slate-700 sm:text-lg">
                Nexora is an AI-powered platform that goes beyond simple chatbots. It offers tools, agents and automation
                systems that help you streamline work, boost productivity and create high-quality outputs effortlessly.
              </p>
              <p className="mt-5 text-sm leading-relaxed text-slate-500 sm:text-base">
                Whether you&apos;re a student, freelancer or creator, Nexora gives you smart solutions tailored to the
                way you actually work — quietly, in the background.
              </p>
              <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-4">
                {[
                  { n: '12+', l: 'AI tools' },
                  { n: '0', l: 'Lines of code' },
                  { n: '24/7', l: 'Always on' },
                ].map((s) => (
                  <div
                    key={s.l}
                    className="rounded-2xl border border-slate-100 bg-white px-3 py-4 text-center shadow-sm sm:px-4 sm:py-5"
                  >
                    <p className="text-2xl font-semibold tabular-nums text-slate-900 sm:text-3xl">{s.n}</p>
                    <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500 sm:text-[10px]">
                      {s.l}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">• Features</p>
          <h2 className="mt-4 max-w-2xl text-pretty text-3xl font-semibold leading-[1.15] tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem]">
            A studio of AI tools,
            <br />
            <span className="italic font-normal text-slate-700" style={{ fontFamily: serif }}>
              stitched together.
            </span>
          </h2>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((card, i) => (
              <motion.article
                key={card.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.04, duration: 0.45 }}
                className="group relative overflow-hidden rounded-[1.35rem] border border-slate-200/90 bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_48px_-12px_rgba(15,23,42,0.12)] sm:p-7"
              >
                <div
                  className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-sky-100/90 transition-transform duration-500 group-hover:scale-110"
                  aria-hidden
                />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <card.icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <Link
                    to={primaryHref}
                    className="relative rounded-lg p-1.5 text-slate-400 transition group-hover:text-slate-700"
                    aria-label="Open Nexora"
                  >
                    <ArrowUpRight className="h-5 w-5" strokeWidth={2} />
                  </Link>
                </div>
                <h3 className="relative mt-5 text-lg font-semibold text-slate-900">{card.title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-slate-600">{card.description}</p>
              </motion.article>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y border-slate-200/80 bg-slate-50/80 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">• How it works</p>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Three calm steps. No noise.
            </h2>
            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {[
                {
                  step: '01',
                  title: 'Open the studio',
                  body: 'Launch Nexora in your browser — your sessions and projects stay under your control.',
                },
                {
                  step: '02',
                  title: 'Pick a tool',
                  body: 'Chat on Starter, jump into the video workspace on Growth, and watch for AI Agents when beta opens.',
                },
                {
                  step: '03',
                  title: 'Ship & scale',
                  body: 'Stay local-first, or connect your API when you need sync, accounts, and background jobs.',
                },
              ].map((b) => (
                <div key={b.step} className="relative rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
                  <span
                    className="text-xs font-medium uppercase tracking-widest text-slate-400"
                    style={{ fontFamily: '"JetBrains Mono", monospace' }}
                  >
                    {b.step}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{b.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">• Pricing</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Simple monthly plans</h2>
          <p className="mt-3 max-w-xl text-slate-600">
            Start with AI chat, unlock video tools on Growth, and move to Scale for higher usage. AI Agents remain
            beta locked for everyone.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {publicPlanCatalog.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-[1.35rem] border p-8 shadow-sm ${
                  plan.id === 'Growth'
                    ? 'border-slate-900/10 bg-slate-900 text-white shadow-xl'
                    : 'border-slate-200/90 bg-white text-slate-900'
                }`}
              >
                <p className={`text-sm font-medium ${plan.id === 'Growth' ? 'text-slate-300' : 'text-slate-500'}`}>
                  {plan.name}
                </p>
                <p className="mt-2 text-4xl font-semibold">{plan.displayPrice}</p>
                <p className={`mt-1 text-sm ${plan.id === 'Growth' ? 'text-slate-400' : 'text-slate-500'}`}>per month</p>
                <ul className={`mt-6 space-y-3 text-sm ${plan.id === 'Growth' ? 'text-slate-300' : 'text-slate-600'}`}>
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span className={plan.id === 'Growth' ? 'text-sky-300' : 'text-sky-600'}>+</span>
                      {feature}
                    </li>
                  ))}
                  <li className="flex gap-2">
                    <span className={plan.id === 'Growth' ? 'text-amber-200' : 'text-amber-600'}>!</span>
                    AI Agents beta locked
                  </li>
                </ul>
                <Link
                  to={primaryHref}
                  className={`mt-8 block w-full rounded-full py-3 text-center text-sm font-semibold transition ${
                    plan.id === 'Growth'
                      ? 'bg-white text-slate-900 hover:bg-slate-100'
                      : 'border border-slate-200 text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Get started
                </Link>
              </div>
            ))}
          </div>
          <div className="hidden">
            <div className="rounded-[1.35rem] border border-slate-200/90 bg-white p-8 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Starter</p>
              <p className="mt-2 text-4xl font-semibold text-slate-900">$0</p>
              <p className="mt-1 text-sm text-slate-500">Local workspace · encrypted storage options</p>
              <ul className="mt-6 space-y-3 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="text-sky-600">✓</span> AI chat & sessions
                </li>
                <li className="flex gap-2">
                  <span className="text-sky-600">✓</span> Agent builder canvas
                </li>
                <li className="flex gap-2">
                  <span className="text-sky-600">✓</span> Video workspace
                </li>
              </ul>
              <Link
                to={primaryHref}
                className="mt-8 block w-full rounded-full border border-slate-200 py-3 text-center text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Open app
              </Link>
            </div>
            <div className="relative rounded-[1.35rem] border border-slate-900/10 bg-slate-900 p-8 text-white shadow-xl">
              <span className="absolute right-6 top-6 rounded-full bg-white/15 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90">
                Full stack
              </span>
              <p className="text-sm font-medium text-slate-300">Nexora Pro</p>
              <p className="mt-2 text-4xl font-semibold">Your infra</p>
              <p className="mt-1 text-sm text-slate-400">API + database when you enable it in settings</p>
              <ul className="mt-6 space-y-3 text-sm text-slate-300">
                <li className="flex gap-2">
                  <span className="text-sky-300">✓</span> Auth & user-scoped data
                </li>
                <li className="flex gap-2">
                  <span className="text-sky-300">✓</span> Synced chat, workflows, video
                </li>
                <li className="flex gap-2">
                  <span className="text-sky-300">✓</span> Background jobs
                </li>
              </ul>
              <Link
                to={settingsHref}
                className="mt-8 block w-full rounded-full bg-white py-3 text-center text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Configure in app
              </Link>
            </div>
          </div>
        </section>

        {/* Waitlist */}
        <section id="waitlist" className="border-t border-slate-200/80 bg-white/70 py-20 backdrop-blur-sm sm:py-28">
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
            <p
              className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              <span className="text-sky-500" aria-hidden>
                ✉
              </span>
              Join the waitlist
            </p>
            <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl">
              Start building with Nexora,{' '}
              <span className="italic font-normal text-slate-800" style={{ fontFamily: serif }}>
                today.
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
              Drop your email and we&apos;ll let you in early. No spam, just the invite and the occasional product
              update.
            </p>
            <p
              className="mx-auto mt-8 max-w-lg text-[10px] uppercase tracking-[0.12em] text-slate-400 sm:text-[11px]"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              By joining you agree to our{' '}
              <Link to={settingsHref} className="text-slate-600 underline hover:text-slate-900">
                terms
              </Link>{' '}
              &{' '}
              <Link to={settingsHref} className="text-slate-600 underline hover:text-slate-900">
                privacy policy
              </Link>
              .
            </p>
            {waitlistSent ? (
              <p className="mt-6 text-sm font-medium text-sky-700">You&apos;re on the list. We&apos;ll be in touch.</p>
            ) : (
              <form
                onSubmit={onWaitlistSubmit}
                className="mx-auto mt-3 flex max-w-xl flex-col gap-3 rounded-full border border-slate-200/90 bg-white p-1.5 shadow-[0_8px_40px_-16px_rgba(15,23,42,0.12)] sm:flex-row sm:items-stretch"
              >
                <input
                  name="name"
                  type="text"
                  placeholder="Your name (optional)"
                  className="min-w-0 flex-1 rounded-full border-0 bg-transparent px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 sm:border-r sm:border-slate-100"
                />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@domain.com"
                  className="min-w-0 flex-[1.2] rounded-full border-0 bg-transparent px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                />
                <button
                  type="submit"
                  disabled={waitlistLoading}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 sm:px-6"
                >
                  {waitlistLoading ? 'Sending…' : 'Get started'}
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </button>
              </form>
            )}
            {waitlistError && (
              <p className="mx-auto mt-4 max-w-lg text-sm text-red-600" role="alert">
                {waitlistError}
              </p>
            )}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-24">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">• FAQ</p>
          <h2 className="mt-3 text-center text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Questions
          </h2>
          <div className="mt-10 space-y-2">
            {faqItems.map((item, i) => (
              <div
                key={item.q}
                className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-slate-900 transition hover:bg-slate-50/80"
                >
                  {item.q}
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                      openFaq === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="border-t border-slate-100 px-5 pb-4 pt-0 text-sm leading-relaxed text-slate-600">
                    <p className="pt-3">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-200/90 bg-white/80 pb-16 pt-16 backdrop-blur-md">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
              <div className="max-w-sm">
                <DotLogo />
                <p className="mt-4 text-sm leading-relaxed text-slate-600">
                  Build beyond tomorrow. An AI studio for students, freelancers and creators — quietly automating the
                  work you&apos;d rather not do.
                </p>
                <p
                  className="mt-6 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400"
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                >
                  © 2026 Nexora Labs · Build beyond tomorrow
                </p>
              </div>
              <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 lg:gap-14">
                {[
                  {
                    h: 'Product',
                    links: [
                      ['Features', '#features'],
                      ['Pricing', '#pricing'],
                      ['AI Chat', '/app/chat'],
                      ['Video Studio', '/app/video-editor'],
                    ],
                  },
                  {
                    h: 'Company',
                    links: [
                      ['About', '#about'],
                      ['Waitlist', '#waitlist'],
                      ['FAQ', '#faq'],
                      ['Settings', settingsHref],
                    ],
                  },
                  {
                    h: 'Resources',
                    links: [
                      ['Agent Builder', '/app/agent-builder'],
                      ['Support', settingsHref],
                      ['Account', settingsHref],
                      ['Preferences', settingsHref],
                    ],
                  },
                  {
                    h: 'Legal',
                    links: [
                      ['Privacy', settingsHref],
                      ['Terms', settingsHref],
                      ['Security', settingsHref],
                      ['Data controls', settingsHref],
                    ],
                  },
                ].map((col) => (
                  <div key={col.h}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{col.h}</p>
                    <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
                      {col.links.map(([label, href]) => (
                        <li key={label}>
                          {href.startsWith('#') ? (
                            <a href={href} className="transition hover:text-slate-900">
                              {label}
                            </a>
                          ) : (
                            <Link to={href} className="transition hover:text-slate-900">
                              {label}
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <p
              className="mt-20 select-none text-center text-[clamp(3.5rem,14vw,9rem)] font-semibold leading-none tracking-tight text-transparent sm:mt-24"
              style={{
                background: 'linear-gradient(180deg, #cbd5e1 0%, #0f172a 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
              }}
            >
              nexora.
            </p>
          </div>
        </footer>
      </main>

    </div>
  );
}
