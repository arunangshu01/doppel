import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const schema = { seed: 42, resources: { users: { count: 2, fields: { id: 'uuid', name: 'person' } } } };
const manifest = { id: 'session-a', base_path: '/doppel/api/playgrounds/session-a', expires_at: '2030-01-01T00:00:00Z', resources: [{ name: 'users', count: 2, endpoint: '/doppel/api/playgrounds/session-a/users' }] };
const demo = { base_path: '/doppel/api', schema, resources: [{ name: 'users', count: 2, endpoint: '/doppel/api/users' }] };
const response = (body, ok = true) => Promise.resolve({ ok, json: async () => body });

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn((url) => {
    if (url === '/doppel/api/demo') return response(demo);
    if (url === '/doppel/api/templates/retail') return response(schema);
    if (url.includes('/users')) return response({ data: [{ id: '123', name: 'Ada Lovelace' }], total: 2 });
    throw new Error(`Unexpected URL: ${url}`);
  });
});

afterEach(() => jest.restoreAllMocks());

test('provides quick navigation between the editor and response explorer', async () => {
  render(<App />);
  await screen.findByText('Ada Lovelace');
  expect(screen.getByRole('link', { name: 'Jump to schema editor' })).toHaveAttribute('href', '#schema-editor');
  expect(screen.getByRole('link', { name: 'Jump to response explorer' })).toHaveAttribute('href', '#response-explorer');
  expect(screen.getByLabelText('Schema JSON').closest('form')).toHaveAttribute('id', 'schema-editor');
  expect(screen.getByRole('region', { name: 'API preview' })).toHaveAttribute('id', 'response-explorer');
});

test('makes wide table and JSON response containers keyboard focusable', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText('Ada Lovelace');
  const table = screen.getByRole('region', { name: 'users response table' });
  expect(table).toHaveAttribute('tabindex', '0');
  table.focus();
  expect(table).toHaveFocus();
  await user.click(screen.getByRole('tab', { name: 'JSON' }));
  const json = screen.getByLabelText('JSON response');
  expect(json).toHaveAttribute('tabindex', '0');
  json.focus();
  expect(json).toHaveFocus();
});

test('shows approved creator attribution and clickable public contact links', async () => {
  render(<App />);
  await screen.findByText('Ada Lovelace');
  expect(screen.getByText('Arunangshu Pramanik')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/arunangshu01');
  expect(screen.getByRole('link', { name: 'Email Arunangshu Pramanik' })).toHaveAttribute('href', 'mailto:arunangshu01@gmail.com');
  expect(screen.getByRole('link', { name: 'GitHub' }).querySelector('svg')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Email Arunangshu Pramanik' }).querySelector('svg')).toBeInTheDocument();
  expect(document.querySelector('a[href^="tel:"]')).not.toBeInTheDocument();
  expect(screen.queryByText('arunangshu01@gmail.com')).not.toBeInTheDocument();
});

test('applies pagination, filtering and sorting and copies the applied query', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText('Ada Lovelace');
  await user.clear(screen.getByLabelText('Page'));
  await user.type(screen.getByLabelText('Page'), '2');
  await user.selectOptions(screen.getByLabelText('Page size'), '10');
  await user.type(screen.getByLabelText('Sort field'), 'name');
  await user.selectOptions(screen.getByLabelText('Sort order'), 'desc');
  await user.type(screen.getByLabelText('Filter field'), 'name');
  await user.type(screen.getByLabelText('Filter value'), 'Ada Lovelace');
  await user.click(screen.getByRole('button', { name: 'Apply query' }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('http://localhost/doppel/api/users?limit=10&page=2&sort=name&order=desc&name=Ada+Lovelace', expect.anything()));
  await user.click(screen.getByRole('button', { name: 'Copy cURL' }));
  expect(await navigator.clipboard.readText()).toContain('limit=10&page=2&sort=name&order=desc&name=Ada+Lovelace');
});

test('simulates errors without treating a simulated 404 as an expired playground', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText('Ada Lovelace');
  global.fetch.mockImplementationOnce(() => response(manifest));
  await user.click(screen.getByRole('button', { name: 'Generate API' }));
  await screen.findByText('Ada Lovelace');
  await user.click(screen.getByText('Simulate a response'));
  await user.selectOptions(screen.getByLabelText('HTTP status'), '404');
  global.fetch.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 404, json: async () => ({ detail: 'Simulated HTTP 404 response', simulated: true }) }));
  await user.click(screen.getByRole('button', { name: 'Apply query' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Simulated HTTP 404');
  expect(screen.getByText('HTTP 404')).toBeInTheDocument();
  global.fetch.mockImplementationOnce(() => response(manifest));
  await user.click(screen.getByRole('button', { name: 'Generate API' }));
  expect(global.fetch).toHaveBeenLastCalledWith(expect.stringContaining('/users?limit=5'), expect.anything());
  expect(global.fetch).toHaveBeenCalledWith('/doppel/api/playgrounds/session-a', expect.objectContaining({ method: 'PUT' }));
});

test('simulates empty results and resets the request controls', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText('Ada Lovelace');
  await user.click(screen.getByText('Simulate a response'));
  await user.click(screen.getByLabelText('Empty result'));
  global.fetch.mockImplementationOnce(() => response({ data: [], total: 0 }));
  await user.click(screen.getByRole('button', { name: 'Apply query' }));
  expect(await screen.findByText(/No rows returned/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Reset query' }));
  await screen.findByText('Ada Lovelace');
  expect(screen.getByLabelText('Empty result')).not.toBeChecked();
});

test('imports a saved schema as a draft without publishing', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText('Ada Lovelace');
  const imported = { ...schema, seed: 99 };
  await user.upload(screen.getByLabelText('Import schema'), new File([JSON.stringify(imported)], 'saved.json', { type: 'application/json' }));
  await waitFor(() => expect(screen.getByLabelText('Schema JSON')).toHaveValue(JSON.stringify(imported, null, 2)));
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  expect(screen.getByText('Unpublished changes')).toBeInTheDocument();
});

test('rejects malformed and oversized imports without replacing the editor', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText('Ada Lovelace');
  const original = screen.getByLabelText('Schema JSON').value;
  await user.upload(screen.getByLabelText('Import schema'), new File(['not json'], 'broken.json', { type: 'application/json' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('valid JSON');
  expect(screen.getByLabelText('Schema JSON')).toHaveValue(original);
  await user.upload(screen.getByLabelText('Import schema'), new File(['x'.repeat(131073)], 'large.json', { type: 'application/json' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('128 KiB');
  expect(screen.getByLabelText('Schema JSON')).toHaveValue(original);
});

test('persists an explicit dark theme and restores it on remount', async () => {
  const user = userEvent.setup();
  const { unmount } = render(<App />);
  await waitFor(() => expect(screen.getByLabelText('Schema JSON')).not.toHaveValue(''));
  await user.selectOptions(screen.getByLabelText('Color theme'), 'dark');
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(localStorage.getItem('doppel-theme')).toBe('dark');
  unmount();
  render(<App />);
  await waitFor(() => expect(screen.getByLabelText('Schema JSON')).not.toHaveValue(''));
  expect(screen.getByLabelText('Color theme')).toHaveValue('dark');
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  await user.selectOptions(screen.getByLabelText('Color theme'), 'light');
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
});

test('follows system theme changes until explicitly overridden', async () => {
  let onChange;
  const media = { matches: true, addEventListener: jest.fn((_, listener) => { onChange = listener; }), removeEventListener: jest.fn() };
  const original = window.matchMedia;
  window.matchMedia = jest.fn(() => media);
  try {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await waitFor(() => expect(screen.getByLabelText('Schema JSON')).not.toHaveValue(''));
    expect(screen.getByLabelText('Color theme')).toHaveValue('system');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    act(() => onChange({ matches: false }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    await user.selectOptions(screen.getByLabelText('Color theme'), 'dark');
    act(() => onChange({ matches: false }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    unmount();
    expect(media.removeEventListener).toHaveBeenCalled();
  } finally {
    window.matchMedia = original;
  }
});

test('formats schema JSON without publishing', async () => {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(screen.getByLabelText('Schema JSON')).not.toHaveValue(''));
  await user.clear(screen.getByLabelText('Schema JSON'));
  await user.paste(JSON.stringify(schema));
  await user.click(screen.getByRole('button', { name: 'Format JSON' }));
  expect(screen.getByLabelText('Schema JSON')).toHaveValue(JSON.stringify(schema, null, 2));
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('switches to JSON and copies a usable cURL request', async () => {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(screen.getByLabelText('Schema JSON')).not.toHaveValue(''));
  global.fetch.mockImplementationOnce(() => response(manifest));
  await user.click(screen.getByRole('button', { name: 'Generate API' }));
  await screen.findByText('Ada Lovelace');
  screen.getByRole('tab', { name: 'Table' }).focus();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'JSON' })).toHaveFocus();
  expect(screen.getByLabelText('JSON response')).toHaveTextContent('Ada Lovelace');
  await user.click(screen.getByRole('button', { name: 'Copy cURL' }));
  expect(await navigator.clipboard.readText()).toBe("curl 'http://localhost/doppel/api/playgrounds/session-a/users?limit=5'");
  expect(screen.getByRole('status')).toHaveTextContent('cURL copied');
});

test('loads schema, publishes it, and previews live endpoints', async () => {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(screen.getByLabelText('Schema JSON')).toHaveValue(JSON.stringify(schema, null, 2)));
  global.fetch.mockImplementationOnce(() => response(manifest));
  await user.click(screen.getByRole('button', { name: 'Generate API' }));
  expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'GET /users' })).toHaveAttribute('href', 'http://localhost/doppel/api/playgrounds/session-a/users?limit=5');
  expect(global.fetch).toHaveBeenCalledWith('/doppel/api/playgrounds', expect.objectContaining({ method: 'POST', body: JSON.stringify(schema) }));
});

test('marks edits as unpublished while preserving the live response', async () => {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(screen.getByLabelText('Schema JSON')).not.toHaveValue(''));
  global.fetch.mockImplementationOnce(() => response(manifest));
  await user.click(screen.getByRole('button', { name: 'Generate API' }));
  await screen.findByText('Ada Lovelace');
  await user.click(screen.getByLabelText('Schema JSON'));
  await user.keyboard('{End} ');
  expect(screen.getByText('Unpublished changes')).toBeInTheDocument();
  expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(4);
});

test('rejects invalid JSON without publishing', async () => {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(screen.getByLabelText('Schema JSON')).not.toHaveValue(''));
  await user.clear(screen.getByLabelText('Schema JSON'));
  await user.type(screen.getByLabelText('Schema JSON'), 'not json');
  await user.click(screen.getByRole('button', { name: 'Generate API' }));
  expect(screen.getByRole('alert')).toHaveTextContent('valid JSON');
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('shows backend validation errors', async () => {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(screen.getByLabelText('Schema JSON')).not.toHaveValue(''));
  global.fetch.mockImplementationOnce(() => response({ detail: [{ msg: 'id must be uuid' }] }, false));
  await user.click(screen.getByRole('button', { name: 'Generate API' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('id must be uuid');
});

test('starts on the public demo without generating data', async () => {
  render(<App />);
  await screen.findByText('Ada Lovelace');
  expect(screen.getByRole('link', { name: 'GET /users' })).toHaveAttribute('href', 'http://localhost/doppel/api/users?limit=5');
  expect(global.fetch.mock.calls.every(([, options]) => !options?.method)).toBe(true);
});

test('returns to the demo without changing a personal playground', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText('Ada Lovelace');
  global.fetch.mockImplementationOnce(() => response(manifest));
  await user.click(screen.getByRole('button', { name: 'Generate API' }));
  await user.click(screen.getByRole('button', { name: 'Public demo' }));
  expect(screen.getByRole('link', { name: 'GET /users' })).toHaveAttribute('href', 'http://localhost/doppel/api/users?limit=5');
  await user.click(screen.getByRole('button', { name: 'My playground' }));
  expect(screen.getByRole('link', { name: 'GET /users' })).toHaveAttribute('href', 'http://localhost/doppel/api/playgrounds/session-a/users?limit=5');
});

test('admin publication requires confirmation and clears the token', async () => {
  const user = userEvent.setup();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  render(<App />);
  await screen.findByText('Ada Lovelace');
  await user.click(screen.getByText('Admin publishing'));
  await user.type(screen.getByLabelText('Admin token'), 'test-ui-token');
  global.fetch.mockImplementationOnce(() => response(demo));
  await user.click(screen.getByRole('button', { name: 'Publish shared demo' }));
  expect(window.confirm).toHaveBeenCalled();
  expect(global.fetch).toHaveBeenCalledWith('/doppel/api/schema', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-ui-token' }) }));
  expect(screen.getByLabelText('Admin token')).toHaveValue('');
  expect(JSON.stringify(localStorage)).not.toContain('test-ui-token');
});

test('updates a visitor playground without changing its URL', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText('Ada Lovelace');
  global.fetch.mockImplementationOnce(() => response(manifest));
  await user.click(screen.getByRole('button', { name: 'Generate API' }));
  global.fetch.mockImplementationOnce(() => response(manifest));
  await user.click(screen.getByRole('button', { name: 'Generate API' }));
  expect(global.fetch).toHaveBeenCalledWith('/doppel/api/playgrounds/session-a', expect.objectContaining({ method: 'PUT' }));
});

test('does not publish when admin confirmation is cancelled', async () => {
  const user = userEvent.setup();
  jest.spyOn(window, 'confirm').mockReturnValue(false);
  render(<App />);
  await screen.findByText('Ada Lovelace');
  await user.click(screen.getByText('Admin publishing'));
  await user.type(screen.getByLabelText('Admin token'), 'test-ui-token');
  await user.click(screen.getByRole('button', { name: 'Publish shared demo' }));
  expect(global.fetch).toHaveBeenCalledTimes(2);
  await user.click(screen.getByRole('button', { name: 'Clear token' }));
  expect(screen.getByLabelText('Admin token')).toHaveValue('');
});

test('downloads a schema without credentials or network mutation', async () => {
  const user = userEvent.setup();
  URL.createObjectURL = jest.fn(() => 'blob:schema');
  URL.revokeObjectURL = jest.fn();
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<App />);
  await screen.findByText('Ada Lovelace');
  await user.click(screen.getByRole('button', { name: 'Download schema' }));
  expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  expect(click).toHaveBeenCalled();
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('recovers an expired session by creating a new one on the next generation', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText('Ada Lovelace');
  global.fetch.mockImplementationOnce(() => response(manifest));
  await user.click(screen.getByRole('button', { name: 'Generate API' }));
  global.fetch.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 404, json: async () => ({ detail: 'Playground expired' }) }));
  await user.click(screen.getByRole('button', { name: 'Generate API' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Playground expired');
  global.fetch.mockImplementationOnce(() => response(manifest));
  await user.click(screen.getByRole('button', { name: 'Generate API' }));
  expect(global.fetch).toHaveBeenCalledWith('/doppel/api/playgrounds', expect.objectContaining({ method: 'POST' }));
});

test('reports a non-JSON response instead of exposing a JSON parser error', async () => {
  global.fetch.mockResolvedValue({ ok: false, json: async () => { throw new SyntaxError('bad response'); } });
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Hosting API rewrite');
});

test('reports a connection failure', async () => {
  global.fetch.mockRejectedValue(new Error('Backend unavailable'));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Backend unavailable');
});

test('changes the draft data locale without regenerating the live API', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText('Ada Lovelace');
  await user.selectOptions(screen.getByLabelText('Data locale'), 'en_IN');
  expect(JSON.parse(screen.getByLabelText('Schema JSON').value).locale).toBe('en_IN');
  expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('loads the selected starter template without publishing', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText('Ada Lovelace');
  await user.selectOptions(screen.getByLabelText('Starter template'), 'blog');
  global.fetch.mockImplementationOnce(() => response({ ...schema, seed: 7 }));
  await user.click(screen.getByRole('button', { name: 'Load blog template' }));
  await waitFor(() => expect(screen.getByLabelText('Schema JSON')).toHaveValue(JSON.stringify({ ...schema, seed: 7 }, null, 2)));
  expect(global.fetch).toHaveBeenCalledWith('/doppel/api/templates/blog', undefined);
  expect(global.fetch.mock.calls.every(([, options]) => !options?.method)).toBe(true);
});

test('loads the retail template into the editor', async () => {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(screen.getByLabelText('Schema JSON')).not.toHaveValue(''));
  await user.clear(screen.getByLabelText('Schema JSON'));
  await user.click(screen.getByRole('button', { name: 'Load retail template' }));
  await waitFor(() => expect(screen.getByLabelText('Schema JSON')).toHaveValue(JSON.stringify(schema, null, 2)));
});
