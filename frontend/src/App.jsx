import { useEffect, useRef, useState } from 'react';
import BootSplash from './BootSplash';
import { CreatorAttribution, ThemeControl, useDocumentTitle, useTheme } from './shared';
import './App.css';

async function request(url, options, client) {
  const response = await fetch(url, client?.current ? { ...options, headers: { ...options?.headers, 'X-Doppel-Client': client.current } } : options);
  const identifier = response.headers?.get?.('X-Doppel-Client');
  if (client && identifier && identifier.length <= 128) client.current = identifier;
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
    error.body = body;
    error.simulated = body.simulated === true;
    const retry = Number(response.headers?.get?.('Retry-After'));
    if (response.status === 429 && !error.simulated && Number.isFinite(retry) && retry > 0) {
      error.retryAfter = Math.min(3600, Math.ceil(retry));
      error.message += ` Try again in ${error.retryAfter} seconds.`;
    }
    throw error;
  }
  return body;
}

function schemaStats(editor) {
  try {
    const schema = JSON.parse(editor);
    const resources = Object.values(schema.resources || {});
    return { seed: schema.seed ?? 42, locale: schema.locale ?? 'en_US', resources: resources.length, rows: resources.reduce((total, resource) => total + (Number(resource.count) || 20), 0), cells: resources.reduce((total, resource) => total + (Number(resource.count) || 20) * Object.keys(resource.fields || {}).length, 0) };
  } catch {
    return null;
  }
}

export default function App({ apiBase = '/doppel/api/v1' }) {
  const [editor, setEditor] = useState('');
  const [resources, setResources] = useState([]);
  const [active, setActive] = useState('');
  const [sample, setSample] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [booted, setBooted] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [theme, setTheme] = useTheme();
  const [view, setView] = useState('table');
  const [notice, setNotice] = useState('');
  const [connected, setConnected] = useState(false);
  const [published, setPublished] = useState(null);
  const [demo, setDemo] = useState(null);
  const [session, setSession] = useState(null);
  const [mode, setMode] = useState('demo');
  const [previewBase, setPreviewBase] = useState(apiBase);
  const [adminToken, setAdminToken] = useState('');
  const [query, setQuery] = useState('limit=5');
  const [templateName, setTemplateName] = useState('retail');
  const [queryRun, setQueryRun] = useState(0);
  const [previewFailure, setPreviewFailure] = useState(null);
  const queryForm = useRef(null);
  const shell = useRef(null);
  const clientIdentity = useRef('');
  const apiRequest = (url, options) => request(url, options, clientIdentity);
  const stats = schemaStats(editor);
  const dirty = published !== null && published !== editor;
  const docsBase = previewBase;

  function showManifest(manifest, nextMode) {
    setResources(manifest.resources);
    setActive(manifest.resources[0]?.name || '');
    const path = manifest.base_path;
    setPreviewBase(new URL(apiBase, window.location.origin).origin + path);
    setMode(nextMode);
    setQuery('limit=5');
    queryForm.current?.reset();
  }

  useDocumentTitle('doppel - Mock API playground');

  useEffect(() => {
    if (shell.current) shell.current.inert = !booted;
  }, [booted]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    let cancelled = false;
    apiRequest(`${apiBase}/demo`).then((manifest) => {
      if (!cancelled) {
        const text = JSON.stringify(manifest.schema, null, 2);
        setEditor(text);
        setPublished(text);
        setDemo(manifest);
        showManifest(manifest, 'demo');
        setConnected(true);
      }
    }).catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) { setBusy(false); setBooted(true); } });
    return () => { cancelled = true; };
  }, [apiBase]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const controller = new AbortController();
    setPreviewBusy(true);
    setSample(null);
    setPreviewFailure(null);
    setError('');
    apiRequest(`${previewBase}/${active}?${query}`, { signal: controller.signal }).then((body) => {
      if (!cancelled) setSample(body);
    }).catch((err) => {
      if (!cancelled) {
        setError(err.message);
        setPreviewFailure({ status: err.status, body: err.body });
        if (err.status === 404 && mode === 'visitor' && !err.simulated) setSession(null);
      }
    }).finally(() => { if (!cancelled) setPreviewBusy(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [active, resources, previewBase, query, queryRun]);

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
      const manifest = await apiRequest(target, {
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

  async function loadTemplate() {
    setBusy(true);
    setError('');
    try {
      const schema = await apiRequest(`${apiBase}/templates/${templateName}`);
      setEditor(JSON.stringify(schema, null, 2));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function changeLocale(event) {
    try {
      const schema = JSON.parse(editor);
      schema.locale = event.target.value;
      setEditor(JSON.stringify(schema, null, 2));
      setError('');
    } catch {
      setError('Enter valid JSON before changing the data locale.');
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
      const url = new URL(`${previewBase}/${active}?${query}`, window.location.origin).href.replace(/'/g, "'\\''");
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
      const manifest = await apiRequest(`${apiBase}/schema`, {
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

  function applyQuery(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams({ limit: form.get('limit') });
    if (form.get('page') !== '1') params.set('page', form.get('page'));
    if (form.get('sort').trim()) {
      params.set('sort', form.get('sort').trim());
      params.set('order', form.get('order'));
    }
    const field = form.get('filter_field').trim();
    if (field && (!/^[a-z][a-z0-9_]{0,47}$/.test(field) || ['page', 'limit', 'sort', 'order'].includes(field))) {
      setError('Choose a resource field for the filter, not a reserved query parameter.');
      return;
    }
    if (field) params.set(field, form.get('filter_value'));
    if (form.get('delay_ms') !== '0') params.set('_delay_ms', form.get('delay_ms'));
    if (form.get('status') !== '200') params.set('_status', form.get('status'));
    if (form.has('empty')) params.set('_empty', 'true');
    setQuery(params.toString());
    setQueryRun((value) => value + 1);
  }

  async function importSchema(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 131072) throw new Error('Schema files must be at most 128 KiB.');
      const text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Unable to read this schema file.'));
        reader.readAsText(file);
      });
      let schema;
      try { schema = JSON.parse(text); } catch { throw new Error('Import a valid JSON schema file.'); }
      if (!schema || typeof schema !== 'object' || !schema.resources || typeof schema.resources !== 'object' || Array.isArray(schema.resources) || !Object.keys(schema.resources).length) {
        throw new Error('The schema must contain a non-empty resources object.');
      }
      setEditor(JSON.stringify(schema, null, 2));
      setError('');
      setNotice('Schema imported as a draft. Generate API to validate and publish your playground.');
    } catch (err) {
      setError(err.message);
    } finally {
      input.value = '';
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
    <>
    <div className="app-shell" ref={shell}>
      <a className="skip-link" href="#playground">Skip to playground</a>
      <header className="topbar">
        <a className="brand" href="/" aria-label="doppel home"><img src="/logo.svg" width="34" height="34" alt="" /><span>doppel</span><span className="version">PLAYGROUND</span></a>
        <div className="header-actions"><a className="docs-link" href={`${docsBase}/docs`} target="_blank" rel="noreferrer">API docs <span aria-hidden="true">↗</span></a><span className="header-divider" /><ThemeControl theme={theme} setTheme={setTheme} /></div>
      </header>
      <div className="app-body">
        <aside className="sidebar" aria-label="Workspace navigation">
          <div className="workspace-name"><span className="workspace-avatar">D</span><div>API workspace<small>{mode === 'demo' ? 'Public demo' : 'Personal playground'}</small></div></div>
          <div className="sidebar-section-label">WORKSPACE</div>
          <a className="nav-active" href="#playground"><span aria-hidden="true">▧</span> API playground<span className="nav-shortcut">01</span></a>
          <div className="sidebar-section-label resource-label">GENERATED RESOURCES <span>{resources.length.toString().padStart(2, '0')}</span></div>
          <nav aria-label="Resources" className="resource-nav">{resources.length ? resources.map((resource) => <button type="button" aria-pressed={active === resource.name} className={active === resource.name ? 'resource-active' : ''} onClick={() => { setActive(resource.name); setQuery('limit=5'); }} key={resource.name}><span className="resource-symbol" aria-hidden="true">#</span><span className="resource-name" title={resource.name}>{resource.name}</span><span className="resource-count">{resource.count}</span></button>) : <p className="sidebar-hint">Generate your schema to explore its resources.</p>}</nav>
          <div className="sidebar-bottom"><span className={`connection-dot ${connected ? 'connected' : ''}`} /><div>{connected ? 'Backend connected' : busy ? 'Connecting to backend' : 'Connection unavailable'}<small title={apiBase}>{apiBase}</small></div></div>
        </aside>
        <main id="playground" tabIndex="-1">
          <div className="breadcrumbs">Workspace <span>/</span> <strong>API playground</strong></div>
          <section className="intro"><div><p className="eyebrow">SCHEMA IN. API OUT.</p><h1>Your backend stand-in.</h1><p>Build against real-looking data. Ship before the backend is ready.</p></div><span className="environment"><span className="connection-dot connected" />{mode === 'demo' ? 'Public demo' : 'Isolated playground'}</span></section>
          <div className="workflow-strip"><span><b>01</b> Define a schema</span><span className="workflow-arrow" aria-hidden="true">→</span><span><b>02</b> Generate seeded data</span><span className="workflow-arrow" aria-hidden="true">→</span><span><b>03</b> Build with your API</span><span className="workflow-note">No database. No setup.</span></div>
          <div className="mode-toolbar"><button type="button" disabled={!demo || busy} aria-pressed={mode === 'demo'} onClick={() => { showManifest(demo, 'demo'); setError(''); }}>Public demo</button><button type="button" disabled={!session || busy} aria-pressed={mode === 'visitor'} onClick={() => { showManifest(session, 'visitor'); setError(''); }}>My playground</button><button type="button" disabled={!editor || busy} onClick={downloadSchema}>Download schema</button><label className="schema-import">Import schema<input className="sr-only" type="file" accept=".json,application/json" disabled={busy} onChange={importSchema} /></label></div>
          <p className="session-warning">{mode === 'demo' ? 'Public demo is read-only. Generate API creates your isolated playground (up to 20,000 cells).' : `Unlisted access link. Expires by ${session ? new Date(session.expires_at).toLocaleTimeString() : 'server restart'}, possibly earlier on server restart or deployment.`} Save your schema. Never enter sensitive data.</p>
          {error && <div role="alert" className="error"><strong>Something needs attention</strong><span>{error}</span></div>}
          <nav className="workspace-jumps" aria-label="Workspace sections"><a href="#schema-editor" aria-label="Jump to schema editor">Schema editor</a><a href="#response-explorer" aria-label="Jump to response explorer">Response explorer</a></nav>
          <div className="workspace">
            <form id="schema-editor" className="panel editor-panel" onSubmit={generate}>
              <div className="panel-heading"><h2><span className="panel-icon" aria-hidden="true">{'{ }'}</span> Schema editor</h2><span className={`badge ${dirty ? 'draft' : ''}`}>{dirty ? 'Unpublished changes' : 'JSON'}</span></div>
              <div className="editor-toolbar"><label htmlFor="schema">Schema JSON</label><select aria-label="Data locale" value={stats?.locale || 'en_US'} disabled={busy} onChange={changeLocale}><option value="en_US">English (US)</option><option value="en_IN">English (India)</option><option value="en_GB">English (UK)</option><option value="fr_FR">French</option><option value="de_DE">German</option></select><button type="button" className="text-button" disabled={busy} onClick={formatJSON}>Format JSON</button><select aria-label="Starter template" value={templateName} disabled={busy} onChange={(event) => setTemplateName(event.target.value)}><option value="retail">Retail</option><option value="saas">SaaS</option><option value="blog">Blog</option><option value="ecommerce">E-commerce</option></select><button type="button" className="text-button" disabled={busy} onClick={loadTemplate}>Load {templateName} template</button></div>
              <textarea id="schema" spellCheck="false" autoCapitalize="off" autoComplete="off" aria-describedby="schema-help" value={editor} onChange={(event) => setEditor(event.target.value)} disabled={busy} />
              <div className="editor-metadata"><span><span className="connection-dot connected" />{stats ? `${stats.resources} resources / ${stats.rows} rows / ${stats.cells} cells` : 'JSON schema'}</span><span>seed: <b>{stats?.seed ?? '-'}</b></span></div>
              <div className="editor-footer"><p id="schema-help">Deterministic by design.<br /><span>Same schema + seed = same data.</span></p><button className="primary-button" disabled={busy} type="submit">{busy ? 'Loading...' : 'Generate API'}<span aria-hidden="true">→</span></button></div>
            </form>
            <section id="response-explorer" className="panel preview-panel" aria-label="API preview">
              <div className="panel-heading"><h2><span className="panel-icon" aria-hidden="true">⌁</span> Response explorer</h2><span className="badge">{mode === 'demo' ? 'Public demo' : 'Personal API'}</span></div>
              {!resources.length ? <div className="empty"><div className="empty-illustration" aria-hidden="true"><div className="mini-endpoint"><span>GET</span> /your_resource <i /></div><div className="mini-code"><span>{'{'}</span><span>&nbsp; "data": [<b>...</b>],</span><span>&nbsp; "ready": <b>true</b></span><span>{'}'}</span></div></div><h3>A real endpoint. Not another fixture.</h3><p>Define your resources and hit Generate API.<br />Explore rows, inspect JSON, and connect your app.</p><div className="empty-features"><span>Seeded data</span><span>Linked resources</span><span>REST + OpenAPI</span></div></div> : <>
                <div className="endpoint-toolbar"><a className="endpoint" href={`${previewBase}/${active}?${query}`} title={`${previewBase}/${active}?${query}`} aria-label={`GET /${active}`} target="_blank" rel="noreferrer"><span className="method">GET</span><code>/{active}</code><span className="endpoint-arrow" aria-hidden="true">↗</span></a><button type="button" className="secondary" onClick={copyCurl}>Copy cURL</button></div>
                <form className="query-form" ref={queryForm} key={`${previewBase}/${active}`} onSubmit={applyQuery}><fieldset disabled={busy || previewBusy}><legend>Request query</legend><div className="query-fields"><label>Page<input name="page" type="number" min="1" max="1000000" defaultValue="1" required /></label><label>Page size<select name="limit" defaultValue="5">{[5, 10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label><label>Sort field<input name="sort" placeholder="e.g. name" maxLength="48" /></label><label>Sort order<select name="order" defaultValue="asc"><option value="asc">Ascending</option><option value="desc">Descending</option></select></label><label>Filter field<input name="filter_field" placeholder="e.g. status" maxLength="48" /></label><label>Filter value<input name="filter_value" placeholder="Exact match" maxLength="256" /></label></div><details className="simulation-controls"><summary>Simulate a response</summary><p>Request-only controls. Stored data is unchanged. Delays are capped at 3 seconds and four concurrent requests per instance.</p><div className="query-fields"><label>Delay (ms)<input name="delay_ms" type="number" min="0" max="3000" defaultValue="0" required /></label><label>HTTP status<select name="status" defaultValue="200">{[200, 400, 401, 403, 404, 429, 500, 503].map((status) => <option key={status} value={status}>{status}</option>)}</select></label><label className="checkbox-label"><input name="empty" type="checkbox" />Empty result</label></div></details><button type="submit">Apply query</button><button type="reset" onClick={() => { setQuery('limit=5'); setQueryRun((value) => value + 1); }}>Reset query</button></fieldset></form>
                <div className="request-meta"><code>?{query}</code><span>GET /{active}/{'{id}'} also available</span></div>
                <div className="response-toolbar"><div role="tablist" aria-label="Response format">{['table', 'json'].map((format) => <button key={format} id={`tab-${format}`} role="tab" aria-controls="response-panel" aria-selected={view === format} tabIndex={view === format ? 0 : -1} type="button" onKeyDown={(event) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                  event.preventDefault();
                  const next = event.key === 'Home' ? 'table' : event.key === 'End' ? 'json' : format === 'table' ? 'json' : 'table';
                  setView(next);
                  document.getElementById(`tab-${next}`).focus();
                }} onClick={() => setView(format)}>{format === 'table' ? 'Table' : 'JSON'}</button>)}</div><span>{sample ? `${sample.data.length} of ${sample.total} rows` : 'Fetching response'}</span></div>
                <div role="tabpanel" id="response-panel" aria-labelledby={`tab-${view}`} tabIndex="0" className="response-content">
                  {previewBusy && <p className="loading-message">Loading sample rows...</p>}
                  {previewFailure && <div className="preview-failure"><p>HTTP {previewFailure.status || 'unavailable'}</p><pre>{JSON.stringify(previewFailure.body || { detail: 'The API could not be reached.' }, null, 2)}</pre></div>}
                  {sample?.data.length === 0 && <p className="loading-message">No rows returned. Reset the query to inspect the full dataset.</p>}
                  {sample && (view === 'json' ? <pre className="json-response" aria-label="JSON response" tabIndex="0">{JSON.stringify(sample, null, 2)}</pre> : <div className="table-scroll" role="region" aria-label={`${active} response table`} tabIndex="0"><table><caption className="sr-only">Sample rows from {active}</caption><thead><tr><th scope="col" className="row-number">#</th>{Object.keys(sample.data[0] || {}).map((field) => <th scope="col" key={field}>{field}</th>)}</tr></thead><tbody>{sample.data.map((row, index) => <tr key={row.id}><td className="row-number">{index + 1}</td>{Object.entries(row).map(([field, value]) => <td key={field} title={String(value)}>{String(value)}</td>)}</tr>)}</tbody></table></div>)}
                </div>
                <div className="response-footer"><span className={`connection-dot ${sample ? 'connected' : ''}`} />{sample ? 'Response received' : 'Waiting for response'}<span className="response-footer-note">Read-only REST API</span></div>
              </>}
            </section>
          </div>
          <section className="reference-bar" aria-label="Schema quick reference"><span className="reference-title">FIELD TYPES</span><code>uuid</code><code>person</code><code>email</code><code>money</code><code>datetime</code><code>enum</code><code>ref(resource.id)</code><a href={`${docsBase}/docs`} target="_blank" rel="noreferrer">View API reference ↗</a></section>
          <details className="admin-panel" onToggle={(event) => { if (!event.currentTarget.open) setAdminToken(''); }}><summary>Admin publishing</summary><p>Replaces the shared demo for all visitors. Token stays in memory and is cleared on submission or close.</p><form onSubmit={publishDemo}><label htmlFor="admin-token">Admin token</label><input id="admin-token" type="password" autoComplete="off" value={adminToken} onChange={(event) => setAdminToken(event.target.value)} /><button type="submit" disabled={busy || !adminToken}>Publish shared demo</button><button type="button" onClick={() => setAdminToken('')}>Clear token</button></form></details>
          <footer><div className="footer-meta"><span><img src="/logo.svg" width="16" height="16" alt="" /> Fake data. Real progress.</span><span>In-memory <i /> Resets on restart <i /> Synthetic data only</span></div><CreatorAttribution /></footer>
        </main>
      </div>
      <div className={`toast ${notice ? 'visible' : ''}`} role="status" aria-live="polite">{notice}</div>
    </div>
    <BootSplash active={!booted} />
    </>
  );
}
