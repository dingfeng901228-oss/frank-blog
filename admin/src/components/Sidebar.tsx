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
  // Optional "+ New" shortcut surfaced inline next to the row. Used for
  // content sections so the new-post action is one click from anywhere in
  // the sidebar instead of having to drill into the list page first.
  newHref?: string;
  newLabel?: string;
  // Only this exact path highlights the entry. Used by the dashboard,
  // which is a single page rather than a section.
  exact?: boolean;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  // Item 4 — the dashboard is a single page, not a section: it is
  // highlighted ONLY on /admin itself. Without `exact`, the old
  // startsWith('/admin/') rule lit it up on every sub-page.
  { items: [{ label: '概览', href: '/admin', exact: true }] },
  {
    title: '内容',
    items: [
      { label: '博客', href: '/admin/blog', newHref: '/admin/blog/new', newLabel: '+ 新文章' },
      { label: '随笔', href: '/admin/notes', newHref: '/admin/notes/new', newLabel: '+ 新随笔' },
      { label: '草稿箱', href: '/admin/drafts' },
    ],
  },
  {
    title: '整理',
    items: [
      { label: '分类', href: '/admin/categories' },
      { label: '标签', href: '/admin/tags' },
      { label: '媒体库', href: '/admin/media' },
    ],
  },
  {
    title: '系统',
    items: [
      { label: '活动日志', href: '/admin/activity' },
      { label: '设置', href: '/admin/settings' },
    ],
  },
];

/**
 * Is this nav entry the page the user is on?
 *
 * Exact entries (the dashboard) match only themselves. Section entries
 * match their own path and everything below it — but "/admin/blog"
 * must not light up for "/admin/blogger".
 */
export function isNavItemActive(pathname: string, item: NavItem): boolean {
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (item.exact) return normalized === item.href;
  return normalized === item.href || normalized.startsWith(item.href + '/');
}

export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname() ?? '';
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
        toast.show('退出登录失败', 'error');
      }
    } catch (e) {
      toast.show('退出登录失败', 'error');
    }
  }

  const sidebarStyle = {
    background: 'var(--color-surface)',
  };

  const headerStyle = {
    fontSize: 'var(--font-size-md)',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    letterSpacing: '0.1em',
    marginBottom: 'var(--space-xl)',
    display: 'flex' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
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
    <aside className={`admin-sidebar${open ? ' admin-sidebar-open' : ''}`} style={sidebarStyle}>
      <div style={headerStyle}>
        <span>FRANK CMS</span>
        {/* Shown only on phones, where the drawer covers the page. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭菜单"
          className="admin-sidebar-close"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            fontSize: 20,
            lineHeight: 1,
            cursor: 'pointer',
            padding: '0 4px',
          }}
        >
          ×
        </button>
      </div>

      {navSections.map((section, i) => (
        <div key={i}>
          {section.title && <div style={sectionTitleStyle}>{section.title}</div>}
          {section.items.map((item) => {
            const active = isNavItemActive(pathname, item);
            return (
              <div key={item.href} style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? 'page' : undefined}
                  style={{ ...linkStyle(active), flex: 1, marginBottom: 0 }}
                >
                  {item.label}
                </Link>
                {item.newHref && (
                  <Link
                    href={item.newHref}
                    aria-label={item.newLabel || '新建'}
                    title={item.newLabel || '新建'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 10px',
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--color-text-secondary)',
                      background: 'transparent',
                      border: '1px solid transparent',
                      borderRadius: 'var(--radius-sm)',
                      textDecoration: 'none',
                      flexShrink: 0,
                    }}
                  >
                    +
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <div style={footerStyle}>
        <a
          href="https://blog.frank2025.com"
          target="_blank"
          rel="noreferrer"
          style={linkStyle(false)}
        >
          ↗ 访问博客
        </a>
        <Button variant="ghost" size="sm" onClick={handleLogout} style={{ width: '100%', justifyContent: 'flex-start' }}>
          退出登录
        </Button>
      </div>
    </aside>
  );
}
