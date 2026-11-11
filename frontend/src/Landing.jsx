import { CreatorAttribution, REPOSITORY_URL, ThemeControl, useDocumentTitle, useTheme } from './shared';
import './App.css';
import './Landing.css';

const SCHEMA_SAMPLE = `{
  "seed": 42,
  "resources": {
    "users": { "count": 10, "fields": {
      "id": "uuid", "name": "person", "email": "email"
    }},
    "orders": { "count": 30, "fields": {
      "id": "uuid", "user_id": "ref(users.id)",
      "amount": "money", "created": "datetime"
    }}
  }
}`;

const RESPONSE_SAMPLE = `{
  "data": [{
    "id": "4c1f9a2e-...",
    "user_id": "9b2e7d10-...",
    "amount": 482.17,
    "created": "2023-06-14T09:21:44"
  }],
  "total": 30, "page": 1, "limit": 1
}`;

const FEATURES = [
  { icon: '{ }', title: 'Realistic seeded data', text: 'Names, emails, money, dates, enums, and more from Faker. The same schema and seed always produce the same rows.' },
  { icon: '->', title: 'Linked resources', text: 'Reference another resource with ref(users.id). Forward, self, and mutual references resolve to real IDs.' },
  { icon: '?=', title: 'Real REST queries', text: 'Pagination, exact-match filtering, and sorting on every list endpoint, plus GET by id.' },
  { icon: '</>', title: 'OpenAPI for every dataset', text: 'Each generated API ships interactive docs and an OpenAPI document you can import into your tools.' },
  { icon: '!', title: 'Failure simulation', text: 'Add delays, HTTP errors, or empty lists per request to test loading and error states without touching data.' },
  { icon: '#', title: 'Isolated playgrounds', text: 'Generate your own unlisted API without an account. Update it in place while you iterate on the schema.' },
];

const STEPS = [
  { title: 'Define a schema', text: 'Describe resources, field types, counts, and relationships in JSON, or start from a template.', code: '"user_id": "ref(users.id)"' },
  { title: 'Generate seeded data', text: 'One click creates a working REST API with reproducible data and per-dataset OpenAPI docs.', code: 'POST /doppel/api/v1/playgrounds' },
  { title: 'Build against it', text: 'Point your frontend, tests, or prototype at the endpoints and swap in the real backend later.', code: "fetch('.../orders?sort=amount')" },
];

const TEMPLATES = [
  { name: 'Retail', resources: ['stores', 'skus', 'transactions'] },
  { name: 'SaaS', resources: ['users', 'projects', 'tasks'] },
  { name: 'Blog', resources: ['authors', 'posts', 'comments'] },
  { name: 'E-commerce', resources: ['customers', 'products', 'orders'] },
];

const AUDIENCES = [
  ['Frontend developers', 'Build interfaces and integrate API calls without waiting for backend endpoints.'],
  ['Full-stack developers', 'Prototype data models and flows before implementing persistence.'],
  ['QA and test engineers', 'Recreate datasets for pagination, filtering, sorting, and relationship tests.'],
  ['Designers and prototypers', 'Fill interactive prototypes with realistic data instead of placeholders.'],
  ['Students and educators', 'Practice REST integration without setting up a database.'],
  ['Hackathon teams', 'Get a usable API for demos and proofs of concept in minutes.'],
];

const STATS = [['13', 'field types'], ['4', 'starter templates'], ['5', 'data locales'], ['0', 'sign-ups needed']];

export default function Landing({ apiBase = '/doppel/api/v1' }) {
  const [theme, setTheme] = useTheme();
  useDocumentTitle('doppel - Mock REST APIs with realistic seeded data');

  return (
    <div className="landing">
      <a className="skip-link" href="#content">Skip to content</a>
      <header className="topbar landing-header">
        <a className="brand" href="/" aria-label="doppel home"><img src="/logo.svg" width="34" height="34" alt="" /><span>doppel</span></a>
        <nav className="landing-nav" aria-label="Page sections"><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#templates">Templates</a></nav>
        <div className="header-actions">
          <a className="docs-link" href={`${apiBase}/docs`} target="_blank" rel="noreferrer">API docs <span aria-hidden="true">↗</span></a>
          <span className="header-divider" />
          <ThemeControl theme={theme} setTheme={setTheme} />
          <a className="button-link primary" href="/playground">Open playground</a>
        </div>
      </header>

      <main id="content" tabIndex="-1">
        <section className="lp-hero" aria-labelledby="hero-title">
          <div className="lp-hero-copy">
            <p className="eyebrow">SCHEMA IN. API OUT.</p>
            <h1 id="hero-title">Your backend stand-in.</h1>
            <p className="lp-lede">doppel turns a JSON schema into a working mock REST API with realistic, reproducible data and linked resources, so you can build and test before the real backend is ready.</p>
            <div className="lp-actions">
              <a className="button-link primary large" href="/playground">Open the playground <span aria-hidden="true">→</span></a>
              <a className="button-link large" href={`${apiBase}/docs`} target="_blank" rel="noreferrer">Explore the demo API <span aria-hidden="true">↗</span></a>
            </div>
            <ul className="lp-checks" aria-label="Highlights"><li>No database</li><li>No sign-up</li><li>Deterministic data</li></ul>
          </div>
          <div className="lp-demo" aria-label="Example schema and generated response" role="group">
            <div className="lp-window">
              <div className="lp-window-bar"><span className="lp-dots" aria-hidden="true"><i /><i /><i /></span><span>schema.json</span></div>
              <pre tabIndex="0" aria-label="Example schema"><code>{SCHEMA_SAMPLE}</code></pre>
            </div>
            <div className="lp-window lp-window-response">
              <div className="lp-window-bar"><span className="method">GET</span><span>/orders?limit=1</span><span className="lp-status">200 OK</span></div>
              <pre tabIndex="0" aria-label="Example response"><code>{RESPONSE_SAMPLE}</code></pre>
            </div>
          </div>
        </section>

        <section className="lp-stats" aria-label="At a glance">
          {STATS.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
        </section>

        <section id="features" className="lp-section" aria-labelledby="features-title">
          <p className="eyebrow">FEATURES</p>
          <h2 id="features-title">Everything a stand-in backend needs</h2>
          <p className="lp-section-lede">Real endpoints, not static fixtures. Shape the data once and explore it the way your app will.</p>
          <div className="lp-grid">
            {FEATURES.map(({ icon, title, text }) => <article className="lp-card" key={title}><span className="lp-card-icon" aria-hidden="true">{icon}</span><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </section>

        <section id="how-it-works" className="lp-section" aria-labelledby="how-title">
          <p className="eyebrow">HOW IT WORKS</p>
          <h2 id="how-title">From schema to endpoint in three steps</h2>
          <ol className="lp-steps">
            {STEPS.map(({ title, text, code }, index) => <li key={title}><span className="lp-step-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{text}</p><code>{code}</code></li>)}
          </ol>
        </section>

        <section id="templates" className="lp-section" aria-labelledby="templates-title">
          <p className="eyebrow">STARTER TEMPLATES</p>
          <h2 id="templates-title">Start from a realistic dataset</h2>
          <p className="lp-section-lede">Load a template in the playground, tweak counts and fields, and generate your own API.</p>
          <div className="lp-templates">
            {TEMPLATES.map(({ name, resources }) => <article className="lp-template" key={name}><h3>{name}</h3><ul aria-label={`${name} resources`}>{resources.map((resource) => <li key={resource}><span aria-hidden="true">#</span>{resource}</li>)}</ul></article>)}
          </div>
        </section>

        <section className="lp-section" aria-labelledby="audience-title">
          <p className="eyebrow">WHO IT IS FOR</p>
          <h2 id="audience-title">Built for anyone blocked on a backend</h2>
          <dl className="lp-audiences">
            {AUDIENCES.map(([who, how]) => <div key={who}><dt>{who}</dt><dd>{how}</dd></div>)}
          </dl>
        </section>

        <section className="lp-note" aria-labelledby="note-title">
          <h2 id="note-title">Ephemeral by design</h2>
          <p>Data lives in memory and is synthetic. Personal playgrounds are unlisted links that expire after 30 minutes and may reset sooner on restarts. Download your schema to recreate them, and never enter sensitive data.</p>
        </section>

        <section className="lp-cta" aria-labelledby="cta-title">
          <h2 id="cta-title">Ship before the backend is ready.</h2>
          <p>Open the playground, pick a template, and have a live API in seconds.</p>
          <div className="lp-actions"><a className="button-link primary large" href="/playground">Open the playground <span aria-hidden="true">→</span></a><a className="button-link large" href={REPOSITORY_URL} target="_blank" rel="noreferrer">View on GitHub <span aria-hidden="true">↗</span></a></div>
        </section>

        <footer>
          <div className="footer-meta"><span><img src="/logo.svg" width="16" height="16" alt="" /> Fake data. Real progress.</span><nav className="lp-footer-links" aria-label="Footer"><a href="/playground">Playground</a><a href={`${apiBase}/docs`} target="_blank" rel="noreferrer">API docs</a><a href={REPOSITORY_URL} target="_blank" rel="noreferrer">Source code</a></nav></div>
          <CreatorAttribution />
        </footer>
      </main>
    </div>
  );
}
