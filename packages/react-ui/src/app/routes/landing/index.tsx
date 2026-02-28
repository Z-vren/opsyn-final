import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Zap,
  GitBranch,
  Shield,
  Database,
  Bot,
  Layers,
  BookOpen,
  ChevronRight,
  User,
  LayoutDashboard,
  LogOut,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { OpSynLogoIcon } from '@/components/ui/opsyn-logo';
import { authenticationSession } from '@/lib/authentication-session';

const features = [
  {
    icon: Zap,
    title: 'Visual Flow Builder',
    description:
      'Drag-and-drop interface to build complex automation workflows without writing code.',
  },
  {
    icon: GitBranch,
    title: 'Conditional Routing',
    description:
      'Branch your workflows with routers, conditions, and loops for any business logic.',
  },
  {
    icon: Bot,
    title: 'AI-Powered Generation',
    description:
      'Describe what you need in plain English and let our AI generate the workflow for you.',
  },
  {
    icon: Layers,
    title: '200+ Integrations',
    description:
      'Connect Gmail, Slack, Notion, Sheets, GitHub, Discord, and hundreds more out of the box.',
  },
  {
    icon: Database,
    title: 'Built-in Tables',
    description:
      'Store and query data with built-in tables — no external database needed.',
  },
  {
    icon: Shield,
    title: 'Self-Hosted & Secure',
    description:
      'Deploy on your own infrastructure. Your data stays under your control, always.',
  },
];

const useCases = [
  {
    emoji: '📧',
    title: 'Email Automation',
    description:
      'Auto-sort, reply, and route emails based on content and sender.',
  },
  {
    emoji: '🔔',
    title: 'Team Notifications',
    description:
      'Alert your team on Slack or Discord when important events happen.',
  },
  {
    emoji: '📊',
    title: 'Data Sync',
    description:
      'Keep Google Sheets, Airtable, and databases in sync automatically.',
  },
  {
    emoji: '🤖',
    title: 'AI Workflows',
    description:
      'Chain LLM calls with actions to build intelligent automations.',
  },
];

const UserMenu = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90"
      >
        <User className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border bg-background p-1.5 shadow-xl">
            <Link
              to="/dashboard"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition hover:bg-accent"
            >
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              Dashboard
            </Link>
            <button
              onClick={() => {
                setOpen(false);
                authenticationSession.logOut();
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-destructive transition hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export const LandingPage = () => {
  const isLoggedIn = authenticationSession.isLoggedIn();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <OpSynLogoIcon className="h-8 w-8" />
            <span className="text-xl font-semibold tracking-tight">
              OpSyn
            </span>
          </Link>

          <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition hover:text-foreground">
              Features
            </a>
            <a href="#use-cases" className="transition hover:text-foreground">
              Use Cases
            </a>
            <Link to="/docs" className="transition hover:text-foreground">
              Docs
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                <Link to="/dashboard">
                  <Button variant="outline" size="sm">
                    <LayoutDashboard className="mr-1.5 h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
                <UserMenu />
              </>
            ) : (
              <>
                <Link to="/sign-in">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/sign-up">
                  <Button size="sm">
                    Get Started
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        <div className="mx-auto max-w-4xl px-6 pb-24 pt-20 text-center lg:pb-32 lg:pt-32">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-primary" />
            Open-Source Automation Platform
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Automate Everything.
            <br />
            <span className="text-primary">Own Everything.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            OpSyn is your self-hosted automation platform. Build workflows
            visually, connect 200+ apps, and let AI generate automations from
            plain English — all on infrastructure you control.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            {isLoggedIn ? (
              <Link to="/dashboard">
                <Button size="lg" className="px-8 text-base">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Link to="/sign-up">
                <Button size="lg" className="px-8 text-base">
                  Start Building
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
            <a href="#features">
              <Button variant="outline" size="lg" className="px-8 text-base">
                See How It Works
              </Button>
            </a>
          </div>

          <p className="mt-12 text-xs text-muted-foreground/60">
            Built on Activepieces · Trusted by thousands of teams worldwide
          </p>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section id="features" className="border-b py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Everything you need to automate
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              A complete platform for building, deploying, and managing
              workflows at any scale.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border bg-card p-6 transition-shadow hover:shadow-lg"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use Cases ───────────────────────────────────────── */}
      <section id="use-cases" className="border-b py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Built for real workflows
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              From simple notifications to complex multi-step automations.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {useCases.map((uc) => (
              <div
                key={uc.title}
                className="rounded-xl border bg-card p-6 text-center transition-shadow hover:shadow-lg"
              >
                <span className="mb-3 block text-3xl">{uc.emoji}</span>
                <h3 className="mb-1 font-semibold">{uc.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {uc.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Docs / API ──────────────────────────────────────── */}
      <section id="docs" className="border-b py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="mb-4 flex justify-center">
            <BookOpen className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">
            Developer-friendly from day one
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Full REST API, webhook triggers, custom code steps, and
            extensibility with community pieces. Everything is documented.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/docs">
              <Button variant="outline" size="lg">
                <BookOpen className="mr-2 h-4 w-4" />
                Read the Docs
              </Button>
            </Link>
            {isLoggedIn ? (
              <Link to="/dashboard">
                <Button size="lg">
                  Go to Dashboard
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Link to="/sign-up">
                <Button size="lg">
                  Get Started Free
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {isLoggedIn ? 'Welcome back!' : 'Ready to automate?'}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
            {isLoggedIn
              ? 'Head to your dashboard to manage workflows and projects.'
              : 'Create your account in seconds. No credit card needed.'}
          </p>
          <div className="mt-8">
            {isLoggedIn ? (
              <Link to="/dashboard">
                <Button size="lg" className="px-10 text-base">
                  Open Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Link to="/sign-up">
                <Button size="lg" className="px-10 text-base">
                  Create Free Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <OpSynLogoIcon className="h-5 w-5" />
            <span>OpSyn — Self-hosted automation</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link
              to="/docs"
              className="transition hover:text-foreground"
            >
              Documentation
            </Link>
            {isLoggedIn ? (
              <Link
                to="/dashboard"
                className="transition hover:text-foreground"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/sign-in"
                  className="transition hover:text-foreground"
                >
                  Sign In
                </Link>
                <Link
                  to="/sign-up"
                  className="transition hover:text-foreground"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

LandingPage.displayName = 'LandingPage';
