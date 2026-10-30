import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ChroniclesCharacterSheetFolioV2.css';
import './ChroniclesCharacterSheetArchive.css';
import './ChroniclesCharacterEquipmentMM3.css';
import './ChroniclesCharacterDeskCompact.css';
import './ChroniclesCharacterEquipmentDensity.css';
import './ChroniclesCharacterRetroMM3.css';
import './ChroniclesCharacterInventoryRetro.css';
import './ChroniclesCharacterTrainingRetro.css';
import './ChroniclesCharacterRecordV3.css';
import './ChroniclesCharacterEquipmentDisclosure.css';
import './ChroniclesCharacterInventoryClassic.css';
import './ChroniclesCharacterFolioStone.css';
import './ChroniclesCharacterMobileEquipment.css';
import './ChroniclesCharacterEquipmentWorkspace.css';
import ChroniclesCharacterGrimoire from './ChroniclesCharacterGrimoire.jsx';
import ChroniclesInventoryItemIcon from './ChroniclesInventoryItemIcon.jsx';
import {
  CHRONICLES_GOLD_ITEM_ID,
  chroniclesGoldBalance,
  chroniclesInventoryEntries,
} from '../chronicles/chroniclesContentRuntime.js';
import {
  CHRONICLES_ATTRIBUTE_CAP,
  CHRONICLES_ATTRIBUTE_DEFINITIONS,
  chroniclesAllowedAttributes,
  chroniclesHeroProgress,
  chroniclesSkillsForMember,
  chroniclesXpThresholdForLevel,
  chroniclesXpToNextLevel,
} from '../chroniclesOfMatthiasProgression.js';
import { chroniclesPartyRelic } from '../chroniclesOfMatthiasRelics.js';
import {
  CHRONICLES_EQUIPMENT,
  CHRONICLES_EQUIPMENT_SLOTS,
  chroniclesEquippedItem,
  chroniclesEquipmentBonuses,
  chroniclesMemberCanEquip,
} from '../chronicles/chroniclesEquipment.js';
import { chroniclesPartyArmorClass, chroniclesPartyAttackStats } from '../chroniclesOfMatthias.js';
import { chroniclesArmsLabel, chroniclesWornGear } from '../chronicles/chroniclesWornGear.js';
import { chroniclesPartyInitiativeAgility } from '../chronicles/chroniclesInitiative.js';
import {
  CHRONICLES_MM3_STATS,
  CHRONICLES_MM3_STAT_EFFECTS,
  CHRONICLES_MM3_STAT_LABELS,
} from '../chronicles/chroniclesMM3Rules.js';
import { chroniclesTacticsEffectiveProfile } from '../chroniclesOfMatthiasTactics.js';
import { chroniclesPartyPortraitUrl } from '../chronicles/chroniclesPartyPortraitAssets.js';
import { chroniclesInventoryShortcut, chroniclesPartyHotkeyMember, chroniclesPartyHotkeySlots } from '../chronicles/chroniclesKeyboardBindings.js';
import { chroniclesGearAttackModes, chroniclesGearSwapPreview } from '../chronicles/chroniclesGearCompare.js';
import { chroniclesShopHandlingNote } from '../chronicles/chroniclesShopHandlingNote.js';
import { chroniclesBagInventoryEntries } from '../chronicles/chroniclesPersonalBags.js';
import { chroniclesBackpackMoveSelection } from '../chronicles/chroniclesBackpackFilters.js';
import {
  CHRONICLES_SPELL_SCHOOLS,
  chroniclesMemberMaxSp,
  chroniclesMemberSchool,
  chroniclesMemberSp,
  chroniclesMemberSpells,
} from '../chronicles/chroniclesMagic.js';

const RELIC_LABELS = Object.freeze({
  'spectral-lantern': Object.freeze({
    name: 'Farol espectral',
    description: 'Reliquia recuperada por Aziz. Su luz sigue ligada al alfil.',
  }),
});

function signed(value) {
  const numeric = Number(value) || 0;
  return numeric > 0 ? `+${numeric}` : String(numeric);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function xpProgress(progress, xpWindow) {
  if (xpWindow.maxLevel) return { ratio: 1, label: `Nivel ${progress.level} · MAX · ${progress.xp} XP` };
  const floor = chroniclesXpThresholdForLevel(progress.level);
  const span = Math.max(1, xpWindow.next - floor);
  const earned = Math.max(0, progress.xp - floor);
  return {
    ratio: clamp01(earned / span),
    label: `Nivel ${progress.level} · ${progress.xp}/${xpWindow.next} XP`,
  };
}

function resourceStatus(state, memberId) {
  const max = Math.max(1, Number(state?.rpgModifiers?.[memberId]?.abilityCharges || 1));
  const charges = Math.max(0, Number(state?.classAbilityCharges?.[memberId] ?? max));
  return { max, charges, ratio: clamp01(charges / max) };
}

function relicDetails(state, memberId) {
  const relicId = chroniclesPartyRelic(state, memberId);
  if (!relicId) return null;
  return {
    id: relicId,
    ...(RELIC_LABELS[relicId] || {
      name: relicId,
      description: 'Reliquia vinculada a este miembro de la compañía.',
    }),
  };
}

export default function ChroniclesCharacterSheet({
  state,
  progression,
  member,
  mode = 'tactics',
  initialFolio = 'record',
  onClose,
  onAllocateAttribute = null,
  onLearnSkill = null,
  onEquipmentAction = null,
  onSelectMember = null,
}) {
  // Navigation belongs to the sheet, not the durable campaign state.
  const [activeFolio, setActiveFolio] = useState(() => initialFolio === 'equipment' ? 'equipment' : 'record');
  // Selection is deliberately explicit and belongs to one hero's bag.
  // The first item can still be previewed without becoming a transfer target.
  const [selectedBagItem, setSelectedBagItem] = useState(null);
  const [selectedWornSlot, setSelectedWornSlot] = useState(null);
  const [inspectItem, setInspectItem] = useState(false);
  const [showEquipmentDetails, setShowEquipmentDetails] = useState(false);
  const [pendingDrop, setPendingDrop] = useState(null);
  const dropCancelRef = useRef(null);
  const inventoryListRef = useRef(null);
  const folioScrollRef = useRef(null);
  const previousViewedMemberIdRef = useRef(member?.id);

  // The modal stays mounted when the player switches heroes. Without this,
  // the next hero can inherit the previous hero's mid-page scroll position.
  // Keep the chosen folio; only its viewport should start afresh on desktop.
  useLayoutEffect(() => {
    const nextId = member?.id;
    if (previousViewedMemberIdRef.current === nextId) return;
    previousViewedMemberIdRef.current = nextId;
    setSelectedBagItem(null);
    setSelectedWornSlot(null);
    setInspectItem(false);
    setShowEquipmentDetails(false);
    setPendingDrop(null);

    if (!nextId || mode === 'tactics' || typeof window === 'undefined'
      || !window.matchMedia?.('(min-width: 851px) and (min-height: 581px)').matches) return;
    if (folioScrollRef.current) folioScrollRef.current.scrollTop = 0;
    if (inventoryListRef.current) inventoryListRef.current.scrollTop = 0;
  }, [member?.id, mode]);

  if (!state || !progression || !member) return null;

  const profile = chroniclesTacticsEffectiveProfile(state, member.id);
  const tacticsMode = mode === 'tactics';
  const progress = chroniclesHeroProgress(progression, member.id);
  const xpWindow = chroniclesXpToNextLevel(progression, member.id);
  const xp = xpProgress(progress, xpWindow);
  const ability = resourceStatus(state, member.id);
  const attributes = chroniclesAllowedAttributes(member.id);
  // Old Tactics doctrine choices that only increase attack-square reach
  // have no effect in first-person MM3. Do not sell the player a dead perk.
  // Leave the definitions/learned IDs intact for Tactics and old saves.
  const skills = chroniclesSkillsForMember(member.id)
    .filter((skill) => state.combatRules !== 'mm3' || !Number(skill.modifiers?.reachBonus));
  const modifiers = state.rpgModifiers?.[member.id] || {};
  const firstPersonStats = chroniclesPartyAttackStats(state, member.id);
  const equippedWeapon = chroniclesEquippedItem(state, member.id, 'weapon');
  const reach = tacticsMode
    ? Number(profile.reach || 1) + Number(modifiers.reachBonus || 0)
    : firstPersonStats.reach;
  const damage = tacticsMode
    ? Number(profile.damage || 1) + Number(modifiers.attackDamageBonus || 0)
    : firstPersonStats.damage;
  const effectiveAgility = chroniclesPartyInitiativeAgility(state, member);
  const mm3 = !tacticsMode && member.mm3 ? member.mm3 : null;
  const className = mm3?.classLabel || profile.className;
  const spellcastingCompanion = !tacticsMode && onSelectMember
    ? state.party?.find((companion) => companion.id !== member.id && chroniclesMemberSchool(companion))
    : null;
  const relic = relicDetails(state, member.id);
  const inventory = (tacticsMode
    ? chroniclesInventoryEntries(state)
    : chroniclesBagInventoryEntries(state, member.id))
    .filter((item) => item.id !== CHRONICLES_GOLD_ITEM_ID);
  const wornGearItems = tacticsMode ? [] : chroniclesWornGear(state, member.id).filter((slot) => !slot.empty);
  const selectedItemId = selectedBagItem?.memberId === member.id ? selectedBagItem.itemId : null;
  const gold = chroniclesGoldBalance(state);
  // Show every genuine possession. There are no invisible filters that can
  // hide items after changing a hero, equipping, or handing an item off.
  const visibleBackpack = inventory;
  // The first visible item is a safe preview; selection never equips it.
  const transferableItem = !tacticsMode && visibleBackpack.find((item) => item.id === selectedItemId);
  const selectedInventoryItem = transferableItem || (!tacticsMode ? visibleBackpack[0] : null);
  const selectedEquipment = selectedInventoryItem && CHRONICLES_EQUIPMENT[selectedInventoryItem.id];
  const currentlyEquipped = selectedEquipment ? chroniclesEquippedItem(state, member.id, selectedEquipment.slot) : null;
  const canEquipSelected = selectedEquipment && chroniclesMemberCanEquip(member, selectedEquipment);
  const weaponModes = !tacticsMode ? chroniclesGearAttackModes(state, member.id) : null;
  const weaponSwap = selectedEquipment && mm3
    ? chroniclesGearSwapPreview(state, member.id, selectedEquipment.id)
    : null;
  const gearBonus = chroniclesEquipmentBonuses(state, member.id);
  // Include genuine equipped items in the MM3 item ledger; a full equipment
  // loadout must never look like an empty inventory just because the bag is empty.
  const selectedWornItem = wornGearItems.find((slot) => slot.slot === selectedWornSlot) || null;
  const detailItem = selectedWornItem ? { ...selectedWornItem.item, quantity: 1 } : selectedInventoryItem;
  const detailEquipment = selectedWornItem ? CHRONICLES_EQUIPMENT[selectedWornItem.item.id] : selectedEquipment;
  const detailCanEquip = selectedWornItem ? true : canEquipSelected;
  const detailEquipped = detailEquipment ? chroniclesEquippedItem(state, member.id, detailEquipment.slot) : null;
  const visibleWornGear = wornGearItems;
  // One display ledger. Equipped identities stay out of bag stock/persistence.
  const visibleLedger = [
    ...visibleWornGear.map((slot) => ({ id: `worn:${slot.slot}`, slot })),
    ...visibleBackpack.map((item) => ({ id: `bag:${item.id}`, item })),
  ];
  const selectedLedgerId = selectedWornItem ? `worn:${selectedWornItem.slot}`
    : selectedItemId ? `bag:${selectedItemId}` : null;
  const selectLedgerEntry = (id) => {
    if (id?.startsWith('worn:')) {
      setSelectedWornSlot(id.slice(5));
      setSelectedBagItem(null);
    } else if (id?.startsWith('bag:')) {
      setSelectedBagItem({ memberId: member.id, itemId: id.slice(4) });
      setSelectedWornSlot(null);
    }
    setInspectItem(false);
    setPendingDrop(null);
  };
  const canChangeEquipment = !tacticsMode && state.phase === 'explore' && !state.initiative
    && member.hp > 0 && typeof onEquipmentAction === 'function';

  // A selected item, worn or loose, can be given with a party number or
  // portrait. Without selection, those same controls navigate the dossier.
  const transferSelection = selectedWornItem
    ? { name: selectedWornItem.name, slot: selectedWornItem.slot }
    : transferableItem ? { name: transferableItem.name, itemId: transferableItem.id } : null;
  const viewMember = (targetId) => {
    setSelectedWornSlot(null);
    setSelectedBagItem(null);
    setInspectItem(false);
    setShowEquipmentDetails(false);
    setPendingDrop(null);
    // The next hero always opens at the beginning of the dossier, including
    // short landscape: do not strand their inventory behind the party dock.
    if (targetId !== member.id && folioScrollRef.current) folioScrollRef.current.scrollTop = 0;
    onSelectMember?.(targetId);
  };
  const giveSelectedItemTo = (targetId) => {
    if (!transferSelection || !canChangeEquipment || targetId === member.id) return;
    if (transferSelection.slot) {
      onEquipmentAction?.({ type: 'transfer-equipped-item',
        slot: transferSelection.slot, toMemberId: targetId });
    } else {
      onEquipmentAction?.({ type: 'transfer-item',
        itemId: transferSelection.itemId, toMemberId: targetId });
    }
    setSelectedBagItem(null);
    setSelectedWornSlot(null);
    setInspectItem(false);
    setPendingDrop(null);
  };
  const directTransferMode = !tacticsMode && activeFolio === 'equipment'
    && Boolean(transferSelection) && canChangeEquipment;
  const handlePartyKey = (event) => {
    const hero = chroniclesPartyHotkeyMember(event, state.party);
    if (!hero) return false;
    if (directTransferMode) {
      event.preventDefault();
      event.stopPropagation();
      if (hero.id !== member.id) giveSelectedItemTo(hero.id);
      return true;
    }
    if (!onSelectMember) return false;
    event.preventDefault();
    event.stopPropagation();
    viewMember(hero.id);
    return true;
  };
  useEffect(() => {
    if (!state?.party || !member) return undefined;
    const onWindowKey = (event) => {
      const command = chroniclesInventoryShortcut(event, {
        open: !tacticsMode && activeFolio === 'equipment', confirmingDrop: Boolean(pendingDrop),
      });
      if (command) {
        event.preventDefault();
        event.stopPropagation();
        if (command === 'e' && canChangeEquipment && transferableItem && selectedEquipment && canEquipSelected) {
          onEquipmentAction?.({ type: 'equip-item', itemId: selectedEquipment.id });
          setSelectedBagItem(null);
          setInspectItem(false);
        }
        if (command === 'u' && canChangeEquipment && selectedWornItem) {
          onEquipmentAction?.({ type: 'unequip-item', slot: selectedWornItem.slot });
          setSelectedWornSlot(null);
          setInspectItem(false);
        }
        if (command === 'd' && canChangeEquipment && transferableItem) {
          setPendingDrop({ memberId: member.id, itemId: transferableItem.id, name: transferableItem.name });
        }
        if (command === 'i' && (selectedWornItem || selectedInventoryItem)) setInspectItem((shown) => !shown);
        if (command === 't' && canChangeEquipment) {
          if (!transferSelection) {
            if (selectedInventoryItem) setSelectedBagItem({ memberId: member.id, itemId: selectedInventoryItem.id });
            else if (visibleWornGear[0]) setSelectedWornSlot(visibleWornGear[0].slot);
          }
          const recipient = Array.from(document.querySelectorAll(
            '.chronicles-character-sheet__party-dock button:not(:disabled)'
          )).find((button) => button.getAttribute('aria-pressed') !== 'true');
          recipient?.focus();
        }
        return;
      }
      if (!pendingDrop) handlePartyKey(event);
    };
    window.addEventListener('keydown', onWindowKey);
    return () => window.removeEventListener('keydown', onWindowKey);
  }, [state, member, onSelectMember, onEquipmentAction, activeFolio, selectedBagItem,
    selectedWornSlot, pendingDrop, inspectItem, canChangeEquipment, transferSelection?.itemId]);
  useEffect(() => {
    if (pendingDrop) dropCancelRef.current?.focus();
  }, [pendingDrop]);

  // Selection never equips or transfers: the player explicitly chooses a command.
  const browseBackpack = (step) => {
    // Share the same wraparound semantics with keyboard navigation. A preview
    // alone is not a selected item: Down starts at the first, Up at the last.
    const nextId = chroniclesBackpackMoveSelection(
      visibleLedger, selectedLedgerId, step < 0 ? 'ArrowUp' : 'ArrowDown'
    );
    if (!nextId) return;
    selectLedgerEntry(nextId);
    const index = visibleLedger.findIndex((entry) => entry.id === nextId);
    inventoryListRef.current?.querySelectorAll('[data-ledger-id]')?.[index]?.focus();
  };

  // A purely visual continuation cue: the party dock is fixed while the
  // dossier scrolls underneath it. Show the cue only when more content exists
  // below the current position, and remove it at the actual end of the page.
  useEffect(() => {
    if (tacticsMode) return undefined;
    const scroller = folioScrollRef.current;
    if (!scroller) return undefined;
    const update = () => {
      scroller.dataset.moreBelow = String(
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight > 12
      );
    };
    scroller.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    observer?.observe(scroller);
    const content = scroller.querySelector('.chronicles-character-sheet__folio-layout');
    if (content) observer?.observe(content);
    const frame = window.requestAnimationFrame?.(update);
    update();
    return () => {
      scroller.removeEventListener('scroll', update);
      observer?.disconnect();
      if (frame != null) window.cancelAnimationFrame?.(frame);
      delete scroller.dataset.moreBelow;
    };
  }, [tacticsMode, activeFolio, member?.id, selectedInventoryItem?.id, visibleBackpack.length]);

  const selectFolio = (folio) => {
    setActiveFolio(folio);
    if (folio !== activeFolio) {
      setSelectedWornSlot(null);
      setSelectedBagItem(null);
      setInspectItem(false);
      setShowEquipmentDetails(false);
      setPendingDrop(null);
    }
    // Always begin the newly selected MM3 page at its top. On phones the
    // previously preserved scroll was hiding the header, inventory and actions
    // underneath the fixed hero dock when returning from another chapter.
    if (!tacticsMode && folio !== activeFolio && folioScrollRef.current) {
      folioScrollRef.current.scrollTop = 0;
    }
  };

  const closeOnEscape = (event) => {
    if (pendingDrop && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setPendingDrop(null);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose?.();
      return;
    }
    handlePartyKey(event);
  };

  // One real inventory subtree; only its reading order changes by mode.
  // Tactics retains its original relic-first layout and keyboard order.
  const backpackPanel = (
            <article className="chronicles-character-sheet__backpack">
              <span className="chronicles-character-sheet__backpack-heading">
                {tacticsMode ? 'Mochila de expedición' : `Objetos de ${member.name}`}
              </span>
              {visibleLedger.length ? (
                  <div className="chronicles-character-sheet__inventory" ref={inventoryListRef}
                    role="group" aria-label={`Pertenencias de ${member.name}: equipadas y en mochila`}>
                    {!tacticsMode && visibleWornGear.map((slot) => (
                      <button type="button" key={`worn:${slot.slot}`} data-ledger-id={`worn:${slot.slot}`}
                        data-worn-slot={slot.slot} title={`${slot.name} · ${slot.label} · Equipado`}
                        className={`chronicles-character-sheet__worn-item${selectedWornItem?.slot === slot.slot ? ' is-selected' : ''}`}
                        aria-pressed={selectedWornItem?.slot === slot.slot}
                        aria-label={`Seleccionar ${slot.name}, equipado en ${slot.label}`}
                        onClick={() => {
                          if (selectedWornItem?.slot === slot.slot) setSelectedWornSlot(null);
                          else selectLedgerEntry(`worn:${slot.slot}`);
                        }}
                        onKeyDown={(event) => {
                          const next = chroniclesBackpackMoveSelection(visibleLedger, `worn:${slot.slot}`, event.key);
                          if (!next) return;
                          event.preventDefault();
                          event.stopPropagation();
                          selectLedgerEntry(next);
                          const index = visibleLedger.findIndex((entry) => entry.id === next);
                          inventoryListRef.current?.querySelectorAll('[data-ledger-id]')?.[index]?.focus();
                        }}>
                        <i className="chronicles-character-sheet__inventory-glyph" aria-hidden="true">
                          <ChroniclesInventoryItemIcon item={slot.item} />
                        </i>
                        <span>{slot.name}</span>
                        <small className="chronicles-character-sheet__equipped-marker">Puesto · {slot.label}</small>
                      </button>
                    ))}
                    {visibleBackpack.map((item) => (
                      <button type="button" key={item.id} data-ledger-id={`bag:${item.id}`} data-inventory-item={item.id}
                        title={!tacticsMode ? item.name : undefined}
                        className={selectedItemId === item.id ? 'is-selected' : ''}
                        aria-pressed={selectedItemId === item.id}
                        onClick={() => {
                          setSelectedBagItem(selectedItemId === item.id
                            ? null : { memberId: member.id, itemId: item.id });
                          setSelectedWornSlot(null);
                          setInspectItem(false);
                      
                        }}
                        onKeyDown={(event) => {
                          if (tacticsMode) return;
                          const nextId = chroniclesBackpackMoveSelection(visibleLedger, `bag:${item.id}`, event.key);
                          if (!nextId) return;
                          event.preventDefault();
                          event.stopPropagation();
                          selectLedgerEntry(nextId);
                          const index = visibleLedger.findIndex((entry) => entry.id === nextId);
                          inventoryListRef.current?.querySelectorAll('[data-ledger-id]')?.[index]?.focus();
                        }}
                      >
                        {!tacticsMode && <i className="chronicles-character-sheet__inventory-glyph" aria-hidden="true">
                          <ChroniclesInventoryItemIcon item={item} />
                        </i>}
                        <span>{item.name}</span>
                        {item.quantity > 1 && <small>×{item.quantity}</small>}
                      </button>
                    ))}
                  </div>
              ) : (
                <small>{tacticsMode ? 'Sin objetos recuperados en esta expedición.' : 'Este personaje no lleva pertenencias.'}</small>
              )}
              {selectedWornItem && !directTransferMode && (
                <small className="chronicles-character-sheet__worn-hint" role="status">
                  {selectedWornItem.name} seleccionado · T para entregar a 1–4, U para quitarlo, I para información.
                </small>
              )}
              {directTransferMode && (
                <small className="chronicles-character-sheet__transfer-hint" role="status">
                  {transferSelection.name} seleccionado · T y luego 1–4, o toca un retrato para entregar uno.
                  Vuelve a pulsar el objeto para cancelar.
                </small>
              )}
              {!tacticsMode && <small className="chronicles-character-sheet__shortcuts">E equipar · U quitar · T entregar · D tirar · I información</small>}
              {pendingDrop && !tacticsMode && (
                <div className="chronicles-character-sheet__drop-confirmation" role="group"
                  aria-label={`Confirmar eliminación de ${pendingDrop.name}`}>
                  <span>¿Eliminar 1 × {pendingDrop.name} de la mochila? No se podrá recuperar.</span>
                  <button type="button" onClick={() => {
                    if (canChangeEquipment && pendingDrop.memberId === member.id
                      && transferableItem?.id === pendingDrop.itemId) {
                      onEquipmentAction?.({ type: 'drop-item', itemId: pendingDrop.itemId });
                      setSelectedBagItem(null);
                      setInspectItem(false);
                    }
                    setPendingDrop(null);
                  }}>Sí, eliminar</button>
                  <button type="button" ref={dropCancelRef} onClick={() => setPendingDrop(null)}>Cancelar</button>
                </div>
              )}
              {!tacticsMode && (
                <nav className="chronicles-character-sheet__classic-actions" aria-label="Acciones de inventario">
                  <button type="button" disabled={!visibleLedger.length} onClick={() => browseBackpack(-1)}>
                    <span aria-hidden="true">↑</span> Arriba
                  </button>
                  <button type="button" disabled={!visibleLedger.length} onClick={() => browseBackpack(1)}>
                    <span aria-hidden="true">↓</span> Abajo
                  </button>
                  <button type="button"
                    disabled={!canChangeEquipment || (!selectedWornItem && (!transferableItem || !selectedEquipment || !canEquipSelected))}
                    aria-label={selectedWornItem ? `Quitar ${selectedWornItem.name} y guardarlo en la mochila`
                      : selectedEquipment ? `Equipar ${selectedEquipment.name}` : 'Equipar objeto'}
                    onClick={() => {
                      if (selectedWornItem) {
                        onEquipmentAction?.({ type: 'unequip-item', slot: selectedWornItem.slot });
                        setSelectedWornSlot(null);
                      } else if (transferableItem && selectedEquipment && canEquipSelected) {
                        onEquipmentAction?.({ type: 'equip-item', itemId: selectedEquipment.id });
                        setSelectedBagItem(null);
                      }
                    }}>
                    <span aria-hidden="true">⚔</span> {selectedWornItem ? 'Quitar' : 'Equipar'}
                  </button>
                  <button type="button" aria-expanded={showEquipmentDetails}
                    aria-controls="chronicles-equipment-technical-details"
                    onClick={() => setShowEquipmentDetails((shown) => !shown)}>
                    <span aria-hidden="true">▣</span> Detalles
                  </button>
                  <button type="button" disabled={!detailItem}
                    aria-expanded={inspectItem}
                    onClick={() => { setInspectItem((open) => !open);  }}>
                    <span aria-hidden="true">⌕</span> Examinar
                  </button>
                  <button type="button" onClick={onClose}>
                    <span aria-hidden="true">×</span> Salir
                  </button>
                </nav>
              )}
              {!tacticsMode && detailItem && (
                <aside className="chronicles-character-sheet__item-details" aria-live="polite" hidden={!inspectItem}>
                  <small className="chronicles-character-sheet__item-selection-state">{transferableItem ? 'Seleccionado · se puede entregar' : 'Vista previa · selecciónalo para entregarlo'}</small>
                  <strong>{detailItem.name}</strong>
                  <div className="chronicles-character-sheet__item-essentials">
                    <span>×{detailItem.quantity}</span>
                    {detailEquipment && <>
                      <span>{{ weapon: 'Arma A', missile: 'Proyectiles S', armor: 'Armadura', shield: 'Escudo' }[detailEquipment.slot]}</span>
                      <span className={detailCanEquip ? 'can-equip' : 'cannot-equip'}>
                        {detailCanEquip ? 'Puede equiparlo' : 'Clase incompatible'}
                      </span>
                    </>}
                  </div>
                  {!detailEquipment && (
                    <p>{detailItem.description || 'Objeto de expedición.'}</p>
                  )}
                  {detailEquipment && <>
                    {!selectedWornItem && weaponSwap ? (
                      <details className="chronicles-character-sheet__swap-preview" aria-label={`Comparación de arma ${weaponSwap.slot === 'missile' ? 'de proyectiles' : 'cuerpo a cuerpo'}`}>
                        <summary>
                          <span>Si equipas este objeto (${weaponSwap.slot === 'missile' ? 'S' : 'A'})</span>
                          <strong>Daño {signed(weaponSwap.delta.damage)} · Acierto {signed(weaponSwap.delta.toHit)}</strong>
                          {weaponSwap.displacedShieldName && <small>Se guardará {weaponSwap.displacedShieldName} en la mochila · CA {signed(weaponSwap.armorClassDelta)}.</small>}
                          <small>Ver comparación antes y después</small>
                        </summary>
                        <div><span>Daño</span><strong>{weaponSwap.before.damage} → {weaponSwap.after.damage}</strong><em>{signed(weaponSwap.delta.damage)}</em></div>
                        <div><span>Acierto</span><strong>{signed(weaponSwap.before.toHit)} → {signed(weaponSwap.after.toHit)}</strong><em>{signed(weaponSwap.delta.toHit)}</em></div>
                        <small>La otra arma no cambia. Comparación informativa: nada se equipa hasta confirmar.</small>
                      </details>
                    ) : !selectedWornItem && detailEquipped && <small>Diferencia respecto al equipo actual: daño {signed(detailEquipment.attackDamageBonus - detailEquipped.attackDamageBonus)}, acierto {signed(detailEquipment.toHitBonus - detailEquipped.toHitBonus)}, armadura {signed(detailEquipment.armorClassBonus - detailEquipped.armorClassBonus)}.</small>}

                  </>}
                  <details className="chronicles-character-sheet__item-more">
                    <summary>Descripción y atributos</summary>
                    {detailEquipment && <p>{detailEquipment.description || detailItem.description || 'Objeto de expedición.'}</p>}
                    {detailEquipment && chroniclesShopHandlingNote(detailEquipment, state?.combatRules) && (
                      <small className="chronicles-character-sheet__handling-note" data-chronicles-equipment-handling>
                        {chroniclesShopHandlingNote(detailEquipment, state?.combatRules)}
                      </small>
                    )}
                    <dl>
                      <div><dt>Cantidad</dt><dd>{detailItem.quantity}</dd></div>
                      {detailEquipment && <>
                        <div><dt>Tipo</dt><dd>{{ weapon: 'Arma · A', missile: 'Proyectiles · S', armor: 'Armadura', shield: 'Escudo' }[detailEquipment.slot]}</dd></div>
                        <div><dt>Daño adicional</dt><dd>{signed(detailEquipment.attackDamageBonus)}</dd></div>
                        <div><dt>Acierto</dt><dd>{signed(detailEquipment.toHitBonus)}</dd></div>
                        <div><dt>Armadura</dt><dd>{signed(detailEquipment.armorClassBonus)}</dd></div>
                        <div><dt>Valor</dt><dd>{detailEquipment.price} oro</dd></div>
                        <div><dt>Puede usarlo</dt><dd>{detailCanEquip ? 'Sí' : 'No, clase incompatible'}</dd></div>
                      </>}
                    </dl>
                    {detailEquipment && <small>Actualmente: {detailEquipped?.name || 'Sin equipar'}.</small>}
                  </details>
                  <button type="button" className="chronicles-character-sheet__drop-button"
                    disabled={!canChangeEquipment || !transferableItem || Boolean(selectedWornItem)}
                    onClick={() => setPendingDrop({
                      memberId: member.id, itemId: transferableItem.id, name: transferableItem.name,
                    })}>Tirar 1 objeto (D)</button>
                </aside>
              )}
            </article>
  );

  const sheet = (
    <div
      className="chronicles-character-sheet__backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        className={`chronicles-character-sheet${tacticsMode ? '' : ' chronicles-character-sheet--mm3 chronicles-character-sheet--folio-v2'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chronicles-character-sheet-title"
        data-chronicles-folio={tacticsMode ? undefined : 'v2'}
        onKeyDown={closeOnEscape}
      >
        {/* The frame (and its corner gems) stays put; only the contents scroll. */}
        <div className="chronicles-character-sheet__scroll" ref={folioScrollRef}>
        <header className="chronicles-character-sheet__head">
          {tacticsMode && <div className="chronicles-character-sheet__portrait">
            <img src={chroniclesPartyPortraitUrl(member)} alt={`Retrato de ${member.name}`} draggable="false" />
          </div>}
          <div className="chronicles-character-sheet__identity">
            {tacticsMode && <span>EXPEDIENTE DE CAMPAÑA</span>}
            <h3 id="chronicles-character-sheet-title">{member.name}</h3>
            <p>{className} · Nivel {progress.level}{mm3 ? '' : ` · ${profile.weaponName}`}</p>
            {!tacticsMode && (
              <div className="chronicles-character-sheet__quick" aria-label="Recursos actuales">
                <span data-resource="health">PV <b>{member.hp}/{member.maxHp}</b></span>
                {chroniclesMemberSchool(member) && (
                  <span data-resource="magic">PH <b>{chroniclesMemberSp(state, member)}/{chroniclesMemberMaxSp(state, member)}</b></span>
                )}
                <span data-resource="gold">ORO <b>{gold}</b></span>
              </div>
            )}
          </div>
          <button type="button" autoFocus onClick={onClose} aria-label="Cerrar ficha">×</button>
        </header>

        <div className="chronicles-character-sheet__progression">
          <div className="chronicles-character-sheet__xp-copy">
            {tacticsMode && <span>PROGRESIÓN</span>}
            <b>{tacticsMode ? xp.label : `${progress.xp}/${xpWindow.maxLevel ? 'MAX' : xpWindow.next} XP`}</b>
          </div>
          <div className="chronicles-character-sheet__xp-track" aria-label={xp.label}>
            <i style={{ width: `${xp.ratio * 100}%` }} />
          </div>
          <small>{xpWindow.maxLevel ? 'Veterano al máximo' : `${xpWindow.remaining} XP para el siguiente nivel`}</small>
        </div>

        <div className="chronicles-character-sheet__folio-layout">
        {!tacticsMode && (
          <nav className="chronicles-character-sheet__tabs" aria-label="Apartados de la ficha">
            {[
              { id: 'record', symbol: '◆', label: 'Estado' },
              { id: 'equipment', symbol: '⚔', label: 'Equipo' },
              { id: 'spells', symbol: '✧', label: 'Hechizos' },
              { id: 'training', symbol: '✦', label: 'Mejoras' },
            ].map((tab) => (
              <button type="button" key={tab.id}
                className={activeFolio === tab.id ? 'is-active' : ''}
                aria-pressed={activeFolio === tab.id}
                onClick={() => selectFolio(tab.id)}
              ><span aria-hidden="true">{tab.symbol}</span>{tab.label}</button>
            ))}
          </nav>
        )}

        <div className="chronicles-character-sheet__folio-content"
          data-chronicles-chapter={tacticsMode ? undefined : activeFolio}>
        <div className="chronicles-character-sheet__vitals"
          hidden={!tacticsMode && activeFolio !== 'record'}>
          <div><span>HP</span><b>{member.hp}/{member.maxHp}</b></div>
          {tacticsMode
            ? <div><span>RECURSO</span><b>{ability.charges}/{ability.max}</b></div>
            : <div><span>INICIATIVA</span><b>{effectiveAgility}</b></div>}
          <div><span>DAÑO</span><b>{damage}</b></div>
          {mm3 && <div><span>ACIERTO</span><b>{signed(firstPersonStats.toHit)}</b></div>}
          {mm3 && <div><span>ARMADURA</span><b>{chroniclesPartyArmorClass(state, member.id)}</b></div>}
          {!tacticsMode && !mm3 && <div><span>REDUCCIÓN</span><b>{gearBonus.damageReduction}</b></div>}
          {!mm3 && <div><span>ALCANCE</span><b>{reach}</b></div>}
        </div>

        {!mm3 && <div className="chronicles-character-sheet__combat"
          hidden={!tacticsMode && activeFolio !== 'record'}>
          <div><span>Clase</span><b>{className}</b></div>
          <div><span>Arma</span><b>{mm3 ? chroniclesArmsLabel(state, member.id) : profile.weaponName}</b></div>
          {mm3 ? (
            <div><span>Tipo</span><b>{equippedWeapon?.reach > 1 ? 'A distancia' : 'Cuerpo a cuerpo'}</b></div>
          ) : (
            <>
              <div><span>Ataque</span><b>{member.attackName || profile.attackName}</b></div>
              <div><span>Geometría</span><b>{profile.kindLabel}</b></div>
              <div><span>{tacticsMode ? 'Habilidad' : 'Habilidad táctica'}</span><b>{profile.abilityName}</b></div>
            </>
          )}
          <div><span>Estado</span><b>{member.hp > 0 ? 'Operativo' : 'Fuera de combate'}</b></div>
        </div>}

        {mm3 && (
          <div className="chronicles-character-sheet__section chronicles-character-sheet__section--core-stats"
            hidden={activeFolio !== 'record'}>
            <div className="chronicles-character-sheet__section-head">
              <div><span>ESTADÍSTICAS</span><small>Tiradas de creación · bonificador MM3 entre paréntesis</small></div>
            </div>
            <div className="chronicles-character-sheet__mm3-stats">
              {CHRONICLES_MM3_STATS.map((key) => (
                <div key={key} data-stat={key} title={CHRONICLES_MM3_STAT_EFFECTS[key]}>
                  <span>{CHRONICLES_MM3_STAT_LABELS[key]}</span>
                  <b>{mm3.stats[key]} <em>({signed(mm3.bonuses[key])})</em></b>
                  <small>{CHRONICLES_MM3_STAT_EFFECTS[key]}</small>
                </div>
              ))}
              <div data-stat="condition" title="Estado general según los puntos de vida actuales">
                <span>ESTADO</span>
                <b>{member.hp <= 0 ? 'Caído' : member.hp < member.maxHp ? 'Herido' : 'Sano'}</b>
                <small>{member.hp}/{member.maxHp} PV · condición física</small>
              </div>
            </div>
          </div>
        )}

        {mm3 && chroniclesMemberSchool(member) && (
          <div className="chronicles-character-sheet__section"
            hidden={activeFolio !== 'spells'}
            data-chronicles-spellbook={member.id}>
            <div className="chronicles-character-sheet__section-head">
              <div>
                <span>LIBRO DE HECHIZOS</span>
                <small>{CHRONICLES_SPELL_SCHOOLS[chroniclesMemberSchool(member)].label} · {CHRONICLES_SPELL_SCHOOLS[chroniclesMemberSchool(member)].summary} Más hechizos en el gremio.</small>
              </div>
              <b>{chroniclesMemberSp(state, member)}/{chroniclesMemberMaxSp(state, member)} PH</b>
            </div>
            <ChroniclesCharacterGrimoire
              key={member.id}
              spells={chroniclesMemberSpells(state, member)}
              availableSp={chroniclesMemberSp(state, member)}
              maxSp={chroniclesMemberMaxSp(state, member)}
              schoolLabel={CHRONICLES_SPELL_SCHOOLS[chroniclesMemberSchool(member)].label}
            />
          </div>
        )}

        {!tacticsMode && !chroniclesMemberSchool(member) && activeFolio === 'spells' && (
          <div className="chronicles-character-sheet__section chronicles-character-sheet__no-spells">
            <span>✧</span>
            <p>Este personaje no practica ninguna escuela de magia.</p>
            {spellcastingCompanion && (
              <button type="button" className="chronicles-character-sheet__spell-companion"
                onClick={() => onSelectMember(spellcastingCompanion.id)}>
                Ver hechizos de {spellcastingCompanion.name} <span aria-hidden="true">›</span>
              </button>
            )}
          </div>
        )}

        <div className="chronicles-character-sheet__section"
          data-chronicles-equipment-folio={!tacticsMode ? member.id : undefined}
          hidden={!tacticsMode && activeFolio !== 'equipment'}>
          <div className="chronicles-character-sheet__section-head">
            <div><span>{tacticsMode ? 'EQUIPO Y OBJETOS' : `OBJETOS DE ${member.name}`}</span><small>{tacticsMode ? 'Qué llevas y qué tienes puesto' : 'Mochila personal · selecciona y actúa'}</small></div>
            {tacticsMode && <b aria-label={`Oro de la compañía: ${gold}`}>{gold} oro</b>}
          </div>
          <div className={`chronicles-character-sheet__loadout${!relic ? ' is-relic-empty' : ''}`}>
            {!tacticsMode && backpackPanel}
            {(tacticsMode || relic) && (
              <article className={relic ? 'chronicles-character-sheet__relic has-relic' : 'chronicles-character-sheet__relic'}>
                <span>Reliquia vinculada</span>
                <b>{relic?.name || 'Ninguna'}</b>
                {relic && <small>{relic.description}</small>}
              </article>
            )}
            {!tacticsMode && showEquipmentDetails && <article className="chronicles-character-sheet__equipment"
              id="chronicles-equipment-technical-details">
              <section className="chronicles-character-sheet__equipped-disclosure" data-expanded="true"
                aria-label="Detalles técnicos del equipo">
                <div className="chronicles-character-sheet__technical-heading">
                  <strong>Detalles técnicos</strong>
                  <button type="button" onClick={() => setShowEquipmentDetails(false)}
                    aria-label="Cerrar detalles técnicos">Cerrar</button>
                </div>
                <div className="chronicles-character-sheet__equipped-body">
              {mm3 && <div className="chronicles-character-sheet__dual-weapons" aria-label="Armas disponibles: A cuerpo a cuerpo, S proyectiles">
                {[
                  { slot: 'weapon', label: 'A · Cuerpo a cuerpo', stats: weaponModes.weapon },
                  { slot: 'missile', label: 'S · Proyectiles', stats: weaponModes.missile },
                ].map(({ slot, label, stats }) => {
                  const worn = chroniclesEquippedItem(state, member.id, slot);
                  return (
                    <div className="chronicles-character-sheet__weapon-card" key={slot} data-slot={slot}>
                      <b>{label}</b>
                      <strong>{worn?.name || 'Sin equipar'}</strong>
                      <small>{slot === 'weapon' || worn
                        ? `Daño ${stats.damage} · Acierto ${signed(stats.toHit)}`
                        : 'Sin arma de proyectiles · no puede disparar'}</small>
                      {slot === 'missile' && worn && chroniclesShopHandlingNote(worn, state?.combatRules) && (
                        <small className="chronicles-character-sheet__handling-note" data-chronicles-worn-handling>
                          {chroniclesShopHandlingNote(worn, state?.combatRules)}
                        </small>
                      )}
                      {worn && <button type="button" disabled={!canChangeEquipment}
                        aria-label={`Quitar ${worn.name} y guardarlo en la mochila`}
                        title="Quitar equipo y devolverlo a la mochila"
                        onClick={() => onEquipmentAction?.({ type: 'unequip-item', slot })}>
                        Quitar
                      </button>}
                    </div>
                  );
                })}
              </div>}
              {/* In MM3, A/S already include the same unequip action above.
                  Do not render duplicate weapon slots below the weapon cards. */}
              {CHRONICLES_EQUIPMENT_SLOTS.filter((slot) => !mm3
                || (slot !== 'weapon' && slot !== 'missile')).map((slot) => {
                const worn = chroniclesEquippedItem(state, member.id, slot);
                return (
                  <div className="chronicles-character-sheet__gear-slot" key={slot}>
                    <small>{{ weapon: 'Arma · A', missile: 'Proyectiles · S', armor: 'Armadura', shield: 'Escudo' }[slot]}</small>
                    <strong>{worn?.name || 'Sin equipar'}</strong>
                    {worn && <button type="button" disabled={!canChangeEquipment}
                      aria-label={`Quitar ${worn.name} y guardarlo en la mochila`}
                      title="Quitar equipo y devolverlo a la mochila"
                      onClick={() => onEquipmentAction?.({ type: 'unequip-item', slot })}>
                      Quitar
                    </button>}
                  </div>
                );
              })}
              <small>
                {mm3
                  ? `CA del equipo +${gearBonus.armorClassBonus}: dificulta impactos, no resta daño. A y S calculan daño y acierto por separado.`
                  : `Daño +${gearBonus.attackDamageBonus} · mitigación ${gearBonus.damageReduction}. Sólo cuenta el equipo puesto.`}
              </small>
                </div>
              </section>
            </article>}
            {tacticsMode && backpackPanel}
          </div>
        </div>

        <div className="chronicles-character-sheet__section"
          data-chronicles-training="attributes"
          hidden={!tacticsMode && activeFolio !== 'training'}>
          <div className="chronicles-character-sheet__section-head">
            <div><span>ATRIBUTOS</span><small>Bonificadores persistentes entre niveles y expediciones</small></div>
            <b>{progress.attributePoints} punto{progress.attributePoints === 1 ? '' : 's'} libre{progress.attributePoints === 1 ? '' : 's'}</b>
          </div>
          <div className="chronicles-character-sheet__attribute-grid">
            {attributes.map((attributeKey) => {
              const definition = CHRONICLES_ATTRIBUTE_DEFINITIONS[attributeKey];
              const effect = mm3 && attributeKey === 'precision'
                ? '+1 daño a distancia/magia cada 3 puntos'
                : definition.effect;
              const value = Number(progress.attributes?.[attributeKey] || 0);
              const canSpend = typeof onAllocateAttribute === 'function'
                && progress.attributePoints > 0
                && value < CHRONICLES_ATTRIBUTE_CAP;
              return (
                <button
                  type="button"
                  key={attributeKey}
                  disabled={!canSpend}
                  title={effect}
                  onClick={() => onAllocateAttribute?.(member.id, attributeKey)}
                >
                  <span><b>{definition.label}</b><small>{effect}</small></span>
                  <strong>{value}/{CHRONICLES_ATTRIBUTE_CAP}</strong>
                  <i aria-hidden="true">{canSpend ? '+' : '·'}</i>
                </button>
              );
            })}
          </div>
        </div>

        <div className="chronicles-character-sheet__section"
          data-chronicles-training="skills"
          hidden={!tacticsMode && activeFolio !== 'training'}>
          <div className="chronicles-character-sheet__section-head">
            <div><span>TÉCNICAS Y GRIMORIO</span><small>Doctrinas aprendidas y caminos de especialización</small></div>
            <b>{progress.skillPoints} punto{progress.skillPoints === 1 ? '' : 's'} libre{progress.skillPoints === 1 ? '' : 's'}</b>
          </div>
          <div className="chronicles-character-sheet__skill-grid">
            {skills.map((skill) => {
              const learned = progress.skills.includes(skill.id);
              const competing = skills.some((candidate) => (
                candidate.id !== skill.id
                && candidate.group === skill.group
                && progress.skills.includes(candidate.id)
              ));
              const levelLocked = progress.level < skill.requiredLevel;
              const canLearn = typeof onLearnSkill === 'function'
                && !learned
                && !competing
                && !levelLocked
                && progress.skillPoints >= skill.cost;
              const status = learned
                ? 'Aprendida'
                : competing
                  ? 'Rama cerrada'
                  : levelLocked
                    ? `Requiere Nv ${skill.requiredLevel}`
                    : `${skill.cost} punto`;
              return (
                <button
                  type="button"
                  key={skill.id}
                  className={learned ? 'is-learned' : ''}
                  disabled={!canLearn}
                  onClick={() => onLearnSkill?.(member.id, skill.id)}
                >
                  <span><b>{skill.label}</b><small>{skill.description}</small></span>
                  <strong>{status}</strong>
                </button>
              );
            })}
          </div>
        </div>

        <footer className="chronicles-character-sheet__foot">
          <span>{member.attackName || profile.attackName} · daño {damage}{mm3 ? '' : ` · alcance ${reach}`}</span>
          <span>Esc · cerrar</span>
        </footer>
        </div>{/* folio-content */}
        </div>{/* folio-layout */}
        </div>
        {!tacticsMode && (
          <nav className="chronicles-character-sheet__party-dock" aria-label="Seleccionar personaje de la compañía">
            {chroniclesPartyHotkeySlots(state.party).map(({ member: hero, slot }) => (
              <button type="button" key={hero.id}
                disabled={!onSelectMember && !(directTransferMode && hero.id !== member.id)}
                aria-label={directTransferMode && hero.id !== member.id
                  ? `Entregar 1 ${transferSelection.name} a ${hero.name} (tecla ${slot})`
                  : `Ver ficha de ${hero.name}, ${hero.hp} de ${hero.maxHp} PV`}
                aria-pressed={hero.id === member.id}
                data-transfer-target={directTransferMode && hero.id !== member.id ? 'true' : undefined}
                data-hotkey={slot}
                onClick={() => {
                  if (directTransferMode && hero.id !== member.id) giveSelectedItemTo(hero.id);
                  else viewMember(hero.id);
                }}
              >
                <span className="chronicles-character-sheet__party-number" aria-hidden="true">{slot}</span>
                <img src={chroniclesPartyPortraitUrl(hero)} alt="" draggable="false" />
                <span className="chronicles-character-sheet__party-name">{hero.name}</span>
                <span className="chronicles-character-sheet__party-hp"><span className="chronicles-character-sheet__party-hp-value">{hero.hp}/{hero.maxHp}</span><span className="chronicles-character-sheet__party-hp-unit"> PV</span></span>
              </button>
            ))}
          </nav>
        )}
      </section>
    </div>
  );

  if (typeof document === 'undefined') return sheet;
  return createPortal(sheet, document.body);
}