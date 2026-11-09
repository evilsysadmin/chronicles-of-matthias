import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ChroniclesWorldInfo from '../src/components/ChroniclesWorldInfo.jsx';
import { chroniclesWorldCalendar } from '../src/chronicles/chroniclesWorldTime.js';
import { chroniclesFatigueStatus } from '../src/chronicles/chroniclesFatigue.js';
import '../src/components/ChroniclesOfMatthias.css';
import '../src/components/ChroniclesWorldInfo.css';

const params = new URLSearchParams(location.search);
const tired = params.get('fatigue') === 'true';
const minutes = tired ? 24 * 60 : params.get('phase') === 'night' ? 22 * 60 : 8 * 60;
function Preview() {
  const [open, setOpen] = useState(true);
  return <div className="chronicles" style={{ minHeight: '100dvh', background:
    'linear-gradient(135deg,#162736,#35463e 45%,#131925)' }}>
    <div data-world-time-minutes={minutes} />
    {open && <ChroniclesWorldInfo calendar={chroniclesWorldCalendar(minutes)}
      fatigue={chroniclesFatigueStatus({ combatRules: 'mm3', worldMinutes: minutes, lastRestWorldMinutes: 480 })}
      onClose={() => setOpen(false)} />}
  </div>;
}
createRoot(document.getElementById('root')).render(<Preview />);
