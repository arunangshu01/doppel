import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import Landing from './Landing';
import Root, { isPlayground } from './Root';

const demo = { base_path: '/doppel/api/v1', schema: { seed: 42, resources: { users: { count: 2, fields: { id: 'uuid' } } } }, resources: [{ name: 'users', count: 2, endpoint: '/doppel/api/v1/users' }] };

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn((url) => Promise.resolve({ ok: true, json: async () => (url === '/doppel/api/v1/demo' ? demo : { data: [{ id: '123', name: 'Ada Lovelace' }], total: 2 }) }));
});

afterEach(() => jest.restoreAllMocks());

test('presents the product with calls to action into the playground and docs', () => {
  render(<Landing apiBase="/doppel/api/v1" />);
  expect(screen.getByRole('heading', { level: 1, name: 'Your backend stand-in.' })).toBeInTheDocument();
  expect(document.title).toBe('doppel - Mock REST APIs with realistic seeded data');
  const playgroundLinks = screen.getAllByRole('link', { name: /playground/i });
  expect(playgroundLinks.length).toBeGreaterThanOrEqual(3);
  playgroundLinks.forEach((link) => expect(link).toHaveAttribute('href', '/playground'));
  expect(screen.getByRole('link', { name: /Explore the demo API/ })).toHaveAttribute('href', '/doppel/api/v1/docs');
  expect(screen.getByRole('link', { name: /View on GitHub/ })).toHaveAttribute('href', 'https://github.com/arunangshu01/doppel');
  expect(fetch).not.toHaveBeenCalled();
});

test('describes real features, templates, and limits', () => {
  render(<Landing />);
  for (const heading of ['Realistic seeded data', 'Linked resources', 'Real REST queries', 'OpenAPI for every dataset', 'Failure simulation', 'Isolated playgrounds']) {
    expect(screen.getByRole('heading', { level: 3, name: heading })).toBeInTheDocument();
  }
  expect(within(screen.getByRole('list', { name: 'Retail resources' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['#stores', '#skus', '#transactions']);
  expect(screen.getByRole('list', { name: 'E-commerce resources' })).toHaveTextContent('customers');
  expect(screen.getByText(/expire after 30 minutes/)).toBeInTheDocument();
  expect(screen.getAllByRole('listitem').length).toBeGreaterThan(10);
  const steps = screen.getByRole('heading', { name: 'From schema to endpoint in three steps' }).parentElement;
  expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
});

test('shares the creator attribution and theme preference with the playground', async () => {
  const user = userEvent.setup();
  render(<Landing />);
  expect(Array.from(screen.getByRole('navigation', { name: 'Creator contact' }).querySelectorAll('a')).map((link) => link.getAttribute('aria-label'))).toEqual(['GitHub', 'LinkedIn', 'Email Arunangshu Pramanik']);
  await user.selectOptions(screen.getByLabelText('Color theme'), 'dark');
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(localStorage.getItem('doppel-theme')).toBe('dark');
});

test('offers skip navigation and passes structural accessibility checks', async () => {
  const { container } = render(<Landing />);
  expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#content');
  expect(screen.getByRole('main')).toHaveAttribute('id', 'content');
  const result = await axe.run(container, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] }, rules: { 'color-contrast': { enabled: false } } });
  expect(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([]);
});

test.each([
  ['/playground', true], ['/playground/', true], ['/', false], ['/playgrounds', false], ['/anything', false],
])('routes %s to the playground: %s', (pathname, expected) => {
  expect(isPlayground(pathname)).toBe(expected);
});

test('renders the landing page at / and the workbench at /playground', async () => {
  const { unmount } = render(<Root apiBase="/doppel/api/v1" pathname="/" />);
  expect(screen.getByRole('heading', { level: 1, name: 'Your backend stand-in.' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Schema JSON')).not.toBeInTheDocument();
  unmount();
  render(<Root apiBase="/doppel/api/v1" pathname="/playground" />);
  expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
  expect(screen.getByLabelText('Schema JSON')).toBeInTheDocument();
});
