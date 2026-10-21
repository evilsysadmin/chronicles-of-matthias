import { useId, useState } from 'react';
import './ChroniclesPartyBark.css';

// Keep dialogue close to the edge of the 3D view. Hover/focus reveals it
// without a click; touch opens it with a real button instead of fake hover.
export default function ChroniclesPartyBark({ bark, onOpenEquipment = null }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  if (!bark?.text) return null;

  return (
    <aside className="chronicles-party-bark" data-speaker={bark.speakerId}
      data-expanded={expanded ? 'true' : 'false'}>
      <span className="chronicles-party-bark__announcement" role="status" aria-live="polite" aria-atomic="true">
        {bark.speaker}: {bark.text}
      </span>
      <button type="button" className="chronicles-party-bark__trigger"
        aria-controls={detailsId} aria-expanded={expanded}
        aria-label={`Comentario de ${bark.speaker}. ${expanded ? 'Ocultar' : 'Leer'}`}
        onClick={() => setExpanded((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && expanded) {
            event.preventDefault();
            event.stopPropagation();
            setExpanded(false);
            event.currentTarget.blur();
          }
        }}>
        <span className="chronicles-party-bark-glyph" aria-hidden="true">{bark.glyph}</span>
        <strong>{bark.speaker}</strong>
        <span className="chronicles-party-bark__chevron" aria-hidden="true">⌃</span>
      </button>
      <div id={detailsId} className="chronicles-party-bark__details">
        <p>{bark.text}</p>
        {bark.event === 'first-book-deserter-loot' && typeof onOpenEquipment === 'function' && (
          <button type="button" className="chronicles-party-bark__action"
            onClick={onOpenEquipment}>Revisar equipo</button>
        )}
      </div>
    </aside>
  );
}
