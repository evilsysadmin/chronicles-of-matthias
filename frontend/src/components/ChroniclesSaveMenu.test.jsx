import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ChroniclesSaveMenu from './ChroniclesSaveMenu.jsx';

function menu(saves, props = {}) {
  return renderToStaticMarkup(
    <ChroniclesSaveMenu
      saves={saves}
      onNew={vi.fn()}
      onLoad={vi.fn()}
      onRename={vi.fn()}
      onForget={vi.fn()}
      onExit={vi.fn()}
      {...props}
    />,
  );
}

describe('Chronicles expedition entry', () => {

  it('links to Tactics from the expedition home without changing MM3 save actions', () => {
    const saved = [{ id: 'one', active: true, title: 'La torre' }];
    const html = menu(saved);
    expect(html).toContain('data-chronicles-tactics-entry="true"');
    expect(html).toContain('href="#tactics"');
    expect(html).toContain('Combate táctico por casillas');
    expect(html.indexOf('Continuar expedición')).toBeLessThan(html.indexOf('data-chronicles-tactics-entry'));
    expect(html).toContain('data-chronicles-primary-action="continue"');
    expect(menu([], { initialScreen: 'load' })).not.toContain('data-chronicles-tactics-entry');
  });

  it('keeps Tactics reachable while the MM3 save catalog is unavailable', () => {
    for (const props of [{ loading: true }, { error: 'Error de sincronización' }, { busyRunId: 'one' }]) {
      const html = menu([], props);
      expect(html).toContain('data-chronicles-tactics-entry="true"');
      const entry = html.match(/<a class="chronicles-save-menu__tactics-link"[^>]*>/)?.[0];
      expect(entry).toContain('href="#tactics"');
      expect(entry).not.toContain('disabled');
    }
  });
  it('prioritizes a first expedition without creating a run on mount', () => {
    const onNew = vi.fn();
    const html = menu([], { onNew });
    expect(html).toContain('data-chronicles-primary-action="new"');
    expect(html).toContain('Nueva expedición');
    expect(html).not.toContain('Continuar expedición');
    expect(html).not.toContain('Elegir otra expedición');
    expect(html).toContain('<summary>Otras opciones</summary>');
    expect(html).not.toContain('Otra aventura');
    expect(html).toContain('¿Tu primera expedición?');
    expect(html).toContain('Elige un grupo preparado o crea cuatro aventureros.');
    expect(html).toContain('data-testid="chronicles-home-first-steps"');
    expect(html).toContain('Gestionar partidas');
    expect(html).toContain('Volver al castillo');
    expect(onNew).not.toHaveBeenCalled();
  });

  it('prioritizes a real saved run and offers choosing another only when needed', () => {
    const saved = [{ id: 'one', active: true, title: 'La torre', currentMapId: 'swordhaven-square' }];
    const html = menu(saved);
    expect(html).toContain('data-chronicles-primary-action="continue"');
    expect(html.indexOf('Continuar expedición')).toBeLessThan(html.indexOf('Nueva expedición'));
    expect(html).toContain('La torre');
    expect(html).toContain('Tu compañía tiene una historia pendiente.');
    expect(html).not.toContain('data-testid="chronicles-home-first-steps"');
    expect(html).not.toContain('Elegir otra expedición');
    expect(menu([...saved, { id: 'two', title: 'La cripta' }])).toContain('Elegir otra expedición');
  });

  it.each([
    { loading: true, error: '' },
    { loading: false, error: 'Sesión caducada' },
  ])('disables start and cached resume while server catalog is unresolved: %j', (props) => {
    for (const saves of [[], [{ id: 'cached', active: true, title: 'Caché local' }]]) {
      const html = menu(saves, props);
      const primary = html.match(/<button[^>]*class="is-primary[^"]*"[^>]*>/)?.[0];
      expect(primary).toContain('disabled=""');
      if (saves.length) expect(html).toContain('Caché local');
      expect(html).toContain('Otras opciones');
      expect(html).not.toContain('data-testid="chronicles-home-first-steps"');
    }
  });

  it('shows an explicit retry only for failed catalog sync, disabled while busy', () => {
    const error = 'No se pudo consultar el servidor.';
    const html = menu([], { error, onRetrySync: vi.fn() });
    expect(html).toContain(error);
    expect(html).toContain('Reintentar sincronización');
    expect(html).toContain('role="alert"');
    expect(menu([])).not.toContain('Reintentar sincronización');

    const busyHtml = menu([], { error, busyRunId: 'run-1', onRetrySync: vi.fn() });
    expect(busyHtml).toMatch(/disabled=""[^>]*>Reintentar sincronización<\/button>/);
  });

  it('shows the selected server run identity without putting checkpoint state in HTML', () => {
    const html = menu([{
      id: 'run-123', active: true, title: 'Swordhaven y compañía',
      currentMapId: 'swordhaven-square', createdAt: 1, updatedAt: 1_760_000_000_000,
    }]);
    expect(html).toContain('Swordhaven y compañía');
    expect(html).toContain('Swordhaven');
    expect(html).not.toContain('worldFlags');
    expect(html).not.toContain('claimedRewards');
  });
});
