import { useEffect, useState } from 'react';

const STAGES = [
  { after: 0, title: 'Connecting to the doppel API', hint: 'Preparing the public demo and your workbench.' },
  { after: 4, title: 'Waking up the server', hint: 'The API scales to zero when idle, so the first request can take a few seconds.' },
  { after: 15, title: 'Still warming up', hint: 'This is taking longer than usual. Hang tight, or reload the page if it does not finish.' },
];

export default function BootSplash({ active, delay = 300 }) {
  const [visible, setVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      setElapsed(0);
      return undefined;
    }
    const started = Date.now();
    const show = setTimeout(() => setVisible(true), delay);
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => { clearTimeout(show); clearInterval(tick); };
  }, [active, delay]);

  if (!active || !visible) return null;
  const stage = STAGES.findLast(({ after }) => elapsed >= after);
  return (
    <div className="boot-splash" role="status" aria-live="polite">
      <div className="boot-card">
        <img className="boot-logo" src="/logo.svg" width="64" height="64" alt="" />
        <p className="boot-brand">doppel</p>
        <p className="boot-title">{stage.title}...</p>
        <div className="boot-progress" aria-hidden="true"><span /></div>
        <p className="boot-hint">{stage.hint}</p>
      </div>
    </div>
  );
}
