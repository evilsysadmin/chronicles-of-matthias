import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./ChroniclesAudioControls.jsx', () => ({ default: () => null }));
import ChroniclesAdventureMenu from './ChroniclesAdventureMenu.jsx';

describe('Chronicles adventure menu hotkey affordances', () => {
  const handlers = {
    onClose: () => {}, onContinue: () => {}, onJournal: () => {},
    onQuickStatus: () => {}, onSave: () => {}, onSaveExit: () => {},
    onAdmin: () => {}, onRequestExit: () => {},
    onDiscardExit: () => {}, onCancelExit: () => {},
  };

  it('shows the same S/Q labels as the shortcuts routed to the real handlers', () => {
    const html = renderToStaticMarkup(<ChroniclesAdventureMenu {...handlers} />);
    expect(html).toContain('Guardar partida · S');
    expect(html).toContain('data-confirming-exit="false"');
    expect(html).toContain('S · guardar · Q · salir · ESC · cerrar · TAB · navegar');
    expect(html).toContain('Salir sin guardar · Q');
    expect(html).toContain('S · guardar · Q · salir');
    expect(html).toContain('Guardar y salir');
  });

  it('Q still requires explicit confirmation before discarding the run', () => {
    const html = renderToStaticMarkup(<ChroniclesAdventureMenu {...handlers}
      confirmExitWithoutSaving />);
    expect(html).toContain('Confirmar salida sin guardar');
    expect(html).toContain('Sí, salir sin guardar');
    expect(html).toContain('Cancelar');
    expect(html).not.toContain('Salir sin guardar · Q');
    expect(html).not.toContain('Guardar partida · S');
    expect(html).not.toContain('Guardar y salir');
    expect(html).not.toContain('>Continuar<');
    expect(html).toContain('data-confirming-exit="true"');
    expect(html).toContain('hidden=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('ESC · cancelar salida · TAB · elegir respuesta');
  });

  it('does not advertise a second save action while save is pending', () => {
    const html = renderToStaticMarkup(<ChroniclesAdventureMenu {...handlers} saveBusy />);
    expect(html).toContain('Guardando…');
    expect(html).not.toContain('Guardar partida · S');
    expect(html).toContain('disabled');
  });
});
