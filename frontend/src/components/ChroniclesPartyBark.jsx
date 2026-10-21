import './ChroniclesPartyBark.css';

export default function ChroniclesPartyBark({ bark, onOpenEquipment = null }) {
  if (!bark?.text) return null;

  return (
    <aside className="chronicles-party-bark" data-speaker={bark.speakerId} role="status" aria-live="polite" aria-atomic="true">
      <span className="chronicles-party-bark-glyph" aria-hidden="true">{bark.glyph}</span>
      <div>
        <strong>{bark.speaker}</strong>
        <p>{bark.text}</p>
        {bark.event === 'first-book-deserter-loot' && typeof onOpenEquipment === 'function' && (
          <button type="button" className="chronicles-party-bark__action"
            onClick={onOpenEquipment}>Revisar equipo</button>
        )}
      </div>
    </aside>
  );
}
