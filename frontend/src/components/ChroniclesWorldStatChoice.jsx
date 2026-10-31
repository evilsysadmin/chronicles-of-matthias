import { useEffect } from 'react';
import './ChroniclesWorldStatChoice.css';

// Choice is explicit and cancelable. No stat is awarded by merely opening the
// crystal, and the fallen cannot be selected as its beneficiary.
export default function ChroniclesWorldStatChoice({ offer, party, onSelect, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      } else if (event.key !== 'Tab') {
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  if (!offer) return null;
  return (
    <div className="chronicles-world-stat-choice__backdrop">
      <section className="chronicles-world-stat-choice" role="dialog" aria-modal="true"
        aria-labelledby="chronicles-world-stat-title" aria-describedby="chronicles-world-stat-description">
        <header>
          <span className="chronicles-world-stat-choice__sigil" aria-hidden="true">✧</span>
          <div>
            <h2 id="chronicles-world-stat-title">Cristal de la fortaleza</h2>
            <p id="chronicles-world-stat-description">Su poder concede +1 Resistencia permanente. ¿Quién lo recibirá?</p>
          </div>
        </header>
        <div className="chronicles-world-stat-choice__party" role="group" aria-label="Elegir beneficiario">
          {(party || []).map((hero) => (
            <button type="button" key={hero.id} disabled={hero.hp <= 0}
              onClick={() => onSelect(hero.id)}>
              <strong>{hero.name}</strong>
              <span>{hero.hp > 0 ? `${hero.hp}/${hero.maxHp} PV · +1 Resistencia` : 'Fuera de combate'}</span>
            </button>
          ))}
        </div>
        <footer>
          <small>Un solo uso por expedición. Este hallazgo se guarda al salvar la partida.</small>
          <button type="button" onClick={onClose} autoFocus>Ahora no · Esc</button>
        </footer>
      </section>
    </div>
  );
}
