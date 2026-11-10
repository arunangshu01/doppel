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
  expect(screen.getByRole('link', { name: 'GET /users' })).toHaveAttribute('href', 'http://localhost/doppel/api/playgrounds/session-a/users');
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
  expect(screen.getByRole('link', { name: 'GET /users' })).toHaveAttribute('href', 'http://localhost/doppel/api/users');
  expect(global.fetch.mock.calls.every(([, options]) => !options?.method)).toBe(true);
});

test('returns to the demo without changing a personal playground', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText('Ada Lovelace');
  global.fetch.mockImplementationOnce(() => response(manifest));
  await user.click(screen.getByRole('button', { name: 'Generate API' }));
  await user.click(screen.getByRole('button', { name: 'Public demo' }));
  expect(screen.getByRole('link', { name: 'GET /users' })).toHaveAttribute('href', 'http://localhost/doppel/api/users');
  await user.click(screen.getByRole('button', { name: 'My playground' }));
  expect(screen.getByRole('link', { name: 'GET /users' })).toHaveAttribute('href', 'http://localhost/doppel/api/playgrounds/session-a/users');
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

test('loads the retail template into the editor', async () => {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(screen.getByLabelText('Schema JSON')).not.toHaveValue(''));
  await user.clear(screen.getByLabelText('Schema JSON'));
  await user.click(screen.getByRole('button', { name: 'Load retail template' }));
  await waitFor(() => expect(screen.getByLabelText('Schema JSON')).toHaveValue(JSON.stringify(schema, null, 2)));
});
