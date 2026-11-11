import App from './App';
import Landing from './Landing';

export const PLAYGROUND_PATH = '/playground';

export function isPlayground(pathname) {
  return pathname.replace(/\/+$/, '') === PLAYGROUND_PATH;
}

export default function Root({ apiBase, pathname = window.location.pathname }) {
  return isPlayground(pathname) ? <App apiBase={apiBase} /> : <Landing apiBase={apiBase} />;
}
