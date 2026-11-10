import { useEffect, useState } from 'react';
import './App.css';

async function request(url, options) {
  const response = await fetch(url, options);
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error('The API returned a non-JSON response. Check its availability and the Hosting API rewrite.');
  }
  if (!response.ok) {
    const detail = body.detail;
    const error = new Error(Array.isArray(detail) ? detail.map((item) => item.msg).join('; ') : detail || 'Request failed');
    error.status = response.status;
    throw error;
  }
  return body;
}

function initialTheme() {
  try {
    const saved = localStorage.getItem('doppel-theme');
    return ['light', 'dark'].includes(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

function schemaStats(editor) {
  try {
    const schema = JSON.parse(editor);
    const resources = Object.values(schema.resources || {});
    return { seed: schema.seed ?? 42, resources: resources.length, rows: resources.reduce((total, resource) => total + (Number(resource.count) || 20), 0) };
  } catch {
    return null;
  }
}

export default function App({ apiBase = '/doppel/api' }) {
  const [editor, setEditor] = useState('');
  const [resources, setResources] = useState([]);
  const [active, setActive] = useState('');
  const [sample, setSample] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [theme, setTheme] = useState(initialTheme);
  const [view, setView] = useState('table');
  const [notice, setNotice] = useState('');
  const [connected, setConnected] = useState(false);
  const [published, setPublished] = useState(null);
  const [demo, setDemo] = useState(null);
  const [session, setSession] = useState(null);
  const [mode, setMode] = useState('demo');
  const [previewBase, setPreviewBase] = useState(apiBase);
  const [adminToken, setAdminToken] = useState('');
  const stats = schemaStats(editor);
  const dirty = published !== null && published !== editor;
  const docsBase = previewBase;

  function showManifest(manifest, nextMode) {
    setResources(manifest.resources);
    setActive(manifest.resources[0]?.name || '');
    const path = manifest.base_path;
    setPreviewBase(new URL(apiBase, window.location.origin).origin + path);
    setMode(nextMode);
  }

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = (dark) => { document.documentElement.dataset.theme = theme === 'system' ? (dark ? 'dark' : 'light') : theme; };
    apply(media?.matches ?? true);
    const onChange = (event) => apply(event.matches);
    media?.addEventListener('change', onChange);
    try { localStorage.setItem('doppel-theme', theme); } catch {}
    return () => media?.removeEventListener('change', onChange);
  }, [theme]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    let cancelled = false;
    request(`${apiBase}/demo`).then((manifest) => {
      if (!cancelled) {
        setEditor(JSON.stringify(manifest.schema, null, 2));
        setDemo(manifest);
        showManifest(manifest, 'demo');
        setConnected(true);
      }
    }).catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [apiBase]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setPreviewBusy(true);
    setSample(null);
    request(`${previewBase}/${active}?limit=5`).then((body) => {
      if (!cancelled) setSample(body);
    }).catch((err) => {
      if (!cancelled) {
        setError(err.message);
        if (err.status === 404 && mode === 'visitor') setSession(null);
      }
    }).finally(() => { if (!cancelled) setPreviewBusy(false); });
    return () => { cancelled = true; };
  }, [active, resources, previewBase]);

  async function generate(event) {
    event.preventDefault();
    setError('');
    let schema;
    try {
      schema = JSON.parse(editor);
    } catch {
      setError('Enter valid JSON before generating your API.');
      return;
    }
    setBusy(true);
    try {
      const target = session ? `${apiBase}/playgrounds/${session.id}` : `${apiBase}/playgrounds`;
      const manifest = await request(target, {
        method: session ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(schema),
      });
      setSession(manifest);
      showManifest(manifest, 'visitor');
      setPublished(editor);
      setConnected(true);
      setNotice('Personal playground generated. Save your schema before leaving.');
    } catch (err) {
      if (err.status === 404) setSession(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadRetail() {
    setBusy(true);
    setError('');
    try {
      const schema = await request(`${apiBase}/templates/retail`);
      setEditor(JSON.stringify(schema, null, 2));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function formatJSON() {
    try {
      setEditor(JSON.stringify(JSON.parse(editor), null, 2));
      setError('');
    } catch {
      setError('Enter valid JSON before formatting your schema.');
    }
  }

  async function copyCurl() {
    try {
      const url = new URL(`${previewBase}/${active}?limit=5`, window.location.origin).href.replace(/'/g, "'\\''");
      await navigator.clipboard.writeText(`curl '${url}'`);
      setNotice('cURL copied');
    } catch {
      setError('Clipboard unavailable. Open the endpoint to copy its URL.');
    }
  }

  async function publishDemo(event) {
    event.preventDefault();
    if (!window.confirm('Replace the shared public demo for every visitor?')) return;
    const token = adminToken;
    setAdminToken('');
    setBusy(true);
    setError('');
    try {
      const schema = JSON.parse(editor);
      const manifest = await request(`${apiBase}/schema`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(schema),
      });
      setDemo({ ...manifest, schema });
      showManifest(manifest, 'demo');
      setPublished(editor);
      setNotice('Shared demo updated. It resets on server restart.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function downloadSchema() {
    const blob = new Blob([editor], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'doppel-schema.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="doppel home"><img src="/logo.svg" width="34" height="34" alt="" /><span>doppel</span><span className="version">PLAYGROUND</span></a>
        <div className="header-actions"><a className="docs-link" href={`${docsBase}/docs`} target="_blank" rel="noreferrer">API docs <span aria-hidden="true">↗</span></a><span className="header-divider" /><label className="theme-control"><span className="theme-icon" aria-hidden="true">◐</span><span className="sr-only">Color theme</span><select aria-label="Color theme" value={theme} onChange={(event) => setTheme(event.target.value)}><option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option></select></label></div>
      </header>
      <div className="app-body">
        <aside className="sidebar" aria-label="Workspace navigation">
          <div className="workspace-name"><span className="workspace-avatar">D</span><div>API workspace<small>{mode === 'demo' ? 'Public demo' : 'Personal playground'}</small></div></div>
          <div className="sidebar-section-label">WORKSPACE</div>
          <a className="nav-active" href="#playground"><span aria-hidden="true">▧</span> API playground<span className="nav-shortcut">01</span></a>
          <div className="sidebar-section-label resource-label">GENERATED RESOURCES <span>{resources.length.toString().padStart(2, '0')}</span></div>
          <nav aria-label="Resources" className="resource-nav">{resources.length ? resources.map((resource) => <button type="button" aria-pressed={active === resource.name} className={active === resource.name ? 'resource-active' : ''} onClick={() => setActive(resource.name)} key={resource.name}><span className="resource-symbol" aria-hidden="true">#</span><span>{resource.name}</span><span className="resource-count">{resource.count}</span></button>) : <p className="sidebar-hint">Generate your schema to explore its resources.</p>}</nav>
          <div className="sidebar-bottom"><span className={`connection-dot ${connected ? 'connected' : ''}`} /><div>{connected ? 'Backend connected' : busy ? 'Connecting to backend' : 'Connection unavailable'}<small title={apiBase}>{apiBase}</small></div></div>
        </aside>
        <main id="playground">
          <div className="breadcrumbs">Workspace <span>/</span> <strong>API playground</strong></div>
          <section className="intro"><div><p className="eyebrow">SCHEMA IN. API OUT.</p><h1>Your backend stand-in.</h1><p>Build against real-looking data. Ship before the backend is ready.</p></div><span className="environment"><span className="connection-dot connected" />{mode === 'demo' ? 'Public demo' : 'Isolated playground'}</span></section>
          <div className="workflow-strip"><span><b>01</b> Define a schema</span><span className="workflow-arrow" aria-hidden="true">→</span><span><b>02</b> Generate seeded data</span><span className="workflow-arrow" aria-hidden="true">→</span><span><b>03</b> Build with your API</span><span className="workflow-note">No database. No setup.</span></div>
          <div className="mode-toolbar"><button type="button" disabled={!demo || busy} aria-pressed={mode === 'demo'} onClick={() => { showManifest(demo, 'demo'); setError(''); }}>Public demo</button><button type="button" disabled={!session || busy} aria-pressed={mode === 'visitor'} onClick={() => { showManifest(session, 'visitor'); setError(''); }}>My playground</button><button type="button" disabled={!editor || busy} onClick={downloadSchema}>Download schema</button></div>
          <p className="session-warning">{mode === 'demo' ? 'Public demo is read-only. Generate API creates your isolated playground.' : `Unlisted access link. Expires by ${session ? new Date(session.expires_at).toLocaleTimeString() : 'server restart'}, possibly earlier on server restart or deployment.`} Save your schema. Never enter sensitive data.</p>
          {error && <div role="alert" className="error"><strong>Something needs attention</strong><span>{error}</span></div>}
          <div className="workspace">
            <form className="panel editor-panel" onSubmit={generate}>
              <div className="panel-heading"><h2><span className="panel-icon" aria-hidden="true">{'{ }'}</span> Schema editor</h2><span className={`badge ${dirty ? 'draft' : ''}`}>{dirty ? 'Unpublished changes' : 'JSON'}</span></div>
              <div className="editor-toolbar"><label htmlFor="schema">Schema JSON</label><button type="button" className="text-button" disabled={busy} onClick={formatJSON}>Format JSON</button><button type="button" className="text-button" disabled={busy} onClick={loadRetail}>Load retail template</button></div>
              <textarea id="schema" spellCheck="false" autoCapitalize="off" autoComplete="off" aria-describedby="schema-help" value={editor} onChange={(event) => setEditor(event.target.value)} disabled={busy} />
              <div className="editor-metadata"><span><span className="connection-dot connected" />{stats ? `${stats.resources} resources / ${stats.rows} rows` : 'JSON schema'}</span><span>seed: <b>{stats?.seed ?? '-'}</b></span></div>
              <div className="editor-footer"><p id="schema-help">Deterministic by design.<br /><span>Same schema + seed = same data.</span></p><button className="primary-button" disabled={busy} type="submit">{busy ? 'Loading...' : 'Generate API'}<span aria-hidden="true">→</span></button></div>
            </form>
            <section className="panel preview-panel" aria-label="API preview">
              <div className="panel-heading"><h2><span className="panel-icon" aria-hidden="true">⌁</span> Response explorer</h2><span className="badge">{mode === 'demo' ? 'Public demo' : 'Personal API'}</span></div>
              {!resources.length ? <div className="empty"><div className="empty-illustration" aria-hidden="true"><div className="mini-endpoint"><span>GET</span> /your_resource <i /></div><div className="mini-code"><span>{'{'}</span><span>&nbsp; "data": [<b>...</b>],</span><span>&nbsp; "ready": <b>true</b></span><span>{'}'}</span></div></div><h3>A real endpoint. Not another fixture.</h3><p>Define your resources and hit Generate API.<br />Explore rows, inspect JSON, and connect your app.</p><div className="empty-features"><span>Seeded data</span><span>Linked resources</span><span>REST + OpenAPI</span></div></div> : <>
                <div className="endpoint-toolbar"><a className="endpoint" href={`${previewBase}/${active}`} aria-label={`GET /${active}`} target="_blank" rel="noreferrer"><span className="method">GET</span><code>/{active}</code><span className="endpoint-arrow" aria-hidden="true">↗</span></a><button type="button" className="secondary" onClick={copyCurl}>Copy cURL</button></div>
                <div className="request-meta"><code>?limit=5</code><span>GET /{active}/{'{id}'} also available</span></div>
                <div className="response-toolbar"><div role="tablist" aria-label="Response format">{['table', 'json'].map((format) => <button key={format} id={`tab-${format}`} role="tab" aria-controls="response-panel" aria-selected={view === format} tabIndex={view === format ? 0 : -1} type="button" onKeyDown={(event) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                  event.preventDefault();
                  const next = event.key === 'Home' ? 'table' : event.key === 'End' ? 'json' : format === 'table' ? 'json' : 'table';
                  setView(next);
                  document.getElementById(`tab-${next}`).focus();
                }} onClick={() => setView(format)}>{format === 'table' ? 'Table' : 'JSON'}</button>)}</div><span>{sample ? `${sample.data.length} of ${sample.total} rows` : 'Fetching response'}</span></div>
                <div role="tabpanel" id="response-panel" aria-labelledby={`tab-${view}`} tabIndex="0" className="response-content">
                  {previewBusy && <p className="loading-message">Loading sample rows...</p>}
                  {sample && (view === 'json' ? <pre className="json-response" aria-label="JSON response">{JSON.stringify(sample, null, 2)}</pre> : <div className="table-scroll"><table><caption className="sr-only">Sample rows from {active}</caption><thead><tr><th scope="col" className="row-number">#</th>{Object.keys(sample.data[0] || {}).map((field) => <th scope="col" key={field}>{field}</th>)}</tr></thead><tbody>{sample.data.map((row, index) => <tr key={row.id}><td className="row-number">{index + 1}</td>{Object.entries(row).map(([field, value]) => <td key={field} title={String(value)}>{String(value)}</td>)}</tr>)}</tbody></table></div>)}
                </div>
                <div className="response-footer"><span className={`connection-dot ${sample ? 'connected' : ''}`} />{sample ? 'Response received' : 'Waiting for response'}<span className="response-footer-note">Read-only REST API</span></div>
              </>}
            </section>
          </div>
          <section className="reference-bar" aria-label="Schema quick reference"><span className="reference-title">FIELD TYPES</span><code>uuid</code><code>person</code><code>email</code><code>money</code><code>datetime</code><code>enum</code><code>ref(resource.id)</code><a href={`${docsBase}/docs`} target="_blank" rel="noreferrer">View API reference ↗</a></section>
          <details className="admin-panel" onToggle={(event) => { if (!event.currentTarget.open) setAdminToken(''); }}><summary>Admin publishing</summary><p>Replaces the shared demo for all visitors. Token stays in memory and is cleared on submission or close.</p><form onSubmit={publishDemo}><label htmlFor="admin-token">Admin token</label><input id="admin-token" type="password" autoComplete="off" value={adminToken} onChange={(event) => setAdminToken(event.target.value)} /><button type="submit" disabled={busy || !adminToken}>Publish shared demo</button><button type="button" onClick={() => setAdminToken('')}>Clear token</button></form></details>
          <footer><span><img src="/logo.svg" width="16" height="16" alt="" /> Fake data. Real progress.</span><span>In-memory <i /> Resets on restart <i /> Synthetic data only</span></footer>
        </main>
      </div>
      <div className={`toast ${notice ? 'visible' : ''}`} role="status" aria-live="polite">{notice}</div>
    </div>
  );
}
