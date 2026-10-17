import { useMemo, useState } from 'react';
import { chroniclesAdminDestinations } from '../chronicles/chroniclesAdmin.js';
import './ChroniclesAdminPanel.css';

// Admin-only testing tools. Every button is one 'admin' dispatch; travel is
// checkpointed with adminTravel so the API accepts the jump.
export default function ChroniclesAdminPanel({ state, onAction, onClose }) {
  const groups = useMemo(() => chroniclesAdminDestinations(), []);
  const [mapId, setMapId] = useState(state?.mapId || groups[0]?.maps[0]?.id || '');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [flagKey, setFlagKey] = useState('');
  const [flagValue, setFlagValue] = useState('true');
  const act = (command, extra = {}) => onAction({ type: 'admin', command, ...extra });

  return (
    <section className="chronicles-admin" role="dialog" aria-modal="true" aria-label="Modo admin">
      <header className="chronicles-admin__head">
        <div>
          <small>CHRONICLES · ADMIN</small>
          <strong>Modo admin</strong>
        </div>
        <button type="button" aria-label="Cerrar modo admin" onClick={onClose}>×</button>
      </header>
      <p className="chronicles-admin__where">En {state?.mapId} · X{state?.x} Y{state?.y}</p>

      <div className="chronicles-admin__row">
        <label htmlFor="chronicles-admin-map">Viajar a</label>
        <select id="chronicles-admin-map" value={mapId} onChange={(event) => setMapId(event.target.value)}>
          {groups.map((group) => (
            <optgroup key={group.id} label={group.label}>
              {group.maps.map((map) => <option key={map.id} value={map.id}>{map.label}</option>)}
            </optgroup>
          ))}
        </select>
        <button type="button" onClick={() => act('travel', { mapId })}>Viajar</button>
      </div>

      <div className="chronicles-admin__buttons">
        <button type="button" onClick={() => act('act-five')}>Preparar acto final (F6)</button>
        <button type="button" onClick={() => act('gold')}>+500 oro</button>
        <button type="button" onClick={() => act('xp')}>+1000 XP</button>
        <button type="button" onClick={() => act('heal')}>Curar y recargar</button>
      </div>

      <div className="chronicles-admin__row">
        <label htmlFor="chronicles-admin-item">Objeto</label>
        <input id="chronicles-admin-item" placeholder="steel-sword" value={itemId} onChange={(event) => setItemId(event.target.value)} />
        <input aria-label="Cantidad" className="chronicles-admin__qty" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        <button type="button" onClick={() => act('item', { itemId, quantity })}>Dar</button>
      </div>

      <div className="chronicles-admin__row">
        <label htmlFor="chronicles-admin-flag">Flag</label>
        <input id="chronicles-admin-flag" placeholder="varrenDefeated" value={flagKey} onChange={(event) => setFlagKey(event.target.value)} />
        <input aria-label="Valor" className="chronicles-admin__qty" value={flagValue} onChange={(event) => setFlagValue(event.target.value)} />
        <button type="button" onClick={() => act('flag', { key: flagKey, value: flagValue })}>Fijar</button>
      </div>
      <p className="chronicles-admin__hint">Los viajes se guardan solos. El resto, con «Guardar partida».</p>
    </section>
  );
}
