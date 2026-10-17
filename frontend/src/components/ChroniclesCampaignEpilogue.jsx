import { chroniclesCampaignEpilogue } from '../chronicles/chroniclesCampaignEpilogue.js';
import './ChroniclesBookOneEpilogue.css';

// Closing pages of «El rey desaparecido». Open (the ending was just chosen)
// it lets the company keep exploring Terra or close the chronicle for good;
// closed (the run is complete) it offers a new game.
export default function ChroniclesCampaignEpilogue({ state, closed = false, onContinue, onClose, onRestart, onExit }) {
  const epilogue = chroniclesCampaignEpilogue(state);
  if (!epilogue) return null;

  return (
    <div className="chronicles-epilogue chronicles-campaign-epilogue" role="dialog" aria-modal="true"
      aria-label="Epílogo de El rey desaparecido" data-chronicles-ending={epilogue.ending}>
      <div className="chronicles-epilogue-leaf">
        <span className="chronicles-epilogue-kicker">EL REY DESAPARECIDO · {closed ? 'CRÓNICA CERRADA' : 'EPÍLOGO'}</span>
        <strong>{epilogue.title}</strong>
        <p className="chronicles-epilogue-lead">{epilogue.lead}</p>
        <div className="chronicles-epilogue-rule" aria-hidden="true">✦</div>
        {epilogue.lines.map((line) => <p key={line}>{line}</p>)}
        <blockquote>
          <span>Matthias</span>
          “{epilogue.verdict}”
        </blockquote>
        {closed ? (
          <div className="chronicles-epilogue-actions">
            {onExit && <button type="button" className="secondary-btn" onClick={onExit}>Salir</button>}
            <button type="button" className="primary-btn" onClick={onRestart}>Empezar otra crónica</button>
          </div>
        ) : (
          <div className="chronicles-epilogue-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>Cerrar la crónica</button>
            <button type="button" className="primary-btn" onClick={onContinue}>Seguir explorando Terra</button>
          </div>
        )}
      </div>
    </div>
  );
}
