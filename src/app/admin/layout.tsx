// src/app/admin/layout.tsx
// Admin section layout — minimal, pages handle their own chrome
// (No locale prefix, no site navbar — admin is intentionally separate)

import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export const metadata = {
  title: 'Admin — blog.frank2025.com',
  robots: 'noindex, nofollow',
};
