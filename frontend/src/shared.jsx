import { useEffect, useState } from 'react';

function initialTheme() {
  try {
    const saved = localStorage.getItem('doppel-theme');
    return ['light', 'dark'].includes(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(initialTheme);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = (dark) => { document.documentElement.dataset.theme = theme === 'system' ? (dark ? 'dark' : 'light') : theme; };
    apply(media?.matches ?? true);
    const onChange = (event) => apply(event.matches);
    media?.addEventListener('change', onChange);
    try { localStorage.setItem('doppel-theme', theme); } catch {}
    return () => media?.removeEventListener('change', onChange);
  }, [theme]);
  return [theme, setTheme];
}

export function useDocumentTitle(title) {
  useEffect(() => { document.title = title; }, [title]);
}

export function ThemeControl({ theme, setTheme }) {
  return <label className="theme-control"><span className="theme-icon" aria-hidden="true">◐</span><span className="sr-only">Color theme</span><select aria-label="Color theme" value={theme} onChange={(event) => setTheme(event.target.value)}><option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option></select></label>;
}

export const REPOSITORY_URL = 'https://github.com/arunangshu01/doppel';

export function CreatorAttribution() {
  return <div className="creator-attribution"><span>Created by <strong>Arunangshu Pramanik</strong></span><nav aria-label="Creator contact"><a href="https://github.com/arunangshu01" target="_blank" rel="noreferrer" aria-label="GitHub" title="GitHub profile"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.339-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.31.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.523 2 12 2Z" /></svg></a><a href="https://www.linkedin.com/in/arunangshu-pramanik-1896168b" target="_blank" rel="noreferrer" aria-label="LinkedIn" title="LinkedIn profile"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M20.45 2H3.55C2.69 2 2 2.68 2 3.52v16.96C2 21.32 2.69 22 3.55 22h16.9c.86 0 1.55-.68 1.55-1.52V3.52C22 2.68 21.31 2 20.45 2ZM7.93 18.75H4.98V9.2h2.95v9.55ZM6.45 7.9a1.71 1.71 0 1 1 0-3.42 1.71 1.71 0 0 1 0 3.42Zm12.3 10.85H15.8V14.1c0-1.11-.02-2.54-1.55-2.54-1.55 0-1.79 1.21-1.79 2.46v4.73H9.51V9.2h2.83v1.3h.04c.39-.74 1.36-1.52 2.79-1.52 2.98 0 3.58 1.96 3.58 4.51v5.26Z" /></svg></a><a href="mailto:arunangshu01@gmail.com" aria-label="Email Arunangshu Pramanik" title="Email Arunangshu Pramanik"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg></a></nav></div>;
}
