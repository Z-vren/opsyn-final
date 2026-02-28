import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import {
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Search,
  BookOpen,
  Menu,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { OpSynLogoIcon } from '@/components/ui/opsyn-logo';
import { authenticationSession } from '@/lib/authentication-session';

import docsJson from '../../../../../../docs/docs.json';

const rawFiles = import.meta.glob('../../../../../../docs/**/*.mdx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function resolveContent(slug: string): string | null {
  for (const [path, content] of Object.entries(rawFiles)) {
    const normalized = path
      .replace(/^.*\/docs\//, '')
      .replace(/\.mdx$/, '');
    if (normalized === slug) {
      return content;
    }
  }
  return null;
}

function stripFrontmatter(raw: string): {
  title: string;
  description: string;
  body: string;
} {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const fmMatch = normalized.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!fmMatch) return { title: '', description: '', body: normalized };

  const fmBlock = fmMatch[1];
  const body = fmMatch[2];

  const titleMatch = fmBlock.match(/^title:\s*["'](.+?)["']\s*$/m);
  const descMatch = fmBlock.match(/^description:\s*["'](.+?)["']\s*$/m);

  return {
    title: titleMatch?.[1] ?? '',
    description: descMatch?.[1] ?? '',
    body,
  };
}

function stripJsx(md: string): string {
  return md
    .replace(/<CardGroup[^>]*>/g, '')
    .replace(/<\/CardGroup>/g, '')
    .replace(/<Card\s+[^>]*?title="([^"]*)"[^>]*?>([\s\S]*?)<\/Card>/g, '**$1** — $2\n')
    .replace(/<Card[^>]*\/>/g, '')
    .replace(/<Tip>([\s\S]*?)<\/Tip>/g, '> **Tip:** $1')
    .replace(/<Warning>([\s\S]*?)<\/Warning>/g, '> **Warning:** $1')
    .replace(/<Info>([\s\S]*?)<\/Info>/g, '> **Info:** $1')
    .replace(/<Note>([\s\S]*?)<\/Note>/g, '> **Note:** $1')
    .replace(/<Steps>([\s\S]*?)<\/Steps>/g, '$1')
    .replace(/<Step\s+title="([^"]*)"[^>]*>/g, '### $1\n')
    .replace(/<\/Step>/g, '')
    .replace(/<Accordion\s+title="([^"]*)"[^>]*>([\s\S]*?)<\/Accordion>/g, '**$1**\n\n$2')
    .replace(/<Frame[^>]*>([\s\S]*?)<\/Frame>/g, '$1')
    .replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/g, '![]($1)')
    .replace(/<CodeGroup>([\s\S]*?)<\/CodeGroup>/g, '$1')
    .replace(/<Tabs>([\s\S]*?)<\/Tabs>/g, '$1')
    .replace(/<Tab\s+title="([^"]*)"[^>]*>([\s\S]*?)<\/Tab>/g, '**$1**\n\n$2')
    .replace(/<ParamField[^>]*?name="([^"]*)"[^>]*?type="([^"]*)"[^>]*?>([\s\S]*?)<\/ParamField>/g, '- `$1` ($2): $3')
    .replace(/<ParamField[^>]*?name="([^"]*)"[^>]*?>([\s\S]*?)<\/ParamField>/g, '- `$1`: $2')
    .replace(/<ResponseField[^>]*?name="([^"]*)"[^>]*?>([\s\S]*?)<\/ResponseField>/g, '- `$1`: $2')
    .replace(/<Expandable[^>]*>([\s\S]*?)<\/Expandable>/g, '$1')
    .replace(/<[A-Z][a-zA-Z]*[^>]*\/>/g, '')
    .replace(/<[A-Z][a-zA-Z]*[^>]*>([\s\S]*?)<\/[A-Z][a-zA-Z]*>/g, '$1');
}

type NavPage = string | { group: string; icon?: string; pages: NavPage[] };
type NavGroup = { group: string; pages: NavPage[] };
type NavTab = { tab: string; groups: NavGroup[] };

function flattenPages(pages: NavPage[]): string[] {
  const result: string[] = [];
  for (const p of pages) {
    if (typeof p === 'string') {
      result.push(p);
    } else {
      result.push(...flattenPages(p.pages));
    }
  }
  return result;
}

function getAllPages(tabs: NavTab[]): string[] {
  const result: string[] = [];
  for (const tab of tabs) {
    for (const group of tab.groups) {
      result.push(...flattenPages(group.pages));
    }
  }
  return result;
}

function slugToTitle(slug: string): string {
  const last = slug.split('/').pop() ?? slug;
  return last
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const SidebarItem = ({
  page,
  currentSlug,
  onNavigate,
  depth = 0,
}: {
  page: NavPage;
  currentSlug: string;
  onNavigate: (slug: string) => void;
  depth?: number;
}) => {
  const [expanded, setExpanded] = useState(true);

  if (typeof page === 'string') {
    const isActive = currentSlug === page;
    return (
      <button
        onClick={() => onNavigate(page)}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-left text-sm transition',
          isActive
            ? 'bg-primary/10 font-medium text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
        style={{ paddingLeft: `${12 + depth * 12}px` }}
      >
        {slugToTitle(page)}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-left text-sm font-medium text-foreground/80 transition hover:bg-accent"
        style={{ paddingLeft: `${12 + depth * 12}px` }}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        {page.group}
      </button>
      {expanded && (
        <div className="mt-0.5">
          {page.pages.map((child, i) => (
            <SidebarItem
              key={typeof child === 'string' ? child : `sub-${i}`}
              page={child}
              currentSlug={currentSlug}
              onNavigate={onNavigate}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const DocsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentSlug = searchParams.get('page') || 'getting-started/introduction';
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const isLoggedIn = authenticationSession.isLoggedIn();

  const tabs = docsJson.navigation.tabs as NavTab[];

  useEffect(() => {
    const allPagesInTab = flattenPages(
      tabs[activeTab]?.groups.flatMap((g) => g.pages) ?? [],
    );
    if (!allPagesInTab.includes(currentSlug)) {
      for (let i = 0; i < tabs.length; i++) {
        const pagesInThisTab = flattenPages(
          tabs[i].groups.flatMap((g) => g.pages),
        );
        if (pagesInThisTab.includes(currentSlug)) {
          setActiveTab(i);
          return;
        }
      }
    }
  }, [currentSlug]);

  const content = useMemo(() => {
    const raw = resolveContent(currentSlug);
    if (!raw) return null;
    const parsed = stripFrontmatter(raw);
    return {
      ...parsed,
      body: stripJsx(parsed.body),
    };
  }, [currentSlug]);

  const allPages = useMemo(() => getAllPages(tabs), []);

  const prevNext = useMemo(() => {
    const idx = allPages.indexOf(currentSlug);
    return {
      prev: idx > 0 ? allPages[idx - 1] : null,
      next: idx < allPages.length - 1 ? allPages[idx + 1] : null,
    };
  }, [currentSlug, allPages]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return tabs[activeTab]?.groups ?? [];
    const q = searchQuery.toLowerCase();
    return (tabs[activeTab]?.groups ?? [])
      .map((group) => ({
        ...group,
        pages: group.pages.filter((p) => {
          if (typeof p === 'string') return slugToTitle(p).toLowerCase().includes(q);
          return p.group.toLowerCase().includes(q) ||
            flattenPages(p.pages).some((s) => slugToTitle(s).toLowerCase().includes(q));
        }),
      }))
      .filter((g) => g.pages.length > 0);
  }, [searchQuery, activeTab]);

  const handleNavigate = (slug: string) => {
    setSearchParams({ page: slug });
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2">
            <OpSynLogoIcon className="h-7 w-7" />
            <span className="font-semibold">OpSyn</span>
          </Link>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-medium">Docs</span>

          <div className="ml-auto flex items-center gap-2">
            {isLoggedIn ? (
              <Link to="/dashboard">
                <Button variant="outline" size="sm">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/sign-in">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/sign-up">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
            <button
              className="ml-2 rounded-md p-1.5 hover:bg-accent lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-screen-2xl overflow-x-auto border-t px-4">
          <div className="flex gap-0">
            {tabs.map((tab, i) => (
              <button
                key={tab.tab}
                onClick={() => {
                  setActiveTab(i);
                  const firstPage = flattenPages(
                    tabs[i].groups.flatMap((g) => g.pages),
                  )[0];
                  if (firstPage) handleNavigate(firstPage);
                }}
                className={cn(
                  'whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition',
                  activeTab === i
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground',
                )}
              >
                {tab.tab}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-screen-2xl flex-1">
        {/* Sidebar */}
        <aside
          className={cn(
            'w-72 shrink-0 border-r bg-background overflow-y-auto',
            'fixed inset-y-0 left-0 z-40 pt-[7.5rem] lg:sticky lg:top-[7.5rem] lg:h-[calc(100vh-7.5rem)] lg:pt-0',
            mobileMenuOpen ? 'block' : 'hidden lg:block',
          )}
        >
          <div className="p-4">
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 text-sm"
              />
            </div>

            <nav className="space-y-4">
              {filteredGroups.map((group) => (
                <div key={group.group}>
                  <div className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.group}
                  </div>
                  <div className="space-y-0.5">
                    {group.pages.map((page, i) => (
                      <SidebarItem
                        key={typeof page === 'string' ? page : `g-${i}`}
                        page={page}
                        currentSlug={currentSlug}
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {/* Backdrop for mobile */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Content */}
        <main className="flex-1 overflow-hidden">
          <div className="mx-auto max-w-3xl px-6 py-10 lg:px-12">
            {content ? (
              <>
                {content.title && (
                  <h1 className="mb-2 text-3xl font-bold tracking-tight">
                    {content.title}
                  </h1>
                )}
                {content.description && (
                  <p className="mb-8 text-lg text-muted-foreground">
                    {content.description}
                  </p>
                )}

                <div className="prose-custom">
                  <ReactMarkdown
                    remarkPlugins={[gfm]}
                    components={{
                      h1: ({ node, ...props }) => (
                        <h1
                          className="mb-4 mt-10 text-2xl font-bold tracking-tight first:mt-0"
                          {...props}
                        />
                      ),
                      h2: ({ node, ...props }) => (
                        <h2
                          className="mb-3 mt-8 text-xl font-semibold tracking-tight first:mt-0"
                          {...props}
                        />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3
                          className="mb-2 mt-6 text-lg font-semibold"
                          {...props}
                        />
                      ),
                      h4: ({ node, ...props }) => (
                        <h4 className="mb-2 mt-4 font-semibold" {...props} />
                      ),
                      p: ({ node, ...props }) => (
                        <p className="mb-4 leading-7" {...props} />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul
                          className="mb-4 ml-6 list-disc space-y-1 [&>li]:leading-7"
                          {...props}
                        />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol
                          className="mb-4 ml-6 list-decimal space-y-1 [&>li]:leading-7"
                          {...props}
                        />
                      ),
                      li: ({ node, ...props }) => <li {...props} />,
                      a: ({ node, href, ...props }) => {
                        if (href?.startsWith('/')) {
                          return (
                            <button
                              className="font-medium text-primary underline underline-offset-4"
                              onClick={() => handleNavigate(href.replace(/^\//, ''))}
                              {...(props as any)}
                            />
                          );
                        }
                        return (
                          <a
                            className="font-medium text-primary underline underline-offset-4"
                            href={href}
                            target="_blank"
                            rel="noreferrer noopener"
                            {...props}
                          />
                        );
                      },
                      code: ({ node, className, ...props }) => {
                        const isBlock = className?.includes('language-');
                        if (isBlock) {
                          return (
                            <code
                              className={cn(
                                'block overflow-x-auto rounded-lg bg-muted/50 p-4 text-sm',
                                className,
                              )}
                              {...props}
                            />
                          );
                        }
                        return (
                          <code
                            className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono"
                            {...props}
                          />
                        );
                      },
                      pre: ({ node, ...props }) => (
                        <pre
                          className="mb-4 overflow-x-auto rounded-lg border bg-muted/30 p-0"
                          {...props}
                        />
                      ),
                      blockquote: ({ node, ...props }) => (
                        <blockquote
                          className="mb-4 border-l-4 border-primary/30 pl-4 italic text-muted-foreground"
                          {...props}
                        />
                      ),
                      table: ({ node, ...props }) => (
                        <div className="mb-4 overflow-x-auto rounded-lg border">
                          <table className="w-full text-sm" {...props} />
                        </div>
                      ),
                      thead: ({ node, ...props }) => (
                        <thead className="bg-muted/50" {...props} />
                      ),
                      tr: ({ node, ...props }) => (
                        <tr
                          className="border-b border-border last:border-0"
                          {...props}
                        />
                      ),
                      th: ({ node, ...props }) => (
                        <th
                          className="px-4 py-2.5 text-left font-medium"
                          {...props}
                        />
                      ),
                      td: ({ node, ...props }) => (
                        <td className="px-4 py-2.5" {...props} />
                      ),
                      hr: ({ node, ...props }) => (
                        <hr className="my-8 border-border/50" {...props} />
                      ),
                      img: ({ node, ...props }) => (
                        <img
                          className="my-4 rounded-lg border"
                          {...props}
                        />
                      ),
                    }}
                  >
                    {content.body.trim()}
                  </ReactMarkdown>
                </div>

                {/* Prev / Next */}
                <div className="mt-12 flex items-center justify-between border-t pt-6">
                  {prevNext.prev ? (
                    <button
                      onClick={() => handleNavigate(prevNext.prev!)}
                      className="group flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
                    >
                      <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" />
                      {slugToTitle(prevNext.prev)}
                    </button>
                  ) : (
                    <div />
                  )}
                  {prevNext.next ? (
                    <button
                      onClick={() => handleNavigate(prevNext.next!)}
                      className="group flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
                    >
                      {slugToTitle(prevNext.next)}
                      <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </button>
                  ) : (
                    <div />
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/40" />
                <h2 className="mb-2 text-xl font-semibold">Page not found</h2>
                <p className="mb-6 text-muted-foreground">
                  The documentation page "{currentSlug}" could not be found.
                </p>
                <Button
                  variant="outline"
                  onClick={() => handleNavigate('getting-started/introduction')}
                >
                  Go to Introduction
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

DocsPage.displayName = 'DocsPage';
