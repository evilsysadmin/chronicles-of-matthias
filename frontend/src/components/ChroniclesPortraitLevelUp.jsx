export default function ChroniclesPortraitLevelUp({ heroName, toLevel }) {
  return (
    <span className="chronicles-portrait-levelup" role="status" aria-live="polite"
      aria-label={`${heroName} sube al nivel ${toLevel}`} data-chronicles-levelup={toLevel}>
      <span className="chronicles-portrait-levelup__arrow" aria-hidden="true">↑</span>
      <strong aria-hidden="true">LEVEL UP!</strong>
      <small aria-hidden="true">Nv {toLevel}</small>
    </span>
  );
}
