'use client';

// src/components/Sidebar.tsx — Phase 1c
// Per docs/CMS V2.md §三十五 (最终 Sidebar)
// Structure: FRANK CMS / Overview / CONTENT {Blog, Notes, Drafts} / ORGANIZE {Categories, Tags, Media} / SYSTEM {Activity, Settings} / View Website / Logout
// Routes to Blog/Notes/Drafts/Categories/Tags/Media/Activity/Settings are placeholders in Phase 1c; each subsequent phase fills in.

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';

interface NavItem {
  label: string;
  href: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  { items: [{ label: 'Overview', href: '/admin' }] },
  {
    title: 'Content',
    items: [
      { label: 'Blog', href: '/admin/blog' },
      { label: 'Notes', href: '/admin/notes' },
      { label: 'Drafts', href: '/admin/drafts' },
    ],
  },
  {
    title: 'Organize',
    items: [
      { label: 'Categories', href: '/admin/categories' },
      { label: 'Tags', href: '/admin/tags' },
      { label: 'Media', href: '/admin/media' },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Activity', href: '/admin/activity' },
      { label: 'Settings', href: '/admin/settings' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  async function handleLogout() {
    try {
      const res = await fetch('/api/admin/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        router.push('/admin/login');
      } else {
        toast.show('Logout failed', 'error');
      }
    } catch (e) {
      toast.show('Logout failed', 'error');
    }
  }

  const sidebarStyle = {
    width: '240px',
    minHeight: '100vh',
    background: 'var(--color-surface)',
    borderRight: '1px solid var(--color-border)',
    padding: 'var(--space-lg)',
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'sticky' as const,
    top: 0,
  };

  const headerStyle = {
    fontSize: 'var(--font-size-md)',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    letterSpacing: '0.1em',
    marginBottom: 'var(--space-xl)',
  };

  const sectionTitleStyle = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.12em',
    marginTop: 'var(--space-lg)',
    marginBottom: 'var(--space-sm)',
  };

  const linkStyle = (active: boolean) => ({
    display: 'block',
    padding: 'var(--space-sm) var(--space-md)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-size-sm)',
    color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
    background: active ? 'var(--color-surface-elevated)' : 'transparent',
    textDecoration: 'none',
    marginBottom: '2px',
  });

  const footerStyle = {
    marginTop: 'auto',
    paddingTop: 'var(--space-lg)',
    borderTop: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--space-xs)',
  };

  return (
    <aside style={sidebarStyle}>
      <div style={headerStyle}>FRANK CMS</div>

      {navSections.map((section, i) => (
        <div key={i}>
          {section.title && <div style={sectionTitleStyle}>{section.title}</div>}
          {section.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href} style={linkStyle(active)}>
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}

      <div style={footerStyle}>
        <a
          href="https://frank2025.com"
          target="_blank"
          rel="noreferrer"
          style={linkStyle(false)}
        >
          ↗ View Website
        </a>
        <Button variant="ghost" size="sm" onClick={handleLogout} style={{ width: '100%', justifyContent: 'flex-start' }}>
          Logout
        </Button>
      </div>
    </aside>
  );
}
