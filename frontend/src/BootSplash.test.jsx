import { act, render, screen } from '@testing-library/react';
import BootSplash from './BootSplash';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('waits briefly before appearing so fast connections never flash a splash', () => {
  render(<BootSplash active />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(299));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1));
  expect(screen.getByRole('status')).toHaveTextContent('Connecting to the doppel API');
});

test('explains cold starts as the wait grows and disappears once booted', () => {
  const { rerender } = render(<BootSplash active />);
  act(() => jest.advanceTimersByTime(4000));
  expect(screen.getByRole('status')).toHaveTextContent('Waking up the server');
  expect(screen.getByRole('status')).toHaveTextContent('scales to zero');
  act(() => jest.advanceTimersByTime(11000));
  expect(screen.getByRole('status')).toHaveTextContent('Still warming up');
  rerender(<BootSplash active={false} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  rerender(<BootSplash active />);
  act(() => jest.advanceTimersByTime(300));
  expect(screen.getByRole('status')).toHaveTextContent('Connecting to the doppel API');
});

test('renders nothing when the app has already booted', () => {
  const { container } = render(<BootSplash active={false} />);
  act(() => jest.advanceTimersByTime(5000));
  expect(container).toBeEmptyDOMElement();
});
