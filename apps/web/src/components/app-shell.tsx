'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { ApiStatus } from './api-status';
import { ThemeToggle } from './theme-toggle';

const NAV = [
  { href: '/', label: 'Analyse' },
  { href: '/meetings', label: 'Meetings' },
  { href: '/action-items', label: 'Action items' },
];

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <nav className="nav" aria-label="Main">
      {NAV.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? 'nav-link is-active' : 'nav-link'}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

// usePathname needs a Suspense boundary during prerendering; the links render unhighlighted until it resolves.
function CurrentNav() {
  const pathname = usePathname();
  return <NavLinks pathname={pathname} />;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            MM
          </span>
          <span className="brand-name">MeetingMind</span>
        </div>

        <Suspense fallback={<NavLinks pathname="" />}>
          <CurrentNav />
        </Suspense>

        <div className="shell-tools">
          <ApiStatus />
          <ThemeToggle />
        </div>
      </aside>

      <main className="main" id="main">
        {children}
      </main>
    </div>
  );
}
