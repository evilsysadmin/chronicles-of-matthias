import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./ChroniclesAudioControls.jsx', () => ({ default: () => null }));
vi.mock('./ChroniclesFeedbackMailbox.jsx', () => ({ default: () => null }));
import ChroniclesAdventureMenu from './ChroniclesAdventureMenu.jsx';

describe('Chronicles adventure menu hotkey affordances', () => {
  const handlers = {
    onClose: () => {}, onContinue: () => {}, onJournal: () => {},
    onQuickStatus: () => {}, onCampRest: () => {}, onSave: () => {}, onSaveExit: () => {},
    onRequestLoad: () => {}, onSaveBeforeLoad: () => {}, onLoadWithoutSave: () => {}, onCancelLoad: () => {},
    onAdmin: () => {}, onRequestExit: () => {},
    onDiscardExit: () => {}, onCancelExit: () => {},
  };

  it('shows the same S/Q labels as the shortcuts routed to the real handlers', () => {
    const html = renderToStaticMarkup(<ChroniclesAdventureMenu {...handlers} />);
    expect(html).toContain('Guardar partida · S');
    expect(html).toContain('data-confirming-exit="false"');
    expect(html).toContain('S · guardar · Q · salir · TAB en la gema · cerrar · TAB en controles · navegar');
    expect(html).toContain('Salir sin guardar · Q');
    expect(html).toContain('S · guardar · Q · salir');
    expect(html).toContain('Guardar y salir');
    expect(html).toContain('Cargar partida');
    expect(html).toContain('data-chronicles-menu-load');
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


  it('shows the actual ration cost and disables unsafe field rest without hiding the reason', () => {
    const ready = renderToStaticMarkup(<ChroniclesAdventureMenu {...handlers}
      campRestStatus={{ canRest: true, rationsNeeded: 3, reason: '' }} />);
    expect(ready).toMatch(/data-chronicles-menu-camp-rest[^>]*>☾ Descansar en campo · 3 raciones<\/button>/);
    expect(ready).not.toMatch(/data-chronicles-menu-camp-rest[^>]*disabled/);
    const unsafe = renderToStaticMarkup(<ChroniclesAdventureMenu {...handlers}
      campRestStatus={{ canRest: false, rationsNeeded: 4, reason: 'Hay enemigos demasiado cerca.' }} />);
    expect(unsafe).toMatch(/data-chronicles-menu-camp-rest[^>]*disabled=""/);
    expect(unsafe).toContain('Hay enemigos demasiado cerca.');
  });

  it('shows admin tools only after server verification and permits an explicit retry after a timeout', () => {
    const admin = renderToStaticMarkup(<ChroniclesAdventureMenu {...handlers}
      isAdmin adminStatus="verified" />);
    expect(admin).toContain('data-chronicles-menu-admin');
    expect(admin).toContain('Modo admin');
    expect(admin).not.toContain('data-chronicles-menu-admin-retry');
    const unknown = renderToStaticMarkup(<ChroniclesAdventureMenu {...handlers}
      adminStatus="unavailable" onRetryAdmin={() => {}} />);
    expect(unknown).not.toContain('data-chronicles-menu-admin>');
    expect(unknown).toContain('data-chronicles-menu-admin-retry');
    expect(unknown).toContain('Reintentar verificación de permisos');
    const denied = renderToStaticMarkup(<ChroniclesAdventureMenu {...handlers} adminStatus="denied" />);
    expect(denied).not.toContain('data-chronicles-menu-admin');
    const checking = renderToStaticMarkup(<ChroniclesAdventureMenu {...handlers} adminStatus="checking" />);
    expect(checking).not.toContain('data-chronicles-menu-admin');
  });

  it('explains combat restrictions and disables all save actions, not loading or exiting without saving', () => {
    const html = renderToStaticMarkup(<ChroniclesAdventureMenu {...handlers} inCombat />);
    expect(html).toContain('data-chronicles-combat-save-notice');
    expect(html).toContain('No puedes guardar durante el combate.');
    expect(html).toMatch(/data-chronicles-menu-save[^>]*disabled=""/);
    expect(html).toMatch(/class="chronicles-game-menu__save-exit"[^>]*disabled=""/);
    expect(html).toMatch(/data-chronicles-menu-load[^>]*>Cargar partida<\/button>/);
    expect(html).toContain('Salir sin guardar · Q');
    expect(html).toContain('Guardado desactivado en combate');
    expect(html).not.toContain('S · guardar · Q · salir');
    expect(html).not.toContain('Partida guardada correctamente.');
  });

  it('leaves the save-before-switch choice disabled in combat while allowing discard or cancel', () => {
    const html = renderToStaticMarkup(<ChroniclesAdventureMenu {...handlers}
      inCombat confirmLoadSelection />);
    expect(html).toContain('solo puedes elegir otra partida sin guardar');
    expect(html).toMatch(/disabled=""[^>]*>Guardar esta partida y elegir otra<\/button>/);
    expect(html).not.toMatch(/disabled=""[^>]*>Elegir sin guardar<\/button>/);
    expect(html).toContain('Guardar esta partida y elegir otra');
    expect(html).toContain('Elegir sin guardar');
    expect(html).toContain('Cancelar');
  });

  it('requires a choice about unsaved progress before opening saved expeditions', () => {
    const markup = renderToStaticMarkup(<ChroniclesAdventureMenu {...handlers} confirmLoadSelection />);
    expect(markup).toContain('data-confirming-load="true"');
    expect(markup).toContain('Confirmar cambio de partida');
    expect(markup).toContain('Guardar esta partida y elegir otra');
    expect(markup).toContain('Elegir sin guardar');
    expect(markup).toContain('Cancelar');
    expect(markup).toContain('ESC · cancelar cambio de partida');
    expect(markup).not.toContain('data-chronicles-menu-load');
    expect(markup).not.toContain('Guardar partida · S');
    expect(markup).not.toContain('>Continuar<');
    expect(markup).toContain('hidden=""');
  });

  it('blocks choosing another run while a save is already in progress', () => {
    const markup = renderToStaticMarkup(<ChroniclesAdventureMenu {...handlers}
      confirmLoadSelection saveBusy />);
    expect(markup).toContain('Confirmar cambio de partida');
    expect(markup).toContain('Elegir sin guardar');
    expect(markup).toMatch(/disabled=""/);
  });

  it('offers a dedicated help entry without crowding the default action list', () => {
    const html = renderToStaticMarkup(<ChroniclesAdventureMenu {...handlers} />);
    expect(html).toContain('data-chronicles-menu-help');
    expect(html).toContain('aria-controls="chronicles-game-help"');
    expect(html).toContain('? Ayuda');
    expect(html).toContain('data-help-open="false"');
    expect(html).not.toContain('data-chronicles-game-help');
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
  it('renders the approved MM3 control-board grouping without losing guarded actions', () => {
    const html = renderToStaticMarkup(<ChroniclesAdventureMenu {...handlers}
      isAdmin campRestStatus={{ canRest: false, rationsNeeded: 4, reason: 'Enemigos cerca' }} />);
    expect(html).toContain('data-chronicles-menu-primary');
    expect(html).toMatch(/chronicles-game-menu__primary-row[^>]*>[\\s\\S]*?Continuar[\\s\\S]*?Descansar en campo · 4 raciones[\\s\\S]*?<\\/div>/);
    expect(html).toMatch(/chronicles-game-menu__utility-row[^>]*>[\\s\\S]*?Sonido[\\s\\S]*?Ayuda[\\s\\S]*?Feedback[\\s\\S]*?Modo admin[\\s\\S]*?Salir sin guardar · Q[\\s\\S]*?<\\/div>/);
    expect(html).toMatch(/data-chronicles-menu-camp-rest[^>]*disabled/);
    expect(html).toContain('data-chronicles-menu-save');
    expect(html).toContain('data-chronicles-menu-load');
    expect(html).toContain('chronicles-game-menu__save-exit');
  });


});
