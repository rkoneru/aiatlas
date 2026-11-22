import fs from 'node:fs';
import type { Page } from '@playwright/test';

export const PAGES: Array<{ id: string; title: string; navLabel: string | null; inNav: boolean }> = JSON.parse(fs.readFileSync('src/data/pages.json', 'utf8'));
export const MERGED: Record<string, string> = JSON.parse(fs.readFileSync('src/data/redirects.json', 'utf8'));
export const url = (id: string) => (id === 'overview' ? '/' : `/${id}/`);

/** Collect uncaught errors and console errors for a page. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return errors;
}
