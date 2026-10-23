import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./ChroniclesAudioControls.jsx', () => ({ default: () => null }));
vi.mock('./ChroniclesFeedbackMailbox.jsx', () => ({ default: () => null }));
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
    expect(html).toContain('CHRONICLES OF MATTHIAS · FOLIO DE PAUSA');
    expect(html).toContain('chronicles-game-menu__heading-legend');
    expect(html).toContain('✉ Feedback');
    expect(html).toContain('aria-label="Buzón de feedback"');
    expect(html).toContain('chronicles-game-menu__action-pair');
    expect(html).toContain('chronicles-game-menu__utility-row');
    expect(html).toContain('aria-controls="chronicles-menu-sound"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('id="chronicles-menu-sound"');
    expect(html).toContain('hidden=""');
    expect(html).toContain('aria-hidden="true"');
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

  it('exposes the feedback mailbox without hijacking game keyboard shortcuts', () => {
    const html = renderToStaticMarkup(<ChroniclesAdventureMenu {...handlers} />);
    expect(html).toContain('data-chronicles-menu-feedback');
    expect(html).toContain('Buzón de feedback');
    expect(html).toContain('data-feedback-open="false"');
    expect(html).toContain('S · guardar · Q · salir');
    const exitPrompt = renderToStaticMarkup(<ChroniclesAdventureMenu {...handlers}
      confirmExitWithoutSaving />);
    expect(exitPrompt).not.toContain('data-chronicles-menu-feedback');
  });

  it('shows nested feedback without exposing parent actions or shortcut hints', () => {
    const html = renderToStaticMarkup(<ChroniclesAdventureMenu {...handlers}
      feedbackOpen onFeedbackOpenChange={() => {}} />);
    expect(html).toContain('data-feedback-open="true"');
    expect(html).toContain('MENSAJERÍA');
    expect(html).toContain('ESC · volver al menú · TAB · navegar');
    expect(html).not.toContain('Guardar partida · S');
    expect(html).not.toContain('Salir sin guardar · Q');
    expect(html).not.toContain('data-chronicles-menu-feedback');
    expect(html).toContain('aria-hidden="true"');
  });

  it('does not advertise a second save action while save is pending', () => {
    const html = renderToStaticMarkup(<ChroniclesAdventureMenu {...handlers} saveBusy />);
    expect(html).toContain('Guardando…');
    expect(html).not.toContain('Guardar partida · S');
    expect(html).toContain('disabled');
  });
});
