import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import LoadingScreen from '../standalone/LoadingScreen.jsx';
import {
  CHRONICLES_DIRECTIONS,
  chroniclesActiveEnemies,
  CHRONICLES_PARTY,
  chroniclesEnemyTargetAhead,
  chroniclesBuildingEntryState,
  chroniclesContextualContentAction,
  chroniclesPartyAttackStats,
  chroniclesMM3MissileSightReach,
  chroniclesAttackMode,
  chroniclesOpeningVolleyShooters,
  chroniclesOpeningVolleyShots,
  chroniclesJournalEntries,
  chroniclesObjective,
  chroniclesReduce,
  chroniclesCombatPartyStepBlocked,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesPartyBark } from '../chroniclesOfMatthiasBarks.js';
import { chroniclesArmsLabel } from '../chronicles/chroniclesWornGear.js';
import { chroniclesResolveEnemyActor } from '../chroniclesOfMatthiasTurns.js';
import {
  chroniclesAdvanceCombatInitiative,
  chroniclesCurrentInitiativeActor,
  chroniclesStartInitiativeCombat,
} from '../chronicles/chroniclesInitiative.js';
import { chroniclesDeployedPartyLevel } from '../chronicles/chroniclesDifficultyPolicy.js';
import { playChroniclesActionSound, playChroniclesLevelUpChime } from '../chronicles/chroniclesActionAudio.js';
import { chroniclesPortraitLevelUpEvents } from '../chronicles/chroniclesProgressionFeedback.js';
import ChroniclesPortraitLevelUp from './ChroniclesPortraitLevelUp.jsx';
import './ChroniclesPortraitLevelUp.css';
import { useChroniclesSoundtrack } from '../chronicles/useChroniclesSoundtrack.js';
import { chroniclesPartyPortraitUrl } from '../chronicles/chroniclesPartyPortraitAssets.js';
import { chroniclesClearRuntimeMapDefinitions, chroniclesMapForState, chroniclesReconcileCurrentMapEnemyHp } from '../chronicles/chroniclesMapCatalog.js';
import { chroniclesHudQuestDestination } from '../chronicles/chroniclesQuestRegionHint.js';
import { chroniclesAdvanceExplorationEnemies, chroniclesGridExplorationStep } from '../chronicles/chroniclesGridExplorationStep.js';
import { chroniclesAdvanceOpeningVolley, chroniclesMissileRefusal, chroniclesTouchVolleyOpportunity } from '../chronicles/chroniclesPrecontactVolley.js';
import './ChroniclesQuietActionNotice.css';
import { chroniclesLootNotice } from '../chronicles/chroniclesLootNotice.js';
import { chroniclesPlayAttackPresentation, chroniclesVolleyPresentationShooterIds } from '../chronicles/chroniclesVolleyPresentation.js';
import { chroniclesCanCheckpoint, chroniclesCheckpointReason, CHRONICLES_COMBAT_SAVE_NOTICE } from '../chronicles/chroniclesSavePolicy.js';
import { chroniclesDiscardAndExit } from '../chronicles/chroniclesDiscardExit.js';
import { chroniclesNpcDialogueForState } from '../chronicles/chroniclesNpcDialogue.js';
import { chroniclesDoorwayPrompt } from '../chronicles/chroniclesDoorwayPrompt.js';
import { chroniclesApplyArrival } from '../chronicles/chroniclesArrival.js';
import { CHRONICLES_SWORDHAVEN_RETURN_PORTAL_ID } from '../chronicles/chroniclesSwordhavenReturnPortal.js';
import {
  chroniclesCheckpointState,
  chroniclesListRemoteRuns,
  chroniclesDeleteRemoteRun,
} from '../chronicles/chroniclesRunClient.js';
import { loadChroniclesCharacterDraft } from '../chronicles/chroniclesCharacterDraft.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesCheckpointRunProgression,
  chroniclesRunCheckpointFingerprint,
} from '../chronicles/chroniclesRunCheckpoint.js';
import {
  CHRONICLES_BOOTSTRAP_ERROR_CODES,
  chroniclesBootstrapWorld,
} from '../chronicles/chroniclesGameBootstrap.js';
import {
  ensureChroniclesRun,
  beginChroniclesRun,
  chroniclesListSavedRuns,
  chroniclesMergeRemoteSavedRuns,
  chroniclesRecoverLegacySavedRunIds,
  chroniclesSaveCatalogOwner,
  chroniclesMarkSavedRunRemote,
  chroniclesSelectedRunIsRemote,
  chroniclesSelectSavedRun,
  chroniclesRenameSavedRun,
  chroniclesForgetSavedRun,
  chroniclesNoteSavedRunCheckpoint,
  chroniclesRunEntryMapId,
  finishChroniclesRun,
  renewChroniclesRun,
} from '../chronicles/chroniclesRunIdentity.js';
import {
  chroniclesClearPlayingRun,
  chroniclesRememberPlayingRun,
  chroniclesShouldResumePlayingRun,
} from '../chronicles/chroniclesRefreshResume.js';
import { chroniclesPartyCondition } from '../chroniclesOfMatthiasPartyCondition.js';
import { chroniclesEquippedItem } from '../chronicles/chroniclesEquipment.js';
import { chroniclesPartyRelic } from '../chroniclesOfMatthiasRelics.js';
import { chroniclesRetaliationCue } from '../chroniclesOfMatthiasRetaliation.js';
import { CHRONICLES_TURN_ENGINE_VERSION } from '../chroniclesOfMatthiasTurns.js';
import {
  applyChroniclesProgressionToTacticsState,
  applyChroniclesTacticsProgression,
  chroniclesFreshExpeditionProgression,
  chroniclesHeroProgress,
  loadChroniclesProgression,
  reconcileChroniclesProgressionInTacticsState,
  saveChroniclesProgression,
  setChroniclesCharacterBuild,
  spendChroniclesAttributePoint,
  unlockChroniclesSkill,
} from '../chroniclesOfMatthiasProgression.js';
import {
  chroniclesAutomapMarkSeen,
  clearChroniclesAutomapVisited,
  loadChroniclesAutomapVisited,
  saveChroniclesAutomapVisited,
} from '../chronicles/chroniclesAutomap.js';
import { useEscapeToClose } from '../useEscapeToClose.js';
import ChroniclesAutomap from './ChroniclesAutomap.jsx';
import { chroniclesObjectiveDestination, chroniclesRouteHint } from '../chronicles/chroniclesWorldMap.js';
import ChroniclesCharacterSheet from './ChroniclesCharacterSheet.jsx';
import ChroniclesShop from './ChroniclesShop.jsx';
import ChroniclesInn from './ChroniclesInn.jsx';
import ChroniclesProvisions, { CHRONICLES_QUARTERMASTER_ID } from './ChroniclesProvisions.jsx';
import ChroniclesAudience from './ChroniclesAudience.jsx';
import ChroniclesGuild from './ChroniclesGuild.jsx';
import ChroniclesSpellMenu, { ChroniclesSpellTargetBanner } from './ChroniclesSpellMenu.jsx';
import ChroniclesAccountMenu from './ChroniclesAccountMenu.jsx';
import ChroniclesAudioControls from './ChroniclesAudioControls.jsx';
import { createPortal } from 'react-dom';
import ChroniclesHitSplat from './ChroniclesHitSplat.jsx';
import { chroniclesPullProgression, chroniclesPushProgression } from '../chronicles/chroniclesProgressionSync.js';
import {
  chroniclesClearSessionResume,
  chroniclesLoadSessionResume,
  chroniclesSaveSessionResume,
} from '../chronicles/chroniclesSessionResume.js';
import ChroniclesQuickStatus from './ChroniclesQuickStatus.jsx';
import { chroniclesQuickStatusRows } from '../chronicles/chroniclesQuickStatus.js';
import { chroniclesGoldBalance } from '../chronicles/chroniclesContentRuntime.js';
import { CHRONICLES_SPLAT_MS, chroniclesHitImpacts } from '../chronicles/chroniclesHitSplats.js';
import {
  CHRONICLES_SPELLS, chroniclesHealTargetStatus, chroniclesSpellTargetHotkey, chroniclesMemberMaxSp, chroniclesMemberSp, chroniclesMemberSpells,
} from '../chronicles/chroniclesMagic.js';
import ChroniclesMinimap from './ChroniclesMinimap.jsx';
import ChroniclesCombatRoster, { chroniclesHealthBand } from './ChroniclesCombatRoster.jsx';
import ChroniclesBookOneEpilogue from './ChroniclesBookOneEpilogue.jsx';
import ChroniclesCampaignEpilogue from './ChroniclesCampaignEpilogue.jsx';
import ChroniclesAdminPanel from './ChroniclesAdminPanel.jsx';
import { CHRONICLES_ADMIN_TRAVEL_KEY } from '../chronicles/chroniclesAdmin.js';
import { fetchMe } from '../auth.js';
import {
  CHRONICLES_EPILOGUE_SEEN_KEY,
  chroniclesCampaignEnding,
  chroniclesCampaignEpiloguePending,
} from '../chronicles/chroniclesCampaignEpilogue.js';
import ChroniclesCharacterSetup from './ChroniclesCharacterSetup.jsx';
import ChroniclesSaveMenu from './ChroniclesSaveMenu.jsx';
import ChroniclesQuestLog, { chroniclesQuestLogEntries } from './ChroniclesQuestLog.jsx';
import ChroniclesNoticeBoard from './ChroniclesNoticeBoard.jsx';
import { CHRONICLES_CONSUMABLES, chroniclesCarriedConsumables } from '../chronicles/chroniclesConsumables.js';
import ChroniclesJournalModal from './ChroniclesJournalModal.jsx';
import ChroniclesDefeatOverlay from './ChroniclesDefeatOverlay.jsx';
import ChroniclesEnemyRetaliationFx from './ChroniclesEnemyRetaliationFx.jsx';
import ChroniclesInitiativeRail from './ChroniclesInitiativeRail.jsx';
import ChroniclesNarratorOverlay, { shouldShowChroniclesNarration } from './ChroniclesNarratorOverlay.jsx';
import {
  chroniclesAppendNarration,
  chroniclesLoadNarrationLog,
  chroniclesSaveNarrationLog,
} from '../chronicles/chroniclesNarrationLog.js';
import ChroniclesPartyBark from './ChroniclesPartyBark.jsx';
import ChroniclesFirstSteps from './ChroniclesFirstSteps.jsx';
import ChroniclesFirstThreatCue from './ChroniclesFirstThreatCue.jsx';
import ChroniclesFirstAudienceCue from './ChroniclesFirstAudienceCue.jsx';
import useChroniclesLandscape, {
  releaseChroniclesLandscape,
  requestChroniclesLandscapeOnEntry,
} from './useChroniclesLandscape.js';
import './ChroniclesOfMatthias.css';
import './ChroniclesCharacterSheet.css';
import './ChroniclesOfMatthiasArt.css';
import './ChroniclesOfMatthiasJournal.css';
import './ChroniclesPartyCondition.css';
import { CHRONICLES_DIRECTION_KEYS, chroniclesAdventureMenuShortcut, chroniclesCombatKeyMode, chroniclesContainAdventureMenuTab, chroniclesAdventureTabClosesMenu, chroniclesRestoreAdventureMenuFocus, chroniclesReleaseAdventureMenuFocus, chroniclesBlockAdventureMenuBackgroundEvent, chroniclesFirstPersonEscapeAction, chroniclesPartyHotkeyMember } from '../chronicles/chroniclesKeyboardBindings.js';
import './ChroniclesPartyThumbnails.css';
import './ChroniclesRecoveredRelic.css';
import './ChroniclesMM3Chrome.css';
// The first-person folio must override both base and old MM3 chrome styles.
import './ChroniclesCharacterSheetMM3.css';
import './ChroniclesSpellMenuFolio.css';
import ChroniclesAdventureMenu from './ChroniclesAdventureMenu.jsx';
import { chroniclesAreaTransitionIntent } from '../chronicles/chroniclesAreaTransitionIntent.js';
import { chroniclesAreaTravelKeyDecision } from '../chronicles/chroniclesAreaTransitionFocus.js';
import ChroniclesAreaTransitionDialog from './ChroniclesAreaTransitionDialog.jsx';

import './ChroniclesAdventureMenuFolio.css';

const FIRST_PERSON_RUN_SCOPE = 'first-person';

function loadChroniclesFirstPersonRenderer() {
  return import('../chroniclesOfMatthiasThree.js');
}

function BootstrapFailure({ error, onRetry, onMenu, onExit }) {
  const aborted = error?.code === CHRONICLES_BOOTSTRAP_ERROR_CODES.aborted;
  return (
    <div className="menu chronicles-bootstrap">
      <section className="menu-section" role="alert" aria-live="assertive">
        <span className="section-label">EXPEDICIÓN NO INICIADA</span>
        <h2>No se pudo preparar Chronicles</h2>
        <p>El mundo autoritativo no superó el arranque. No se cargará la cripta local como sustituto.</p>
        <p className="hint-text">Código {error?.code || CHRONICLES_BOOTSTRAP_ERROR_CODES.unknown}{error?.requestId ? ` · ${error.requestId}` : ''}</p>
        <div className="game-controls">
          {!aborted && <button type="button" className="primary-btn" onClick={onRetry}>Reintentar</button>}
          <button type="button" className="secondary-btn" onClick={onMenu}>Volver a expediciones</button>
          <button type="button" className="secondary-btn" onClick={onExit}>Salir de Chronicles</button>
        </div>
      </section>
    </div>
  );
}

export function chroniclesSaveListErrorMessage(error) {
  const status = Number(error?.status) || 0;
  if (status === 401) {
    return 'Tu sesión ha caducado: sal y vuelve a entrar para ver tus partidas del servidor. Mientras, se muestran los guardados locales.';
  }
  const reference = typeof error?.requestId === 'string' && error.requestId ? ` · ref. ${error.requestId.slice(0, 12)}` : '';
  const cause = status ? `error ${status}${reference}` : `sin respuesta${reference}`;
  return `No se pudo consultar el servidor (${cause}). Se muestran los guardados locales; pulsa «Reintentar sincronización».`;
}

export default function ChroniclesOfMatthias({ onExit, onLogout = null }) {
  const hostRef = useRef(null);
  const gameRootRef = useRef(null);
  const engineRef = useRef(null);
  const retaliationTimerRef = useRef(null);
  const retaliationSequenceRef = useRef(0);
  const partyBarkTimerRef = useRef(null);
  const partyBarkSequenceRef = useRef(0);
  const [progression, setProgression] = useState(() => loadChroniclesProgression());
  const progressionRef = useRef(progression);
  const runProgressionActiveRef = useRef(false);
  // The heroes' progression also lives on the server (it follows the account
  // between devices). Runs bootstrap only once it has been pulled, or the
  // pull failed and the local copy stands.
  const [progressionSynced, setProgressionSynced] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    chroniclesPullProgression(progressionRef.current, { signal: controller.signal })
      .then((pulled) => {
        if (!active || runProgressionActiveRef.current) return;
        if (pulled.from === 'remote') {
          const saved = saveChroniclesProgression(pulled.progression);
          progressionRef.current = saved;
          setProgression(saved);
        }
        if (pulled.needsPush) void chroniclesPushProgression(pulled.progression).catch(() => {});
      })
      .catch(() => {})
      .finally(() => { if (active) setProgressionSynced(true); });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);
  // A reload of a playing expedition must return straight to the server
  // checkpoint. An intentional visit to the expedition book stays in 'menu'.
  // Never create a new run as part of the initial render.
  const [entryView, setEntryView] = useState(() => {
    if (loadChroniclesCharacterDraft(CHRONICLES_PARTY)) return 'setup';
    return chroniclesShouldResumePlayingRun(FIRST_PERSON_RUN_SCOPE) ? 'playing' : 'menu';
  });
  const [characterSetupDone, setCharacterSetupDone] = useState(entryView === 'playing');
  useChroniclesSoundtrack(entryView);
  const [savesRefreshKey, refreshSaves] = useState(0);
  const [saveBookInitialScreen, setSaveBookInitialScreen] = useState('home');
  const [saveInventory, setSaveInventory] = useState(null);
  const [saveMenuLoading, setSaveMenuLoading] = useState(false);
  const [saveMenuError, setSaveMenuError] = useState('');
  const [saveMenuBusy, setSaveMenuBusy] = useState(null);
  const [ready, setReady] = useState(false);
  const [scenePainted, setScenePainted] = useState(false);
  const [bootstrapError, setBootstrapError] = useState(null);
  const [bootstrapRevision, setBootstrapRevision] = useState(0);
  const staleRunRecoveryAttemptedRef = useRef(false);
  const activeRunIdRef = useRef(null);
  const authoritativeRunRef = useRef(null);
  const checkpointFingerprintRef = useRef('');
  const checkpointQueueRef = useRef(Promise.resolve());
  const checkpointPendingRef = useRef(0);
  const checkpointMapRef = useRef(null);
  const checkpointExistsRef = useRef(false);
  const automapVisitedRef = useRef({});
  const stateRef = useRef(null);
  const [state, setState] = useState(null);
  // Opening the quartermaster counter is a free presentation transition.
  const [provisionsOpen, setProvisionsOpen] = useState(false);
  const provisionsOpenRef = useRef(false);
  const openProvisions = useCallback(() => {
    provisionsOpenRef.current = true;
    setProvisionsOpen(true);
  }, []);
  const closeProvisions = useCallback(() => {
    provisionsOpenRef.current = false;
    setProvisionsOpen(false);
  }, []);
  useEffect(() => {
    closeProvisions(); // Do not retain a shop across map/run transitions.
  }, [state?.mapId, entryView, closeProvisions]);
  const [selectedMemberId, setSelectedMemberId] = useState('matthias');
  const [sheetMemberId, setSheetMemberId] = useState(null);
  const [sheetInitialFolio, setSheetInitialFolio] = useState('record');
  const selectedMemberIdRef = useRef(selectedMemberId);
  const partyHotkeyRef = useRef({ key: '', at: 0 });
  const [rendererError, setRendererError] = useState('');
  const [retaliationCue, setRetaliationCue] = useState(null);
  const [missileNotice, setMissileNotice] = useState('');
  const missileNoticeTimerRef = useRef(null);
  const showMissileNotice = useCallback((message) => {
    if (missileNoticeTimerRef.current) window.clearTimeout(missileNoticeTimerRef.current);
    setMissileNotice(message);
    missileNoticeTimerRef.current = window.setTimeout(() => {
      missileNoticeTimerRef.current = null;
      setMissileNotice('');
    }, 1500);
  }, []);
  useEffect(() => () => {
    if (missileNoticeTimerRef.current) window.clearTimeout(missileNoticeTimerRef.current);
  }, []);
  // Ephemeral per-hero feedback. These cues are deliberately never persisted.
  const [portraitLevelUps, setPortraitLevelUps] = useState({});
  const portraitLevelUpSerialRef = useRef(0);
  const portraitLevelUpTimersRef = useRef(new Map());
  const pendingLevelUpChimeRef = useRef(null);
  const clearPortraitLevelUps = useCallback(() => {
    portraitLevelUpTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    portraitLevelUpTimersRef.current.clear();
    pendingLevelUpChimeRef.current = null;
    setPortraitLevelUps({});
  }, []);
  useEffect(() => () => {
    portraitLevelUpTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    portraitLevelUpTimersRef.current.clear();
  }, []);
  const showPortraitLevelUps = useCallback((levelUps, party, committed) => {
    const events = chroniclesPortraitLevelUpEvents({ levelUps }, party);
    if (!events.length) return;
    // A batch of simultaneous level-ups plays one chime, not four.
    pendingLevelUpChimeRef.current = committed;
    const cues = {};
    for (const event of events) {
      const previous = portraitLevelUpTimersRef.current.get(event.memberId);
      if (previous != null) window.clearTimeout(previous);
      const token = ++portraitLevelUpSerialRef.current;
      cues[event.memberId] = { ...event, token };
      const timeout = window.setTimeout(() => {
        portraitLevelUpTimersRef.current.delete(event.memberId);
        setPortraitLevelUps((current) => {
          if (current[event.memberId]?.token !== token) return current;
          const next = { ...current };
          delete next[event.memberId];
          return next;
        });
      }, 1700);
      portraitLevelUpTimersRef.current.set(event.memberId, timeout);
    }
    setPortraitLevelUps((current) => ({ ...current, ...cues }));
  }, []);
  const [lootNotice, setLootNotice] = useState(null);
  const lootTimerRef = useRef(null);
  const showLootNotice = useCallback((notice) => {
    if (!notice) return;
    if (lootTimerRef.current) window.clearTimeout(lootTimerRef.current);
    setLootNotice(notice);
    lootTimerRef.current = window.setTimeout(() => {
      lootTimerRef.current = null;
      setLootNotice(null);
    }, 2400);
  }, []);
  useEffect(() => () => {
    if (lootTimerRef.current) window.clearTimeout(lootTimerRef.current);
  }, []);
  const [hitSplats, setHitSplats] = useState([]);
  const hitSplatSequenceRef = useRef(0);
  const pendingActionSoundRef = useRef(null);
  // Effects begin after React has committed the blood splat and the new HP to
  // the DOM, in the same paint frame—not ahead of the visible contact.
  useLayoutEffect(() => {
    const queued = pendingActionSoundRef.current;
    if (!queued || queued.committed !== state) return;
    pendingActionSoundRef.current = null; // StrictMode must not replay sounds.
    playChroniclesActionSound(queued.previous, queued.resolved, queued.action);
    if (pendingLevelUpChimeRef.current === state) {
      pendingLevelUpChimeRef.current = null; // no chime on reload/StrictMode
      playChroniclesLevelUpChime();
    }
  }, [state]);
  // Every line the chronicle shows is kept for the Crónica (per run), since
  // the band on the view fades after a few seconds.
  useEffect(() => {
    const message = state?.message;
    if (!shouldShowChroniclesNarration(message)) return;
    const runId = activeRunIdRef.current;
    setNarrationLog((current) => {
      const base = narrationRunRef.current === runId ? current : chroniclesLoadNarrationLog(runId);
      narrationRunRef.current = runId;
      const next = chroniclesAppendNarration(base, message);
      if (next !== base) chroniclesSaveNarrationLog(runId, next);
      return next;
    });
  }, [state?.message]);
  const [partyBark, setPartyBark] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Parent owns the nested folio so global Escape/Back uses the same state.
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [firstStepsOpen, setFirstStepsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  // Admin tools appear only for accounts the API reports as admins.
  useEffect(() => {
    let alive = true;
    fetchMe().then((user) => { if (alive) setIsAdmin(Boolean(user?.isAdmin)); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const menuSummaryRef = useRef(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [narrationLog, setNarrationLog] = useState([]);
  const narrationRunRef = useRef(null);
  const [quickStatusOpen, setQuickStatusOpen] = useState(false);
  const [chronicleModalOpen, setChronicleModalOpen] = useState(false);
  const [automapOpen, setAutomapOpen] = useState(false);
  // false, 'spells' or 'items': the MAGIA/OBJETOS panel and its open tab.
  const [spellMenuOpen, setSpellMenuOpen] = useState(false);
  // MM3's short-lived, no-cost question sits above the caster's portrait.
  const [pendingSpellTarget, setPendingSpellTarget] = useState(null);
  const [spellTargetNotice, setSpellTargetNotice] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [confirmExitWithoutSaving, setConfirmExitWithoutSaving] = useState(false);
  const [confirmLoadSelection, setConfirmLoadSelection] = useState(false);
  // A modal must acquire focus when opened by pointer/touch as well as Tab.
  // It must also reject stray focus on game HUD controls underneath it.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const menu = menuSummaryRef.current?.parentElement;
    if (!menu?.open) return undefined;
    const onFocus = (event) => { chroniclesRestoreAdventureMenuFocus(menu, event.target); };
    document.addEventListener('focusin', onFocus);
    chroniclesRestoreAdventureMenuFocus(menu, document.activeElement);
    return () => document.removeEventListener('focusin', onFocus);
  }, [menuOpen, confirmExitWithoutSaving, confirmLoadSelection]);
  const [areaTransition, setAreaTransition] = useState(null);
  const areaTransitionRef = useRef(null);
  const [audience, setAudience] = useState(null);
  const audienceRef = useRef(null);
  const [noticeBoardOpen, setNoticeBoardOpen] = useState(false);
  const closeNoticeBoard = useCallback(() => setNoticeBoardOpen(false), []);
  const [automapVisitedByMap, setAutomapVisitedByMap] = useState({});
  const touchHoldRef = useRef({ delayId: null, repeatId: null });
  const { needsRotation, lockState, activateLandscape, relockPrompt, declineLandscape } = useChroniclesLandscape(characterSetupDone);

  const showHitSplats = useCallback((previous, next) => {
    const impacts = chroniclesHitImpacts(previous, next);
    if (!impacts.length) return;
    const token = hitSplatSequenceRef.current + 1;
    hitSplatSequenceRef.current = token;
    const fresh = impacts.map((impact, index) => ({ ...impact, token: `${token}-${index}` }));
    // Replace an existing victim's splat; keep distinct simultaneous hits.
    setHitSplats((active) => [
      ...active.filter((splat) => !fresh.some((entry) => entry.kind === splat.kind && entry.id === splat.id)),
      ...fresh,
    ]);
    window.setTimeout(() => {
      setHitSplats((active) => active.filter((splat) => !fresh.some((entry) => entry.token === splat.token)));
    }, CHRONICLES_SPLAT_MS);
  }, []);

  // Real Brave/Chrome forced a light glyph despite matching !important CSS.
  // Applying an inline important override to the concrete DOM nodes was
  // verified to work in the affected browser. Never touch colored attack/
  // magic/contextual controls or the rest of the game's typography.
  useEffect(() => {
    if (!ready || !state || !gameRootRef.current) return;
    const nodes = gameRootRef.current.querySelectorAll([
      '.chronicles-statusbar .chronicles-map-trigger',
      '.chronicles-statusbar .chronicles-map-trigger b',
      '.chronicles-statusbar .chronicles-map-trigger i',
      '.chronicles-game-menu > summary',
      '.chronicles-game-menu > summary b',
      '.chronicles-touch button:not(.is-attack):not(.is-magic):not(.is-contextual)',
      '.chronicles-game-menu__panel button',
      '.chronicles-game-menu__panel button :is(b, span, small, strong, i)',
      '.chronicles-game-menu__panel legend',
      '.chronicles-game-menu__panel label',
      '.chronicles-game-menu__panel > strong',
      '.chronicles-game-menu__panel > small',
    ].join(', '));
    for (const node of nodes) {
      // This legacy workaround belongs to pale stone controls. The adventure
      // folio is DARK slate: an inline !important black fill outranks its
      // accessible ivory CSS and makes save/audio labels unreadable.
      if (node.closest('.chronicles-game-menu__panel--folio')) continue;
      node.style.setProperty('color', '#08080a', 'important');
      node.style.setProperty('-webkit-text-fill-color', '#08080a', 'important');
      node.style.setProperty('-webkit-text-stroke-color', '#08080a', 'important');
      node.style.setProperty('color-scheme', 'light only', 'important');
    }
  }, [ready, state, menuOpen, confirmExitWithoutSaving]);

  // Reconcile server-owned expeditions only while browsing the save book.
  // Cleanup discards stale results after navigating away or switching flows.
  useEffect(() => {
    if (entryView !== 'menu') return undefined;
    const controller = new AbortController();
    const ownerAtRequest = chroniclesSaveCatalogOwner();
    let active = true;
    setSaveMenuLoading(true);
    setSaveMenuError('');
    setSaveInventory(chroniclesListSavedRuns(FIRST_PERSON_RUN_SCOPE));
    void chroniclesListRemoteRuns({ signal: controller.signal })
      .then(async (rows) => {
        if (!active) return;
        await chroniclesRecoverLegacySavedRunIds(FIRST_PERSON_RUN_SCOPE, rows, {
          expectedOwner: ownerAtRequest,
          signal: controller.signal,
        });
        if (!active || controller.signal.aborted) return;
        setSaveInventory(chroniclesMergeRemoteSavedRuns(FIRST_PERSON_RUN_SCOPE, rows, { expectedOwner: ownerAtRequest }));
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        // Say what failed: an expired session, a server error with its
        // reference (the request id the API logs) or no answer at all.
        console.warn('[chronicles] no se pudo listar las partidas del servidor', error);
        setSaveMenuError(chroniclesSaveListErrorMessage(error));
        setSaveInventory(chroniclesListSavedRuns(FIRST_PERSON_RUN_SCOPE));
      })
      .finally(() => {
        if (active) setSaveMenuLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [entryView, savesRefreshKey]);

  useEffect(() => {
    selectedMemberIdRef.current = selectedMemberId;
  }, [selectedMemberId]);

  useEffect(() => {
    progressionRef.current = progression;
  }, []);

  useEffect(() => {
    if (!state?.mapId) return;
    setAutomapVisitedByMap((visited) => chroniclesAutomapMarkSeen(visited, chroniclesMapForState(state), state));
  }, [state?.mapId, state?.x, state?.y, state?.direction]);

  // Map reveal is session-only until an explicit save or area transition.
  useEffect(() => {
    automapVisitedRef.current = automapVisitedByMap;
  }, [automapVisitedByMap]);
  // Keep this tab's resume copy current (see chroniclesSessionResume).
  useEffect(() => {
    if (!ready || !state) return undefined;
    const timer = setTimeout(() => {
      const run = authoritativeRunRef.current;
      if (!run?.runId || activeRunIdRef.current !== run.runId) return;
      chroniclesSaveSessionResume(run.runId, {
        state: stateRef.current,
        worldVersion: run.worldVersion,
        progression: progressionRef.current,
        automap: automapVisitedRef.current,
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [ready, state, automapVisitedByMap]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, []);

  const exitChronicles = useCallback(() => {
    chroniclesClearPlayingRun();
    void releaseChroniclesLandscape();
    const current = stateRef.current;
    const runId = activeRunIdRef.current;
    const terminal = current?.phase === 'defeated' || current?.phase === 'escaped';
    if (terminal && runId) {
      finishChroniclesRun(FIRST_PERSON_RUN_SCOPE, runId);
      clearChroniclesAutomapVisited(runId);
    }
    // Active runs remain resumable across first-person/Tactics. Terminal runs
    // are explicitly retired locally so re-entry starts a fresh expedition.
    activeRunIdRef.current = null;
    onExit?.();
  }, [onExit]);

  useEscapeToClose(() => {
    // The document Back handler runs BEFORE the spell/objects folio's window
    // Escape handler. Dismiss the topmost visible panel without opening the
    // adventure menu underneath. The same priority applies to browser Back.
    const action = chroniclesFirstPersonEscapeAction({
      menuOpen, confirmExitWithoutSaving, confirmLoadSelection, feedbackOpen, spellMenuOpen, adminOpen,
      sheetOpen: Boolean(sheetMemberId),
      shopOpen: Boolean(stateRef.current?.shop),
      guildOpen: Boolean(stateRef.current?.guild), innOpen: Boolean(stateRef.current?.inn),
      audienceOpen: Boolean(audienceRef.current), automapOpen, journalOpen, quickStatusOpen,
    });
    if (action === 'cancel-exit') setConfirmExitWithoutSaving(false);
    else if (action === 'cancel-load') { if (!saveBusy) setConfirmLoadSelection(false); }
    else if (action === 'back-feedback') setFeedbackOpen(false);
    else if (action === 'close-sheet') setSheetMemberId(null);
    else if (action === 'close-inn') dispatch({ type: 'inn-close' });
    else if (action === 'close-shop') dispatch({ type: 'shop-close' });
    else if (action === 'close-guild') dispatch({ type: 'guild-close' });
    else if (action === 'close-spell') setSpellMenuOpen(false);
    else if (action === 'close-admin') setAdminOpen(false);
    else if (action === 'close-audience') { audienceRef.current = null; setAudience(null); }
    else if (action === 'close-automap') setAutomapOpen(false);
    else if (action === 'close-journal') setJournalOpen(false);
    else if (action === 'close-quick-status') setQuickStatusOpen(false);
    else {
      // Focus the gem only when opening. Blurring when closing prevents a
      // stale keyboard outline around an inactive menu (Tab -> Esc).
      if (menuOpen) chroniclesReleaseAdventureMenuFocus(menuSummaryRef.current?.parentElement);
      else menuSummaryRef.current?.focus();
      setMenuOpen((open) => !open);
    }
  }, { contextMenu: false, disabled: chronicleModalOpen || Boolean(areaTransition) || Boolean(pendingSpellTarget) });

  const confirmCharacterBuild = useCallback((build) => {
    void requestChroniclesLandscapeOnEntry();
    const selected = chroniclesFreshExpeditionProgression(build);
    if (!selected.updated) return;
    const saved = selected.progression;
    // A new run owns its XP; never overwrite the account's legacy/Tactics
    // progression, which older saved runs may still need for recovery.
    runProgressionActiveRef.current = true;
    chroniclesRememberPlayingRun(FIRST_PERSON_RUN_SCOPE, ensureChroniclesRun(FIRST_PERSON_RUN_SCOPE));
    progressionRef.current = saved;
    stateRef.current = null;
    staleRunRecoveryAttemptedRef.current = false;
    setProgression(saved);
    setSelectedMemberId('matthias');
    setSheetMemberId(null);
    setState(null);
    setReady(false);
    setBootstrapError(null);
    setRendererError('');
    setAutomapOpen(false);
    setAutomapVisitedByMap({});
    setCharacterSetupDone(true);
    setEntryView('playing');
    setBootstrapRevision((revision) => revision + 1);
  }, []);

  const retryBootstrap = useCallback(() => {
    staleRunRecoveryAttemptedRef.current = false;
    stateRef.current = null;
    setState(null);
    setReady(false);
    setBootstrapError(null);
    setRendererError('');
    setBootstrapRevision((revision) => revision + 1);
  }, []);

  const dispatch = useCallback((action, acceptedTravel = false) => {
    const current = stateRef.current;
    if (!current) return;
    // Never open a doorway/area prompt for a combat step. Enforce before
    // transition detection, not only in the reducer below.
    if (chroniclesCombatPartyStepBlocked(current, action)) return current;
    // No world input while the counter is open, except the confirmed sale.
    if (provisionsOpenRef.current && !(action?.type === 'interact'
      && action?.provisionsPurchase === true)) return current;
    // The pending choice owns movement until it is answered. No turns,
    // encounters or checkpoint may run while the prompt is on screen.
    if (areaTransitionRef.current && !acceptedTravel) return current;
    if (!acceptedTravel) {
      const intent = chroniclesAreaTransitionIntent(current, action);
      if (intent) {
        const actionType = typeof action === 'string' ? action : action?.type;
        const isStep = ['forward', 'backward', 'strafe-left', 'strafe-right'].includes(actionType);
        // Occupy the exit tile BEFORE asking. «No» never rewinds the party.
        // The actual area effects are deferred until «Sí».
        const atThreshold = isStep
          ? chroniclesReduce(current, { type: actionType, deferAreaTransition: true })
          : current;
        if (isStep && (atThreshold.mapId !== current.mapId
          || (atThreshold.x === current.x && atThreshold.y === current.y))) return current;
        const crossing = isStep || intent.atThreshold
          ? { type: 'cross-area-threshold', exitId: intent.exitId }
          : action;
        areaTransitionRef.current = { action: crossing, sourceState: atThreshold };
        if (atThreshold !== current) {
          stateRef.current = atThreshold;
          setState(atThreshold);
        }
        setAreaTransition(intent);
        // Touch controls may be held; prevent their delayed repeat after Yes/No.
        const hold = touchHoldRef.current;
        if (hold.delayId !== null) window.clearTimeout(hold.delayId);
        if (hold.repeatId !== null) window.clearInterval(hold.repeatId);
        touchHoldRef.current = { delayId: null, repeatId: null };
        return atThreshold;
      }
    }

    const actionType = typeof action === 'string' ? action : action?.type;
    // The campaign epilogue is a decision screen: nothing moves behind it.
    if (chroniclesCampaignEpiloguePending(current)) return current;
    // A held touch control must not keep moving the expedition behind an NPC.
    // The deliberate dialogue quest option alone may invoke 'interact'.
    if (audienceRef.current && actionType !== 'interact') return current;
    // A door in an MM3 town opens an audience instead of silently awarding
    // a quest from a stone wall. One more step into the facade enters.
    if (actionType === 'forward' && !current.initiative && current.phase === 'explore') {
      const face = CHRONICLES_DIRECTIONS[current.direction];
      const map = chroniclesMapForState(current);
      const nextTile = face ? map?.grid?.[current.y + face.dy]?.[current.x + face.dx] : null;
      // Walking into any cell of a house's door facade is walking through its door.
      const atDoor = nextTile === '#' ? (chroniclesBuildingEntryState(current) || current) : current;
      const dialogue = nextTile === '#' ? chroniclesNpcDialogueForState(
        atDoor, chroniclesContextualContentAction(atDoor),
      ) : null;
      if (atDoor !== current && chroniclesContextualContentAction(atDoor)?.id === CHRONICLES_QUARTERMASTER_ID) {
        stateRef.current = atDoor;
        setState(atDoor);
        openProvisions();
        return atDoor;
      }
      if (dialogue) {
        if (atDoor !== current) {
          stateRef.current = atDoor;
          setState(atDoor);
        }
        audienceRef.current = dialogue;
        setAudience(dialogue);
        return atDoor;
      }
    }
    if (actionType === 'equip-item' || actionType === 'unequip-item'
      || actionType === 'shop-buy' || actionType === 'shop-sell' || actionType === 'shop-close'
      || actionType === 'guild-join' || actionType === 'guild-learn' || actionType === 'guild-close'
      || actionType === 'track-quest' || actionType === 'transfer-item') {
      const updated = chroniclesReduce(current, action);
      if (updated !== current) {
        stateRef.current = updated;
        setState(updated);
      }
      return updated; // Synchronous result lets shop feedback verify completed trades.
    }
    const activeActor = chroniclesCurrentInitiativeActor(current.initiative);
    if (current.initiative && activeActor?.kind === 'enemy') return;
    if (
      current.initiative
      && (actionType === 'attack' || actionType === 'cast' || actionType === 'use-item')
      && activeActor?.kind === 'party'
      && typeof action === 'object'
      && action.memberId !== activeActor.id
    ) return;

    let next;
    if (!current.initiative) {
      // An offensive spell or scroll opens combat exactly like a swing, at
      // its own reach (Paralizar counts: it is an act of war too).
      const offensiveSpell = actionType === 'cast' && ['attack', 'paralyze'].includes(CHRONICLES_SPELLS[action.spellId]?.kind)
        ? CHRONICLES_SPELLS[action.spellId]
        : actionType === 'use-item' && CHRONICLES_CONSUMABLES[action.itemId]?.kind === 'scroll'
          ? CHRONICLES_CONSUMABLES[action.itemId].spell
          : null;
      const openingVolley = actionType === 'volley' && current.combatRules === 'mm3';
      const offensive = actionType === 'attack' || openingVolley || Boolean(offensiveSpell);
      // A collective salvo lands before combat is deployed. No separate
      // retaliation or initiative action is spent by each archer.
      const exploratoryNext = openingVolley
        ? chroniclesReduce(current, action)
        : offensive ? current : chroniclesGridExplorationStep(current, action);
      const attackingMember = offensive && typeof action === 'object'
        ? current.party.find((member) => member.id === action.memberId)
        : null;
      const forcedTarget = attackingMember
        ? chroniclesEnemyTargetAhead(current, offensiveSpell && current.combatRules === 'mm3'
          ? chroniclesMM3MissileSightReach(current)
          : offensiveSpell?.reach ?? chroniclesPartyAttackStats(current, attackingMember.id, action.mode || 'auto').reach)
        : null;
      // Entering an area is not a tactical movement inside it. The player
      // gets to see the new room/return portal before enemies can engage.
      const transitionedMap = exploratoryNext?.mapId !== current.mapId;
      // A real opening volley engages initiative on its target. If it
      // shoots empty air, aware creatures still get a movement tick.
      const started = transitionedMap ? exploratoryNext : openingVolley
        ? chroniclesAdvanceOpeningVolley(current, exploratoryNext)
        : chroniclesStartInitiativeCombat(
          exploratoryNext,
          chroniclesActiveEnemies(exploratoryNext),
          {
            forceEnemyIds: forcedTarget && Number(exploratoryNext[forcedTarget.enemy.hpKey] || 0) > 0 ? [forcedTarget.enemy.id] : [],
          },
        );
      next = started !== exploratoryNext
        ? started
        : offensive
          ? openingVolley ? exploratoryNext : chroniclesReduce(current, action)
          : exploratoryNext;
      // Movement/turning have already advanced through GridExplorationStep.
      // Offensive actions run a separate path; give enemies their single
      // exploration tick only if the action spent time without initiating.
      if (offensive && !next.initiative && Number(next.turns) > Number(current.turns)) {
        next = chroniclesAdvanceExplorationEnemies(current, next);
        if (!transitionedMap) {
          next = chroniclesStartInitiativeCombat(next, chroniclesActiveEnemies(next));
        }
      }
    } else {
      next = chroniclesReduce(current, action);
      // A refused cast or item (no spell points, no target) keeps the hero's turn.
      const spentTurn = (actionType !== 'cast' && actionType !== 'use-item') || next.turns !== current.turns;
      if (next !== current && spentTurn && next.phase !== 'defeated' && next.phase !== 'escaped') {
        next = chroniclesAdvanceCombatInitiative(next, chroniclesActiveEnemies(next));
      }
    }

    // Opening volleys are one action with several real damage contributors.
    // The selected hero might not even carry a bow, so never give them all XP.
    const volleyResult = actionType === 'volley' && !current.initiative
      ? chroniclesOpeningVolleyShots(current)
      : null;
    const lastDamagingShooter = volleyResult?.shots.filter((shot) => shot.damage > 0).at(-1)?.memberId;
    const actorMemberId = lastDamagingShooter || (typeof action === 'object' && action?.memberId
      ? action.memberId
      : activeActor?.kind === 'party'
        ? activeActor.id
        : selectedMemberIdRef.current);
    const progressResult = applyChroniclesTacticsProgression(
      progressionRef.current,
      current,
      next,
      {
        actorMemberId,
        actionKind: actionType,
        volleyContributions: volleyResult ? {
          enemyId: volleyResult.target?.id,
          shots: volleyResult.shots,
        } : null,
        runId: activeRunIdRef.current,
      },
    );
    if (progressResult.awards.length || progressResult.levelUps.length) {
      // XP and attribute gains remain in this session until Save / area exit.
      progressionRef.current = progressResult.progression;
      setProgression(progressResult.progression);
      next = {
        ...reconcileChroniclesProgressionInTacticsState(next, progressResult.progression),
        runProgression: progressResult.progression,
      };
    }

    if (progressResult.levelUps.length) showPortraitLevelUps(progressResult.levelUps, next.party, next);
    if (next !== current) pendingActionSoundRef.current = {
      previous: current, resolved: next, committed: next, action,
    };
    stateRef.current = next;
    setState(next);
    showLootNotice(chroniclesLootNotice(current, next, action));

    const bark = chroniclesPartyBark(current, next);
    if (bark) {
      const token = partyBarkSequenceRef.current + 1;
      partyBarkSequenceRef.current = token;
      if (partyBarkTimerRef.current) clearTimeout(partyBarkTimerRef.current);
      setPartyBark({ ...bark, token });
      // Long remarks (why a door will not open) stay up long enough to read.
      partyBarkTimerRef.current = setTimeout(() => {
        setPartyBark((active) => active?.token === token ? null : active);
      }, Math.max(7500, String(bark.text || '').length * 65));
    }

    showHitSplats(current, next);

    const cue = chroniclesRetaliationCue(current, next);
    if (cue) {
      const token = retaliationSequenceRef.current + 1;
      retaliationSequenceRef.current = token;
      if (retaliationTimerRef.current) clearTimeout(retaliationTimerRef.current);
      setRetaliationCue({ ...cue, token });
      retaliationTimerRef.current = setTimeout(() => {
        setRetaliationCue((active) => active?.token === token ? null : active);
      }, 1800);
    }
    return next;
  }, [showHitSplats, showLootNotice, showPortraitLevelUps, openProvisions]);

  const cancelAreaTravel = useCallback(() => {
    areaTransitionRef.current = null;
    setAreaTransition(null);
  }, []);

  const acceptAreaTravel = useCallback(() => {
    const pending = areaTransitionRef.current;
    if (!pending) return;
    areaTransitionRef.current = null;
    setAreaTransition(null);
    // If another subsystem changed the state, do not execute a stale move.
    if (stateRef.current === pending.sourceState) dispatch(pending.action, true);
  }, [dispatch]);

  useEffect(() => {
    if (areaTransition && state !== areaTransitionRef.current?.sourceState) {
      cancelAreaTravel();
    }
  }, [areaTransition, state, cancelAreaTravel]);

  const clearTouchHold = useCallback(() => {
    const active = touchHoldRef.current;
    if (active.delayId !== null) window.clearTimeout(active.delayId);
    if (active.repeatId !== null) window.clearInterval(active.repeatId);
    touchHoldRef.current = { delayId: null, repeatId: null };
  }, []);

  const startTouchHold = useCallback((action, event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    clearTouchHold();

    const current = stateRef.current;
    if (!current || current.phase === 'defeated' || current.phase === 'escaped'
      || chroniclesCombatPartyStepBlocked(current, action)) return;

    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture is a comfort feature only; input remains valid without it.
    }

    dispatch(action);
    if (areaTransitionRef.current || current.initiative) return;

  }, [clearTouchHold, dispatch]);

  const activateTouchAction = useCallback((action, event) => {
    // Pointer input already fires on pointerdown so taps feel immediate. Keyboard
    // and assistive activation arrive as click(detail=0) and still get one action.
    if (event.detail === 0) dispatch(action);
  }, [dispatch]);

  useEffect(() => {
    const current = stateRef.current;
    const actor = chroniclesCurrentInitiativeActor(current?.initiative);
    if (sheetMemberId || !current?.initiative || actor?.kind !== 'enemy' || current.phase === 'defeated') return undefined;

    const timer = window.setTimeout(() => {
      const latest = stateRef.current;
      const latestActor = chroniclesCurrentInitiativeActor(latest?.initiative);
      if (!latest?.initiative || latestActor?.kind !== 'enemy' || latestActor.id !== actor.id) return;
      const acted = chroniclesResolveEnemyActor(latest, actor.id);
      // Enemy initiative bypasses dispatch; it must share the same post-commit
      // audio/visual pipeline as player attacks, including actual blood splats.
      const cue = chroniclesRetaliationCue(latest, acted);
      if (cue) {
        const token = retaliationSequenceRef.current + 1;
        retaliationSequenceRef.current = token;
        if (retaliationTimerRef.current) clearTimeout(retaliationTimerRef.current);
        setRetaliationCue({ ...cue, token });
        retaliationTimerRef.current = setTimeout(() => {
          setRetaliationCue((active) => active?.token === token ? null : active);
        }, 1800);
      }
      const advanced = acted.phase === 'defeated'
        ? acted
        : chroniclesAdvanceCombatInitiative(acted, chroniclesActiveEnemies(acted));
      showHitSplats(latest, acted);
      pendingActionSoundRef.current = {
        previous: latest,
        resolved: acted,
        committed: advanced,
        action: { type: 'enemy-turn', enemyId: actor.id },
      };
      stateRef.current = advanced;
      setState(advanced);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [sheetMemberId, state?.initiative?.cursor, state?.initiative?.round, state?.phase, showHitSplats]);

  useEffect(() => {
    const actor = chroniclesCurrentInitiativeActor(state?.initiative);
    if (actor?.kind !== 'party' || actor.id === selectedMemberIdRef.current) return;
    selectedMemberIdRef.current = actor.id;
    setSelectedMemberId(actor.id);
  }, [state?.initiative?.cursor, state?.initiative?.round]);

  const interactWithContext = useCallback(() => {
    const current = stateRef.current;
    if (!current || current.phase === 'defeated' || current.phase === 'escaped') return;
    // Using an exit underfoot retries the same crossing, even if another
    // NPC or building happens to be within interaction range.
    if (chroniclesAreaTransitionIntent(current, 'interact')) {
      dispatch('interact');
      return;
    }
    const rawContextual = chroniclesContextualContentAction(current);
    const rawDialogue = chroniclesNpcDialogueForState(current, rawContextual);
    const { contextual, npc: dialogue } = chroniclesDoorwayPrompt(current, rawContextual, rawDialogue);
    if (!contextual && !dialogue) return;
    const board = chroniclesMapForState(current)?.interactables?.find((entry) => entry.id === contextual?.id);
    if (board?.visualType === 'notice-board') {
      setNoticeBoardOpen(true);
      return;
    }
    if (dialogue) {
      audienceRef.current = dialogue;
      setAudience(dialogue);
      return;
    }
    if (contextual?.id === CHRONICLES_QUARTERMASTER_ID) {
      openProvisions();
      return;
    }
    dispatch('interact');
  }, [dispatch, openProvisions]);

  // mode: 'auto' (botón táctil), 'melee' (A · atacar), 'missile' (S · disparar).
  const attackWithSelected = useCallback((mode = 'auto') => {
    const current = stateRef.current;
    if (!current || current.phase === 'defeated' || current.phase === 'escaped'
      || (mode === 'melee' && !current.initiative)) return;
    const initiativeActor = chroniclesCurrentInitiativeActor(current.initiative);
    if (initiativeActor?.kind === 'enemy') return;
    const memberId = initiativeActor?.kind === 'party'
      ? initiativeActor.id
      : selectedMemberIdRef.current;
    const member = current.party.find((candidate) => candidate.id === memberId);
    if (mode === 'missile') {
      const refusal = chroniclesMissileRefusal(current, memberId);
      if (refusal) { showMissileNotice(refusal); return; }
    }
    const startsCombat = !current.initiative
      && member
      && chroniclesEnemyTargetAhead(current, chroniclesPartyAttackStats(current, member.id, mode).reach);
    if (!startsCombat) chroniclesPlayAttackPresentation(engineRef.current, current, memberId, mode);
    dispatch(mode === 'auto' ? { type: 'attack', memberId } : { type: 'attack', memberId, mode });
  }, [dispatch, showMissileNotice]);

  const blockWithActive = useCallback(() => {
    const current = stateRef.current;
    if (!current || current.combatRules !== 'mm3' || !current.initiative) return;
    const actor = chroniclesCurrentInitiativeActor(current.initiative);
    if (actor?.kind !== 'party' || !current.party.some((hero) => hero.id === actor.id && hero.hp > 0)) return;
    dispatch({ type: 'block', memberId: actor.id });
  }, [dispatch]);

  // S is a company volley before initiative; once engaged it is the
  // current hero's ordinary missile attack.
  const shootWithParty = useCallback(() => {
    const current = stateRef.current;
    if (!current || current.phase === 'defeated' || current.phase === 'escaped') return;
    if (current.initiative || current.combatRules !== 'mm3') {
      attackWithSelected('missile');
      return;
    }
    const refusal = chroniclesMissileRefusal(current);
    if (refusal) { showMissileNotice(refusal); return; }
    // An empty corridor still gets actual visible launches from armed heroes.
    // Only the combat reducer decides whether those shots hit anything.
    const shooterIds = chroniclesVolleyPresentationShooterIds(current);
    if (shooterIds.length) {
      if (engineRef.current?.playVolley) engineRef.current.playVolley(shooterIds);
      else engineRef.current?.playAttack?.(shooterIds[0]);
    }
    dispatch({ type: 'volley' });
  }, [attackWithSelected, dispatch, showMissileNotice]);

  const applyLiveProgression = useCallback((nextProgression) => {
    // Character-sheet spending is also part of the player's next saved game.
    progressionRef.current = nextProgression;
    setProgression(nextProgression);
    const current = stateRef.current;
    if (!current) return;
    const reconciled = {
      ...reconcileChroniclesProgressionInTacticsState(current, nextProgression),
      runProgression: nextProgression,
    };
    stateRef.current = reconciled;
    setState(reconciled);
  }, []);

  const allocateAttribute = useCallback((memberId, attributeKey) => {
    const result = spendChroniclesAttributePoint(progressionRef.current, memberId, attributeKey);
    if (!result.spent) return;
    applyLiveProgression(result.progression);
  }, [applyLiveProgression]);

  const learnSkill = useCallback((memberId, skillId) => {
    const result = unlockChroniclesSkill(progressionRef.current, memberId, skillId);
    if (!result.unlocked) return;
    applyLiveProgression(result.progression);
  }, [applyLiveProgression]);

  const openMemberSheet = useCallback((memberId, initialFolio = 'record') => {
    clearTouchHold();
    setAutomapOpen(false);
    setMenuOpen(false);
    const actor = chroniclesCurrentInitiativeActor(stateRef.current?.initiative);
    if (actor?.kind !== 'party' || actor.id === memberId) {
      selectedMemberIdRef.current = memberId;
      setSelectedMemberId(memberId);
    }
    setSheetInitialFolio(initialFolio === 'equipment' ? 'equipment' : 'record');
    setSheetMemberId(memberId);
  }, [clearTouchHold]);

  const restart = useCallback(() => {
    chroniclesClearPlayingRun();
    if (activeRunIdRef.current) {
      clearChroniclesAutomapVisited(activeRunIdRef.current);
      finishChroniclesRun(FIRST_PERSON_RUN_SCOPE, activeRunIdRef.current);
      activeRunIdRef.current = null;
    }
    stateRef.current = null;
    setState(null);
    setSelectedMemberId('matthias');
    setSheetMemberId(null);
    setReady(false);
    setBootstrapError(null);
    setRendererError('');
    setAutomapOpen(false);
    setAutomapVisitedByMap({});
    staleRunRecoveryAttemptedRef.current = false;
    if (retaliationTimerRef.current) clearTimeout(retaliationTimerRef.current);
    retaliationTimerRef.current = null;
    setRetaliationCue(null);
    if (partyBarkTimerRef.current) clearTimeout(partyBarkTimerRef.current);
    partyBarkTimerRef.current = null;
    setPartyBark(null);
    setBootstrapRevision((revision) => revision + 1);
  }, []);

  useEffect(() => () => {
    clearTouchHold();
    if (retaliationTimerRef.current) clearTimeout(retaliationTimerRef.current);
    if (partyBarkTimerRef.current) clearTimeout(partyBarkTimerRef.current);
  }, [clearTouchHold]);

  useEffect(() => {
    if (!characterSetupDone || entryView !== 'playing' || !progressionSynced) return undefined;
    const controller = new AbortController();
    let active = true;

    setBootstrapError(null);
    const operationId = ensureChroniclesRun(FIRST_PERSON_RUN_SCOPE);
    const remoteSelection = chroniclesSelectedRunIsRemote(FIRST_PERSON_RUN_SCOPE, operationId);
    activeRunIdRef.current = operationId;
    chroniclesRememberPlayingRun(FIRST_PERSON_RUN_SCOPE, operationId);

    // Overlap renderer chunk loading with the authoritative world bootstrap.
    // Gameplay still stays fail-closed until the backend bundle validates.
    void loadChroniclesFirstPersonRenderer().catch(() => {});

    const activeProgression = progressionRef.current;
    chroniclesBootstrapWorld({
      mapId: chroniclesRunEntryMapId(FIRST_PERSON_RUN_SCOPE),
      signal: controller.signal,
      operationId,
      resumeRunId: remoteSelection ? operationId : null,
      partyLevel: chroniclesDeployedPartyLevel(activeProgression),
    })
      .then((world) => {
        if (!active) return;
        const savedRunProgression = chroniclesCheckpointRunProgression(world);
        const runProgression = savedRunProgression || activeProgression;
        const progressed = applyChroniclesProgressionToTacticsState(
          createChroniclesState(null, runProgression.characterBuild, { rules: 'mm3' }),
          runProgression,
        );
        const restored = chroniclesReconcileCurrentMapEnemyHp(chroniclesApplyRunCheckpoint(progressed, world));
        // The run id seeds every MM3 die so F5 never rerolls a blow.
        let next = {
          ...chroniclesApplyArrival(restored),
          runSeed: world.runId,
          runProgression,
        };
        const confirmedId = chroniclesMarkSavedRunRemote(FIRST_PERSON_RUN_SCOPE, operationId, world.runId);
        if (!confirmedId) return;
        activeRunIdRef.current = confirmedId;
        chroniclesRememberPlayingRun(FIRST_PERSON_RUN_SCOPE, confirmedId);
        authoritativeRunRef.current = world;
        progressionRef.current = runProgression;
        setProgression(runProgression);
        // Record the authoritative bootstrap as our comparison baseline.
        // New runs have no durable checkpoint until an explicit Save or area exit.
        checkpointFingerprintRef.current = chroniclesRunCheckpointFingerprint(restored);
        checkpointExistsRef.current = remoteSelection || Number(world.worldVersion || 0) > 0;
        // A reload resumes this tab's own copy, unless the server saw a newer save.
        const resumed = chroniclesLoadSessionResume(confirmedId, world.worldVersion);
        if (resumed) {
          // Session snapshots from before a town gained new enemies can miss
          // their HP keys. The rendering and targeting contracts must agree.
          const resumedProgression = resumed.progression || runProgression;
          next = {
            ...chroniclesReconcileCurrentMapEnemyHp(resumed.state),
            runSeed: world.runId,
            runProgression: resumedProgression,
          };
          progressionRef.current = resumedProgression;
          setProgression(resumedProgression);
        }
        checkpointMapRef.current = next.mapId;
        setAutomapVisitedByMap(resumed?.automap || loadChroniclesAutomapVisited(confirmedId));
        stateRef.current = next;
        staleRunRecoveryAttemptedRef.current = false;
        setSelectedMemberId('matthias');
        setState(next);
        setBootstrapError(null);
        setRendererError('');
        setReady(true);
      })
      .catch((error) => {
        if (!active || error?.code === CHRONICLES_BOOTSTRAP_ERROR_CODES.aborted) return;
        if (error?.status === 409 && !remoteSelection && !staleRunRecoveryAttemptedRef.current) {
          staleRunRecoveryAttemptedRef.current = true;
          clearChroniclesAutomapVisited(operationId);
          chroniclesClearSessionResume(operationId);
          const replacementRunId = renewChroniclesRun(FIRST_PERSON_RUN_SCOPE, operationId);
          activeRunIdRef.current = replacementRunId;
          chroniclesRememberPlayingRun(FIRST_PERSON_RUN_SCOPE, replacementRunId);
          setReady(false);
          setBootstrapError(null);
          setBootstrapRevision((revision) => revision + 1);
          return;
        }
        stateRef.current = null;
        setState(null);
        setReady(false);
        setBootstrapError(error);
      });

    return () => {
      active = false;
      controller.abort();
      chroniclesClearRuntimeMapDefinitions();
    };
  }, [bootstrapRevision, characterSetupDone, entryView, progressionSynced]);

  // A ready React tree or an empty canvas is not a painted scene.
  useLayoutEffect(() => {
    let cancelled = false;
    let painted = false;
    let engine = null;
    const host = hostRef.current;
    if (!ready || !stateRef.current || !host) return undefined;
    setScenePainted(false);
    let watchdog;
    const armWatchdog = () => {
      watchdog = window.setTimeout(() => {
        if (cancelled || painted) return;
        // Browsers legitimately suspend WebGL while the tab is hidden.
        // Never turn background-tab time into a false renderer failure.
        if (document.visibilityState === 'hidden') {
          armWatchdog();
          return;
        }
        setRendererError('La escena 3D no consiguió dibujar su primer fotograma. Reintenta.');
      }, 20000);
    };
    armWatchdog();

    void loadChroniclesFirstPersonRenderer()
      .then(({ createChroniclesOfMatthiasGame }) => {
        if (cancelled) return;
        engine = createChroniclesOfMatthiasGame(host, {
          initialState: stateRef.current,
          onFirstFrame: () => {
            if (cancelled || painted) return;
            painted = true;
            window.clearTimeout(watchdog);
            setScenePainted(true);
          },
          onContentClick: (contentId) => {
            const current = stateRef.current;
            const contextual = chroniclesDoorwayPrompt(
              current, chroniclesContextualContentAction(current), null,
            ).contextual;
            if (contextual?.id !== contentId) return;
            interactWithContext();
          },
        });
        engineRef.current = engine;
        engine.renderState(stateRef.current);
      })
      .catch((error) => {
        console.error('Chronicles of Matthias Three.js boot failed', error);
        if (!cancelled) {
          window.clearTimeout(watchdog);
          setRendererError('La cripta se ha negado a materializarse. La escena no ha podido arrancar.');
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
      engine?.destroy();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [dispatch, interactWithContext, ready, state?.mapId]);

  useEffect(() => { engineRef.current?.renderState(state); }, [state]);

  const persistCheckpoint = useCallback((snapshot, reason = 'manual') => {
    const requestedRunId = authoritativeRunRef.current?.runId;
    if (!snapshot || !requestedRunId) return Promise.resolve(false);
    // Check both the requested snapshot and the live world before queueing.
    // Keyboard S, Save/Exit, Save-before-load and area transitions share
    // this single authority, regardless of what the menu renders.
    if (!chroniclesCanCheckpoint(snapshot) || !chroniclesCanCheckpoint(stateRef.current)) {
      if (reason === 'manual') setSaveNotice(CHRONICLES_COMBAT_SAVE_NOTICE);
      return Promise.resolve(false);
    }
    // Snapshot progression alongside world state, not in the shared profile.
    // Including it in the fingerprint makes leveling a durable change.
    const stagedProgression = progressionRef.current;
    const stagedSnapshot = { ...snapshot, runProgression: stagedProgression };
    const fingerprint = chroniclesRunCheckpointFingerprint(stagedSnapshot);
    if (!fingerprint) return Promise.resolve(false);
    const visited = chroniclesAutomapMarkSeen(
      automapVisitedRef.current, chroniclesMapForState(snapshot), snapshot,
    );
    checkpointPendingRef.current += 1;
    setSaveBusy(true);
    setSaveNotice('');
    const request = checkpointQueueRef.current.catch(() => undefined).then(async () => {
      const currentRun = authoritativeRunRef.current;
      if (!currentRun?.runId || currentRun.runId !== requestedRunId) return false;
      // A queued write may not start if the party entered combat while it
      // was waiting on a previous checkpoint.
      if (!chroniclesCanCheckpoint(stateRef.current)) {
        if (reason === 'manual') setSaveNotice(CHRONICLES_COMBAT_SAVE_NOTICE);
        return false;
      }
      // A pristine first-person run must still write its *first* checkpoint.
      // Equal fingerprints only permit skipping a write if a durable
      // authoritative world snapshot already exists.
      if (!checkpointExistsRef.current || fingerprint !== checkpointFingerprintRef.current) {
        const updated = await chroniclesCheckpointState(
          requestedRunId, stagedSnapshot, currentRun.worldVersion,
          {
            terminalStatus: snapshot.phase === 'escaped' ? 'completed' : null,
            adminTravel: Boolean(snapshot[CHRONICLES_ADMIN_TRAVEL_KEY]),
          },
        );
        if (snapshot[CHRONICLES_ADMIN_TRAVEL_KEY] && stateRef.current?.[CHRONICLES_ADMIN_TRAVEL_KEY]) {
          const { [CHRONICLES_ADMIN_TRAVEL_KEY]: _done, ...settled } = stateRef.current;
          stateRef.current = settled;
          setState(settled);
        }
        if (authoritativeRunRef.current?.runId !== requestedRunId) return false;
        authoritativeRunRef.current = { ...currentRun, ...updated };
        checkpointFingerprintRef.current = fingerprint;
      }
      // The remote run commit must succeed before profile and automap progress
      // become durable; failures leave both staged for a later manual retry.
      checkpointExistsRef.current = true;
      saveChroniclesAutomapVisited(requestedRunId, visited);
      chroniclesNoteSavedRunCheckpoint(FIRST_PERSON_RUN_SCOPE, requestedRunId, snapshot.mapId);
      if (reason === 'manual') setSaveNotice('Partida guardada correctamente.');
      return true;
    }).catch((error) => {
      console.error('Chronicles checkpoint failed', error);
      setSaveNotice('No se pudo guardar la partida. Reinténtalo antes de salir.');
      if (error?.status === 409) {
        setReady(false);
        setBootstrapError(error);
      }
      return false;
    }).finally(() => {
      checkpointPendingRef.current = Math.max(0, checkpointPendingRef.current - 1);
      if (checkpointPendingRef.current === 0) setSaveBusy(false);
    });
    checkpointQueueRef.current = request;
    return request;
  }, []);

  // No per-move/per-attack/per-dialogue autosave. Transitioning to another
  // map is the only automatic checkpoint, per the MM3 save contract.
  useEffect(() => {
    if (!ready || !state?.mapId) return;
    const previousMapId = checkpointMapRef.current;
    checkpointMapRef.current = state.mapId;
    if (chroniclesCheckpointReason(previousMapId, state.mapId) === 'area-change') {
      void persistCheckpoint(state, 'area-change');
    }
  }, [ready, state?.mapId, persistCheckpoint]);

  // The throne decided the ending: keep exploring Terra (the run stays
  // active) or close the chronicle (the run is completed for good). Either
  // way the choice is checkpointed at once so a reload does not undo it.
  const resolveCampaignEpilogue = useCallback((closeChronicle) => {
    const current = stateRef.current;
    if (!chroniclesCampaignEpiloguePending(current)) return;
    const next = {
      ...current,
      [CHRONICLES_EPILOGUE_SEEN_KEY]: true,
      ...(closeChronicle ? { phase: 'escaped' } : {}),
    };
    stateRef.current = next;
    setState(next);
    void persistCheckpoint(next, 'epilogue');
  }, [persistCheckpoint]);

  const saveAndExit = useCallback(async () => {
    if (saveBusy) return;
    const saved = await persistCheckpoint(stateRef.current, 'manual');
    if (saved) exitChronicles();
  }, [exitChronicles, persistCheckpoint, saveBusy]);

  const discardAndExit = useCallback(() => {
    chroniclesClearSessionResume(activeRunIdRef.current);
    // Exiting the game never waits for DELETE: a failed/slow server request
    // must not trap the player inside Chronicles. Checkpoint cleanup remains
    // serialized and never removes an existing durable area/manual save.
    void chroniclesDiscardAndExit({
      runId: activeRunIdRef.current,
      checkpointQueue: checkpointQueueRef.current,
      hasCheckpoint: () => checkpointExistsRef.current,
      deleteRun: chroniclesDeleteRemoteRun,
      forgetRun: (runId) => chroniclesForgetSavedRun(FIRST_PERSON_RUN_SCOPE, runId),
      exit: exitChronicles,
      onCleanupError: (error) => {
        // Preserve the server/local entry on transient failures so players
        // can retry deletion from the save book without losing a real run.
        console.warn('Chronicles: exit completed; unsaved run cleanup deferred', error);
      },
    });
  }, [exitChronicles]);

  const chooseSpellTarget = useCallback((targetId) => {
    const pending = pendingSpellTarget;
    const current = stateRef.current;
    if (!pending || !current) return;
    const spell = CHRONICLES_SPELLS[pending.spellId];
    const caster = current.party.find((hero) => hero.id === pending.memberId);
    const target = current.party.find((hero) => hero.id === targetId);
    const actor = chroniclesCurrentInitiativeActor(current.initiative);
    if (!spell || spell.kind !== 'heal' || spell.everyone || !caster || caster.hp <= 0
      || (actor && (actor.kind !== 'party' || actor.id !== caster.id))) {
      setPendingSpellTarget(null);
      setSpellTargetNotice('');
      return;
    }
    const status = chroniclesHealTargetStatus(target);
    if (status === 'fallen') {
      setSpellTargetNotice('A 0 PV necesita resurrección, no curación.');
      return;
    }
    setPendingSpellTarget(null);
    setSpellTargetNotice('');
    dispatch({ type: 'cast', memberId: caster.id, spellId: spell.id, targetId: target.id });
  }, [dispatch, pendingSpellTarget]);

  useEffect(() => {
    if (!ready || !stateRef.current) return undefined;
    const onKeyDown = (event) => {
      const current = stateRef.current;
      if (!current || event.defaultPrevented
        || event.ctrlKey || event.altKey || event.metaKey) return;
      if (provisionsOpenRef.current) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeProvisions();
        } else if (event.key !== 'Tab') event.preventDefault();
        return;
      }
      // Form fields retain keyboard input. Shift+Tab navigates normally.
      // Plain Tab on the focused menu gem toggles it; inside folio controls,
      // native Tab still navigates and cannot discard a draft or save.
      const target = event.target;
      const isEditing = target?.isContentEditable
        || target?.closest?.('input, textarea, select, [contenteditable="true"]');
      // The open menu owns Escape even while a volume slider has focus;
      // typing S/Q into an input must never invoke save/quit.
      if (isEditing && !(menuOpen && event.key === 'Escape')) return;
      if (areaTransitionRef.current) {
        if (event.key === 'Tab') return;
        event.preventDefault();
        if (event.repeat) return;
        const selected = document.activeElement?.matches?.('[data-area-transition-accept]')
          ? 'accept' : 'cancel';
        const decision = chroniclesAreaTravelKeyDecision(event.key, selected);
        if (decision === 'focus-cancel') document.querySelector('[data-area-transition-cancel]')?.focus();
        else if (decision === 'focus-accept') document.querySelector('[data-area-transition-accept]')?.focus();
        else if (decision === 'cancel') cancelAreaTravel();
        else if (decision === 'accept') acceptAreaTravel();
        return;
      }
      // Target selection owns 1–4 *before* the normal party/sheet shortcuts.
      // No dispatch, spell points or initiative turn until a legal target.
      if (pendingSpellTarget) {
        const targetId = chroniclesSpellTargetHotkey(event, current.party);
        if (event.key === 'Escape' || targetId) {
          event.preventDefault();
          if (event.repeat) return;
          if (event.key === 'Escape') {
            setPendingSpellTarget(null);
            setSpellTargetNotice('');
          } else chooseSpellTarget(targetId);
        } else if (event.key !== 'Tab') event.preventDefault();
        return;
      }
      // The board owns its own focus and shortcuts while its modal is open.
      if (noticeBoardOpen) return;
      const hero = chroniclesPartyHotkeyMember(event, current.party, { menuOpen });
      if (hero) {
        event.preventDefault();
        // Inspecting a hero does not grant the right to act out of turn.
        const actor = chroniclesCurrentInitiativeActor(current.initiative);
        if (actor?.kind !== 'party' || actor.id === hero.id) {
          selectedMemberIdRef.current = hero.id;
          setSelectedMemberId(hero.id);
        }
        if (sheetMemberId) {
          setSheetMemberId(hero.id);
        } else {
          const overlay = chronicleModalOpen || current.shop || current.guild || current.inn || spellMenuOpen
            || automapOpen || menuOpen || journalOpen || quickStatusOpen || audienceRef.current;
          if (overlay) partyHotkeyRef.current = { key: '', at: 0 };
          else {
            const now = performance.now();
            const previous = partyHotkeyRef.current;
            const doubleTap = previous.key === event.key && now - previous.at <= 900;
            partyHotkeyRef.current = doubleTap ? { key: '', at: 0 } : { key: event.key, at: now };
            if (doubleTap) openMemberSheet(hero.id);
          }
        }
        return;
      }
      if (audienceRef.current || chronicleModalOpen || sheetMemberId || current.shop || current.guild || current.inn || spellMenuOpen
        || current.phase === 'defeated' || current.phase === 'escaped') return;
      const menuShortcut = chroniclesAdventureMenuShortcut(event, {
        menuOpen, saveBusy, inCombat: Boolean(current.initiative), confirmExitWithoutSaving, confirmLoadSelection,
        subpageOpen: feedbackOpen,
      });
      if (menuShortcut) {
        event.preventDefault();
        if (menuShortcut === 'save') void persistCheckpoint(stateRef.current, 'manual');
        // Q opens an explicit exit prompt. Esc cancels the prompt first;
        // a subsequent Esc closes the menu without modifying the run.
        if (menuShortcut === 'request-exit') setConfirmExitWithoutSaving(true);
        if (menuShortcut === 'cancel-exit') setConfirmExitWithoutSaving(false);
        if (menuShortcut === 'cancel-load' && !saveBusy) setConfirmLoadSelection(false);
        if (menuShortcut === 'back-feedback') setFeedbackOpen(false);
        if (menuShortcut === 'close') {
          setConfirmExitWithoutSaving(false);
          chroniclesReleaseAdventureMenuFocus(menuSummaryRef.current?.parentElement);
          setMenuOpen(false);
        }
        return;
      }
      if (event.key === 'Tab') {
        // The gem retains the fast Tab open/close toggle. Once a player moves
        // focus into the folio, native Tab traversal is essential for keyboard
        // access; never close while a confirmation or feedback form is open.
        if (chroniclesAdventureTabClosesMenu(event, menuSummaryRef.current, {
          menuOpen, confirmExitWithoutSaving, confirmLoadSelection, feedbackOpen,
        })) {
          event.preventDefault();
          chroniclesReleaseAdventureMenuFocus(menuSummaryRef.current?.parentElement);
          setMenuOpen(false);
          return;
        }
        if (event.shiftKey || target?.closest?.('.chronicles-game-menu')) return;
        event.preventDefault();
        if (event.repeat) return;
        clearTouchHold();
        setAutomapOpen(false);
        setJournalOpen(false);
        setMenuOpen((open) => !open);
        menuSummaryRef.current?.focus();
        return;
      }
      // The mailbox is a page of the modal, not a game context. J/G/M (and
      // every other world shortcut) must not switch views under its draft.
      if (menuOpen && (feedbackOpen || confirmExitWithoutSaving || confirmLoadSelection)) return;
      if (event.key === 'j' || event.key === 'J') {
        event.preventDefault();
        if (event.repeat) return;
        clearTouchHold();
        setAutomapOpen(false);
        setMenuOpen(false);
        setJournalOpen((open) => !open);
        return;
      }
      if (event.key === 'g' || event.key === 'G') {
        event.preventDefault();
        if (event.repeat) return;
        clearTouchHold();
        setAutomapOpen(false);
        setMenuOpen(false);
        setJournalOpen(false);
        setQuickStatusOpen((open) => !open);
        return;
      }
      if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        if (event.repeat) return;
        clearTouchHold();
        setMenuOpen(false);
        setJournalOpen(false);
        setAutomapOpen((open) => !open);
        return;
      }
      if (automapOpen || menuOpen || journalOpen || quickStatusOpen) return;
      if (event.key === 'f' || event.key === 'F') {
        const rawContextual = chroniclesContextualContentAction(current);
        const rawDialogue = chroniclesNpcDialogueForState(current, rawContextual);
        const offer = chroniclesDoorwayPrompt(current, rawContextual, rawDialogue);
        if (chroniclesAreaTransitionIntent(current, 'interact') || offer.contextual || offer.npc) {
          event.preventDefault();
          interactWithContext();
          return;
        }
      }
      // MM3: arrows navigate, Q/E strafe; A attacks only in combat, S shoots anywhere.
      // The adventure menu consumes Q before directional keys while visible.
      // Space is intentionally unbound; it must never dispatch an attack.
      const combatMode = chroniclesCombatKeyMode(event.key, { inCombat: Boolean(current.initiative) });
      if (combatMode) {
        event.preventDefault();
        if (event.repeat) return;
        if (combatMode === 'missile') shootWithParty();
        else if (combatMode === 'block') blockWithActive();
        else attackWithSelected(combatMode);
        return;
      }
      if (event.key === 'c' || event.key === 'C') {
        event.preventDefault();
        setSpellMenuOpen((open) => (open ? false : 'spells'));
        return;
      }
      if (event.key === 'i' || event.key === 'I') {
        event.preventDefault();
        setSpellMenuOpen((open) => (open ? false : 'items'));
        return;
      }
      const action = CHRONICLES_DIRECTION_KEYS[event.key];
      if (!action) return;
      event.preventDefault();
      if (event.repeat) return; // discrete grid step, independent of OS repeat rate
      dispatch(action);
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [acceptAreaTravel, cancelAreaTravel, attackWithSelected, blockWithActive, shootWithParty, automapOpen, chronicleModalOpen, clearTouchHold, closeProvisions,
    confirmExitWithoutSaving, confirmLoadSelection, dispatch, feedbackOpen, interactWithContext, journalOpen, menuOpen, openMemberSheet,
    persistCheckpoint, quickStatusOpen, ready, saveBusy, sheetMemberId, spellMenuOpen,
    pendingSpellTarget, chooseSpellTarget, noticeBoardOpen]);

  const startFreshGame = (entryMapId = null) => {
    setSaveBookInitialScreen('home');
    setNoticeBoardOpen(false);
    clearPortraitLevelUps();
    setFirstStepsOpen(false);
    chroniclesClearPlayingRun();
    beginChroniclesRun(FIRST_PERSON_RUN_SCOPE, { entryMapId });
    const fresh = chroniclesFreshExpeditionProgression().progression;
    runProgressionActiveRef.current = true;
    progressionRef.current = fresh;
    setProgression(fresh);
    setCharacterSetupDone(false);
    setEntryView('setup');
    refreshSaves((value) => value + 1);
  };

  const loadSavedGame = (runId) => {
    if (!chroniclesSelectSavedRun(FIRST_PERSON_RUN_SCOPE, runId)) return;
    setSaveBookInitialScreen('home');
    setNoticeBoardOpen(false);
    clearPortraitLevelUps();
    setFirstStepsOpen(false);
    // Legacy saves without run-scoped flags retain their old account fallback.
    runProgressionActiveRef.current = true;
    progressionRef.current = loadChroniclesProgression();
    chroniclesRememberPlayingRun(FIRST_PERSON_RUN_SCOPE, runId);
    // Loading an existing expedition skips character setup; use this click to
    // request the same native fullscreen/orientation affordance as New game.
    void requestChroniclesLandscapeOnEntry();
    activeRunIdRef.current = null;
    authoritativeRunRef.current = null;
    checkpointFingerprintRef.current = '';
    stateRef.current = null;
    setState(null);
    setReady(false);
    setBootstrapError(null);
    setCharacterSetupDone(true);
    setEntryView('playing');
    setBootstrapRevision((revision) => revision + 1);
  };

  const returnToSaveMenu = (initialScreen = 'home') => {
    setConfirmLoadSelection(false);
    setSaveBookInitialScreen(initialScreen === 'load' ? 'load' : 'home');
    setNoticeBoardOpen(false);
    clearPortraitLevelUps();
    setFirstStepsOpen(false);
    chroniclesClearSessionResume(activeRunIdRef.current);
    chroniclesClearPlayingRun();
    setMenuOpen(false);
    clearTouchHold();
    // Never switch the authoritative run pointer while a checkpoint is queued.
    void checkpointQueueRef.current.catch(() => undefined).then(() => {
      stateRef.current = null;
      activeRunIdRef.current = null;
      authoritativeRunRef.current = null;
      checkpointMapRef.current = null;
      checkpointExistsRef.current = false;
      const durableProgression = loadChroniclesProgression();
      runProgressionActiveRef.current = false;
      progressionRef.current = durableProgression;
      setProgression(durableProgression);
      setState(null);
      setReady(false);
      setBootstrapError(null);
      setRendererError('');
      checkpointFingerprintRef.current = '';
      setCharacterSetupDone(false);
      setSaveInventory(null);
      setEntryView('menu');
      refreshSaves((value) => value + 1);
    });
  };

  if (entryView === 'menu') {
    return (
      <>
        <ChroniclesSaveMenu
          initialScreen={saveBookInitialScreen}
          saves={saveInventory ?? chroniclesListSavedRuns(FIRST_PERSON_RUN_SCOPE)}
          loading={saveMenuLoading}
          error={saveMenuError}
          busyRunId={saveMenuBusy}
          onRetrySync={() => refreshSaves((value) => value + 1)}
          onNew={startFreshGame}
          onLoad={loadSavedGame}
          onRename={(id, title) => {
            const result = chroniclesRenameSavedRun(FIRST_PERSON_RUN_SCOPE, id, title);
            if (result) refreshSaves((value) => value + 1);
            return result;
          }}
          onDelete={async (id, remote) => {
            if (saveMenuBusy !== null) return false;
            setSaveMenuBusy(id);
            setSaveMenuError('');
            try {
              if (remote) await chroniclesDeleteRemoteRun(id);
              if (!chroniclesForgetSavedRun(FIRST_PERSON_RUN_SCOPE, id)) return false;
              setSaveInventory(chroniclesListSavedRuns(FIRST_PERSON_RUN_SCOPE));
              refreshSaves((value) => value + 1);
              return true;
            } catch {
              setSaveMenuError('No se pudo eliminar la expedición del servidor. No se ha retirado de tu lista.');
              return false;
            } finally {
              setSaveMenuBusy(null);
            }
          }}
          // The standalone site has no castle to go back to: its cog signs out.
          onExit={onLogout ? null : exitChronicles}
        />
        {onLogout && <ChroniclesAccountMenu onLogout={onLogout} />}
      </>
    );
  }

  if (!characterSetupDone) {
    return (
      <ChroniclesCharacterSetup
        currentBuild={progression.characterBuild}
        recoveryLabMode="chronicles"
        onConfirm={confirmCharacterBuild}
        onExit={exitChronicles}
      />
    );
  }

  if (bootstrapError) {
    return <BootstrapFailure error={bootstrapError} onRetry={retryBootstrap} onMenu={returnToSaveMenu} onExit={exitChronicles} />;
  }
  if (!ready || !state) return <LoadingScreen />;
  if (rendererError && !scenePainted) {
    return (
      <div className="menu chronicles-bootstrap">
        <section className="menu-section" role="alert">
          <h2>La escena de Chronicles no ha podido dibujarse</h2>
          <p>{rendererError}</p>
          <div className="game-controls">
            <button type="button" className="primary-btn" onClick={retryBootstrap}>Reintentar</button>
            <button type="button" className="secondary-btn" onClick={returnToSaveMenu}>Volver a expediciones</button>
          </div>
        </section>
      </div>
    );
  }

  const objective = chroniclesObjective(state);
  // The authored quest's region takes precedence when the objective text
  // does not name its destination (e.g. the missing banner in Swordhaven).
  const authoredDestination = chroniclesHudQuestDestination(state, objective);
  const routeHint = chroniclesRouteHint(state, authoredDestination || chroniclesObjectiveDestination(objective));
  const selectedMember = state.party.find((member) => member.id === selectedMemberId) || state.party[0];
  const plannedAttackMode = selectedMember ? chroniclesAttackMode(state, selectedMember.id) : 'melee';
  const touchVolley = chroniclesTouchVolleyOpportunity(state);
  const touchWillShoot = touchVolley.available || plannedAttackMode === 'missile';
  const selectedCondition = chroniclesPartyCondition(selectedMember);
  const selectedRelic = chroniclesPartyRelic(state, selectedMember?.id);
  const selectedAttackStats = chroniclesPartyAttackStats(state, selectedMember?.id);
  const sheetMember = sheetMemberId
    ? state.party.find((member) => member.id === sheetMemberId) || null
    : null;
  const journalEntries = chroniclesJournalEntries(state);
  const activeQuests = chroniclesQuestLogEntries(state).filter((quest) => quest.status === 'active');
  const expeditionOver = state.phase === 'defeated' || state.phase === 'escaped';
  const rawContextualAction = chroniclesContextualContentAction(state);
  const exitUnderfoot = chroniclesAreaTransitionIntent(state, 'interact')?.atThreshold === true;
  const rawNpcAtPosition = chroniclesNpcDialogueForState(state, rawContextualAction);
  const { contextual: contextualAction, npc: npcAtPosition } = chroniclesDoorwayPrompt(
    state, rawContextualAction, rawNpcAtPosition,
  );
  const activeInitiativeActor = chroniclesCurrentInitiativeActor(state.initiative);
  // In combat the hero whose turn it is casts; exploring, the selected one.
  const caster = activeInitiativeActor?.kind === 'party'
    ? state.party.find((member) => member.id === activeInitiativeActor.id) || selectedMember
    : selectedMember;
  const casterKnowsSpells = caster ? chroniclesMemberSpells(state, caster).length > 0 : false;
  const carriesItems = chroniclesCarriedConsumables(state).length > 0;
  // One button for the hero's magic and the company's pack.
  const actionMenuAvailable = Boolean(caster) && (casterKnowsSpells || carriesItems);
  // Exploring, a fallen hero cannot open the pack: whoever still stands does.
  const itemUser = caster?.hp > 0 ? caster : activeInitiativeActor ? null : state.party.find((member) => member.hp > 0) || null;

  return (
    <div
      ref={gameRootRef}
      className="chronicles"
      data-chronicles="true"
      data-chronicles-targeting={pendingSpellTarget ? pendingSpellTarget.spellId : undefined}
      data-chronicles-map-id={state.mapId}
      data-chronicles-turns={state.turns}
      data-chronicles-phase={state.phase}
      data-chronicles-turn-engine={CHRONICLES_TURN_ENGINE_VERSION}
      data-chronicles-initiative-die={state.initiative?.die || undefined}
      data-chronicles-initiative-actor={activeInitiativeActor?.id || ''}
      data-turn-phase={state.turnPhase || 'party'}
      data-party-hp-total={state.party.reduce((total, member) => total + Number(member.hp || 0), 0)}
      role="region"
      aria-label="Chronicles of Matthias"
      onPointerDownCapture={(event) => { chroniclesBlockAdventureMenuBackgroundEvent(event, menuOpen); }}
      onClickCapture={(event) => { chroniclesBlockAdventureMenuBackgroundEvent(event, menuOpen); }}
      onTouchStartCapture={(event) => { chroniclesBlockAdventureMenuBackgroundEvent(event, menuOpen); }}
    >
      <div className="chronicles-shell">
        <aside className="chronicles-party" aria-label="Grupo de Matthias">
          <span className="chronicles-panel-kicker">GRUPO · 1–4 SELECCIONAR · DOBLE FICHA</span>
          {pendingSpellTarget && (
            <ChroniclesSpellTargetBanner spellId={pendingSpellTarget.spellId}
              notice={spellTargetNotice} onCancel={() => {
                setPendingSpellTarget(null);
                setSpellTargetNotice('');
              }} />
          )}
          {state.party.map((member, index) => {
            return (
              <button
                type="button"
                key={member.id}
                className={`chronicles-party-member ${member.id === 'matthias' ? 'is-leader' : ''} ${member.id === selectedMemberId ? 'is-selected' : ''} ${member.hp <= 0 ? 'is-down' : ''} ${pendingSpellTarget && chroniclesHealTargetStatus(member) === 'wounded' ? 'is-spell-target-valid' : ''}`}
                onClick={() => pendingSpellTarget ? chooseSpellTarget(member.id) : openMemberSheet(member.id)}
                disabled={expeditionOver}
                aria-label={pendingSpellTarget ? `Lanzar ${CHRONICLES_SPELLS[pendingSpellTarget.spellId]?.name} a ${member.name}, ${index + 1}` : `Seleccionar ${member.name}`}
                title={pendingSpellTarget ? `${index + 1} · ${member.name} · ${chroniclesHealTargetStatus(member) === 'wounded' ? 'Recibir curación' : 'No puede recibir curación'}` : `${member.name} · ${member.hp}/${member.maxHp} PV${chroniclesMemberMaxSp(state, member) > 0 ? ` · ${chroniclesMemberSp(state, member)}/${chroniclesMemberMaxSp(state, member)} PH` : ''} · clic: ficha`}
                aria-pressed={member.id === selectedMemberId}
                data-member-hp={member.hp}
                data-damage-hit={retaliationCue?.targetId === member.id ? 'true' : undefined}
              >
                <span className="chronicles-party-glyph has-authored-portrait" aria-hidden="true">
                  <img
                    className="chronicles-party-thumbnail"
                    src={chroniclesPartyPortraitUrl(member)}
                    alt=""
                    draggable="false"
                    data-chronicles-party-thumbnail={member.id}
                  />
                  {hitSplats.filter((splat) => splat.kind === 'party' && splat.id === member.id).map((splat) => (
                    <ChroniclesHitSplat key={splat.token} impact={splat} className="is-party" />
                  ))}
                </span>
                <span><strong>{index + 1}. {member.name}</strong><small>Nv {chroniclesHeroProgress(progression, member.id).level}</small></span>
                <span className="chronicles-party-bars" aria-hidden="true" data-band={chroniclesHealthBand(member.hp, member.maxHp)}>
                  <i className="is-hp" style={{ '--fill': member.maxHp ? Math.max(0, member.hp) / member.maxHp : 0 }} />
                  {chroniclesMemberMaxSp(state, member) > 0 && (
                    <i className="is-sp" style={{ '--fill': chroniclesMemberSp(state, member) / chroniclesMemberMaxSp(state, member) }} />
                  )}
                </span>
                <b>
                  {member.hp}/{member.maxHp}
                  {chroniclesMemberMaxSp(state, member) > 0 && (
                    <i className="chronicles-party-sp" data-member-sp={chroniclesMemberSp(state, member)}>
                      {chroniclesMemberSp(state, member)}/{chroniclesMemberMaxSp(state, member)} PH
                    </i>
                  )}
                </b>
                {portraitLevelUps[member.id] && (
                  <ChroniclesPortraitLevelUp key={portraitLevelUps[member.id].token}
                    heroName={member.name} toLevel={portraitLevelUps[member.id].toLevel} />
                )}
              </button>
            );
          })}
          {/* MM3 keeps two places beside the company for hired hands. */}
          {[1, 2].map((slot) => (
            <div key={`hireling-${slot}`} className="chronicles-party-hireling" data-chronicles-hireling-slot={slot}
              aria-label={`Hueco ${slot} para contratado, libre`}>
              <span className="chronicles-party-hireling__face" aria-hidden="true" />
              <span className="chronicles-party-hireling__label"><strong>Plaza libre</strong><small>Sin contratar</small></span>
            </div>
          ))}
        </aside>

        <main className="chronicles-stage-wrap">
          <div className="chronicles-statusbar" aria-live="polite">
            {/* Hidden compatibility slots keep the desktop active-member index stable. */}
            <span className="chronicles-statusbar__retired-location" hidden aria-hidden="true" />
            <span className="chronicles-statusbar__retired-bearing" hidden aria-hidden="true" />
            <span>ACTIVO <b>{selectedMember?.name}</b></span>
            {/* The Crónica owns quest objectives; no persistent duplicate plaque. */}
            <div className="chronicles-chronicle-slot">
              <button type="button" className="chronicles-chronicle-trigger" data-chronicles-journal-trigger
                aria-haspopup="dialog" aria-expanded={journalOpen}
                title="Crónica de expedición: encargos y folios (J)"
                onClick={() => {
                  clearTouchHold();
                  setAutomapOpen(false);
                  setMenuOpen(false);
                  setChronicleModalOpen(false);
                  setJournalOpen((open) => !open);
                }}>
                <i aria-hidden="true">📜</i> CRÓNICA <kbd>J</kbd>
              </button>
              <button type="button" className="chronicles-chronicle-trigger" data-chronicles-quick-status-trigger
                aria-haspopup="dialog" aria-expanded={quickStatusOpen}
                title="Estado del grupo: PV, PH, CA y arma de cada héroe (G)"
                onClick={() => {
                  clearTouchHold();
                  setAutomapOpen(false);
                  setMenuOpen(false);
                  setJournalOpen(false);
                  setQuickStatusOpen((open) => !open);
                }}>
                <i aria-hidden="true">⚑</i> GRUPO <kbd>G</kbd>
              </button>
            </div>
            {needsRotation && (
              <button
                type="button"
                className="chronicles-landscape-trigger"
                data-lock-state={lockState}
                aria-label="Activar apaisado"
                title={lockState === 'rejected' ? 'El navegador necesita otro toque para girar Chronicles.' : 'Girar Chronicles a apaisado'}
                onClick={() => { void activateLandscape(); }}
              >
                <span aria-hidden="true">↻</span>
              </button>
            )}
          </div>

            <details
              className="chronicles-game-menu"
              open={menuOpen}
              onKeyDown={(event) => { chroniclesContainAdventureMenuTab(event, event.currentTarget); }}
              onToggle={(event) => {
                setMenuOpen(event.currentTarget.open);
                if (event.currentTarget.open) {
                  clearTouchHold(); // Stop an existing long-press before gameplay becomes modal.
                  setAutomapOpen(false);
                  setJournalOpen(false);
                } else {
                  // Also handle native <summary> dismissal and pointer close.
                  chroniclesReleaseAdventureMenuFocus(event.currentTarget);
                  setConfirmExitWithoutSaving(false);
                  setConfirmLoadSelection(false);
                  setFeedbackOpen(false);
                }
              }}
            >
              <summary ref={menuSummaryRef} title="Gema azul · Menú (Tab / Esc)" aria-label={menuOpen ? 'Cerrar menú de Chronicles' : 'Abrir menú de Chronicles'}>
                <span className="chronicles-menu-gem__hint" aria-hidden="true">MENÚ</span>
              </summary>
              <ChroniclesAdventureMenu
                feedbackOpen={feedbackOpen} onFeedbackOpenChange={setFeedbackOpen}
                onClose={() => {
                  chroniclesReleaseAdventureMenuFocus(menuSummaryRef.current?.parentElement);
                  setMenuOpen(false);
                }}
                onContinue={() => {
                  chroniclesReleaseAdventureMenuFocus(menuSummaryRef.current?.parentElement);
                  setMenuOpen(false);
                  setConfirmExitWithoutSaving(false);
                }}
                onJournal={() => { setMenuOpen(false); setConfirmExitWithoutSaving(false); setJournalOpen(true); }}
                onQuickStatus={() => { setMenuOpen(false); setConfirmExitWithoutSaving(false); setQuickStatusOpen(true); }}
                inCombat={Boolean(state.initiative)}
                onSave={() => void persistCheckpoint(stateRef.current, 'manual')}
                onSaveExit={() => void saveAndExit()}
                onRequestLoad={() => {
                  if (saveBusy) return;
                  setConfirmExitWithoutSaving(false);
                  setConfirmLoadSelection(true);
                }}
                onCancelLoad={() => { if (!saveBusy) setConfirmLoadSelection(false); }}
                onLoadWithoutSave={() => { if (!saveBusy) returnToSaveMenu('load'); }}
                onSaveBeforeLoad={async () => {
                  if (saveBusy) return;
                  const saved = await persistCheckpoint(stateRef.current, 'manual');
                  if (saved) returnToSaveMenu('load');
                }}
                confirmLoadSelection={confirmLoadSelection}
                onAdmin={() => { setMenuOpen(false); setAdminOpen(true); }}
                onRequestExit={() => setConfirmExitWithoutSaving(true)}
                onDiscardExit={() => void discardAndExit()}
                onCancelExit={() => setConfirmExitWithoutSaving(false)}
                confirmExitWithoutSaving={confirmExitWithoutSaving}
                saveNotice={saveNotice}
                saveBusy={saveBusy}
                isAdmin={isAdmin}
              />
            </details>

          <div className="chronicles-stage">
            <div ref={hostRef} className="chronicles-three" data-chronicles-renderer="three" aria-label="Mazmorra 3D en primera persona de Chronicles of Matthias" />
            <div className="chronicles-vignette" aria-hidden="true" />
            {relockPrompt && typeof document !== 'undefined' && createPortal(
              <div className="chronicles-relock" role="dialog" aria-modal="true" aria-labelledby="chronicles-relock-title" data-chronicles-relock>
                <button type="button" className="chronicles-relock__go" onClick={() => { void activateLandscape(); }}>
                  <span aria-hidden="true">⟳</span>
                  <b id="chronicles-relock-title">Toca para volver a apaisado</b>
                  <small>{lockState === 'rejected'
                    ? 'El navegador no ha dejado girar. Prueba otra vez o gira el móvil a mano.'
                    : 'Al cambiar de app, el navegador sale de pantalla completa.'}</small>
                </button>
                <button type="button" className="chronicles-relock__stay" onClick={declineLandscape}>Seguir en vertical</button>
              </div>, document.body,
            )}
            {hitSplats.filter((splat) => splat.kind === 'enemy').map((splat, index, all) => (
              <ChroniclesHitSplat key={splat.token} impact={splat} className="is-enemy"
                style={all.length > 1 ? { left: `${50 + (index - (all.length - 1) / 2) * 14}%` } : null} />
            ))}
            {areaTransition && <ChroniclesAreaTransitionDialog
              question={areaTransition.question}
              onCancel={cancelAreaTravel}
              onAccept={acceptAreaTravel}
            />}
            <ChroniclesInitiativeRail initiative={state.initiative} />
            <ChroniclesNarratorOverlay message={state.message} open={chronicleModalOpen}
              onOpenChange={(next) => {
                clearTouchHold();
                if (next) {
                  setJournalOpen(false);
                  setMenuOpen(false);
                  setAutomapOpen(false);
                }
                setChronicleModalOpen(next);
              }}>
              {activeQuests.length > 0 && <ChroniclesQuestLog state={state} onTrack={(questId) => dispatch({ type: 'track-quest', questId })} />}
            </ChroniclesNarratorOverlay>
            <ChroniclesPartyBark key={`party-bark:${partyBark?.token || 'none'}`} bark={partyBark}
              onOpenEquipment={() => openMemberSheet('matthias', 'equipment')}
              onReadingChange={(reading) => {
                // Do not let an opt-in hover or focused equipment action vanish.
                if (partyBarkTimerRef.current) clearTimeout(partyBarkTimerRef.current);
                partyBarkTimerRef.current = null;
                if (reading) return;
                const token = partyBarkSequenceRef.current;
                partyBarkTimerRef.current = setTimeout(() => {
                  setPartyBark((active) => active?.token === token ? null : active);
                }, 3000);
              }} />
            <ChroniclesFirstAudienceCue
              state={state}
              contextualAction={contextualAction}
              npc={npcAtPosition}
              suspended={Boolean(audience || chronicleModalOpen || menuOpen || journalOpen
                || quickStatusOpen || automapOpen || sheetMemberId || spellMenuOpen
                || state.shop || state.guild || state.inn || expeditionOver)}
              onTalk={interactWithContext}
            />
            <ChroniclesFirstSteps
              key={`first-steps:${activeRunIdRef.current || 'no-run'}`}
              state={state}
              runId={activeRunIdRef.current}
              open={firstStepsOpen}
              suspended={Boolean(menuOpen || journalOpen || chronicleModalOpen || automapOpen
                || quickStatusOpen || audience || sheetMemberId || spellMenuOpen
                || state.shop || state.guild || state.inn || state.initiative || expeditionOver)}
              onClose={() => setFirstStepsOpen(false)}
              onOpenJournal={() => {
                setMenuOpen(false);
                setAutomapOpen(false);
                setJournalOpen(false);
                setChronicleModalOpen(true);
              }}
            />
            <ChroniclesFirstThreatCue
              key={`first-threat:${activeRunIdRef.current || 'no-run'}`}
              state={state}
              runId={activeRunIdRef.current}
              target={chroniclesEnemyTargetAhead(state, 4)}
              suspended={Boolean(menuOpen || journalOpen || chronicleModalOpen || automapOpen
                || quickStatusOpen || audience || sheetMemberId || spellMenuOpen
                || state.shop || state.guild || state.inn || expeditionOver)}
            />
            <ChroniclesEnemyRetaliationFx key={`retaliation:${retaliationCue?.token || 'none'}`} cue={retaliationCue} />
            {missileNotice && <div className="chronicles-quiet-action-notice" role="status" aria-live="polite" data-chronicles-missile-refusal>{missileNotice}</div>}
            {lootNotice && <div key={lootNotice.text} className="chronicles-quiet-action-notice chronicles-loot-notice" role="status" aria-live="polite" data-chronicles-loot-receipt>{lootNotice.text}</div>}
            {rendererError && <div className="chronicles-renderer-error" role="alert">{rendererError}</div>}
            {state.phase === 'defeated' && <ChroniclesDefeatOverlay onRestart={restart} onExit={exitChronicles} />}
            {state.phase === 'escaped' && !chroniclesCampaignEnding(state) && <ChroniclesBookOneEpilogue state={state} onRestart={restart} />}
            {state.phase === 'escaped' && chroniclesCampaignEnding(state) && (
              <ChroniclesCampaignEpilogue state={state} closed onRestart={restart} onExit={exitChronicles} />
            )}
            {isAdmin && adminOpen && !expeditionOver && (
              <ChroniclesAdminPanel state={state} onAction={dispatch} onClose={() => setAdminOpen(false)} />
            )}
            {chroniclesCampaignEpiloguePending(state) && (
              <ChroniclesCampaignEpilogue
                state={state}
                onContinue={() => resolveCampaignEpilogue(false)}
                onClose={() => resolveCampaignEpilogue(true)}
              />
            )}
          </div>

          {/* Desktop puts these in the MM3 panel; mobile floats them over the view. */}
          <ChroniclesMinimap
            state={state}
            target={routeHint?.position || null}
            routeLabel={routeHint?.text || ''}
            visitedCells={automapVisitedByMap[state.mapId] || []}
            hidden={automapOpen || expeditionOver}
            onExpand={() => {
              clearTouchHold();
              setMenuOpen(false);
              setJournalOpen(false);
              setAutomapOpen(true);
            }}
          />
          <ChroniclesCombatRoster state={state} />

          <ChroniclesQuickStatus
            open={quickStatusOpen}
            rows={quickStatusOpen ? chroniclesQuickStatusRows(state, (memberId) => chroniclesHeroProgress(progression, memberId).level) : []}
            gold={chroniclesGoldBalance(state)}
            onClose={() => setQuickStatusOpen(false)}
            onOpenSheet={(memberId) => { setQuickStatusOpen(false); openMemberSheet(memberId); }}
          />
          <ChroniclesJournalModal open={journalOpen} state={state} entries={journalEntries} narrations={narrationLog}
            onTrack={(questId) => dispatch({ type: 'track-quest', questId })}
            onOpenSheet={(memberId) => { setJournalOpen(false); openMemberSheet(memberId); }}
            onClose={() => setJournalOpen(false)} />

          {!expeditionOver && (
            <>
              <div className="chronicles-touch" aria-label="Controles de la mazmorra">
                <button
                  type="button"
                  data-chronicles-touch-action="turn-left"
                  onPointerDown={(event) => startTouchHold('turn-left', event)}
                  onPointerUp={clearTouchHold}
                  onPointerCancel={clearTouchHold}
                  onLostPointerCapture={clearTouchHold}
                  onClick={(event) => activateTouchAction('turn-left', event)}
                  aria-label="Girar a la izquierda"
                >↶<small>GIRAR</small></button>
                <button
                  type="button"
                  data-chronicles-touch-action="forward"
                  disabled={chroniclesCombatPartyStepBlocked(state, 'forward')}
                  title={state.initiative ? 'En combate no puedes mover al grupo' : 'Avanzar'}
                  onPointerDown={(event) => startTouchHold('forward', event)}
                  onPointerUp={clearTouchHold}
                  onPointerCancel={clearTouchHold}
                  onLostPointerCapture={clearTouchHold}
                  onClick={(event) => activateTouchAction('forward', event)}
                  aria-label="Avanzar"
                >↑<small>AVANZAR</small></button>
                <button
                  type="button"
                  className="is-attack"
                  data-chronicles-touch-action="attack"
                  onClick={() => touchWillShoot ? shootWithParty() : attackWithSelected()}
                  aria-label={touchVolley.available
                    ? `Salva del grupo: ${touchVolley.shooters} tirador${touchVolley.shooters === 1 ? '' : 'es'} (S)`
                    : touchWillShoot ? 'Disparar con el personaje activo (S)' : 'Atacar cuerpo a cuerpo (A)'}
                  title="Flechas · mover/girar · Q/E · desplazarse lateralmente · A · atacar en combate · S · disparar"
                >{touchWillShoot ? '➶' : '⚔'}<small>{touchVolley.available
                    ? `SALVA · ${touchVolley.shooters}` : selectedMember?.name?.toUpperCase() || 'ATACAR'}</small></button>
                {state.combatRules === 'mm3' && activeInitiativeActor?.kind === 'party' && (
                  <button type="button" className="is-block"
                    data-chronicles-touch-action="block"
                    onClick={blockWithActive}
                    title="B · BLOCK: +4 CA hasta tu próximo turno; consume turno"
                    aria-label="Bloquear: ganar cuatro puntos de clase de armadura hasta el próximo turno (B)"
                  >⛨<small>BLOCK · B</small></button>
                )}
                {actionMenuAvailable && (
                  <button
                    type="button"
                    className="is-magic"
                    data-chronicles-touch-action="cast"
                    aria-expanded={Boolean(spellMenuOpen)}
                    onClick={() => setSpellMenuOpen((open) => (open ? false : 'spells'))}
                    aria-label={casterKnowsSpells ? `Hechizos y objetos de ${caster.name}` : `Objetos para ${caster.name}`}
                  >{casterKnowsSpells ? '✧' : '⚗'}<small>{casterKnowsSpells ? 'MAGIA' : 'OBJETOS'}</small></button>
                )}
                {(exitUnderfoot || contextualAction || npcAtPosition) && (
                  <button
                    type="button"
                    className="is-contextual"
                    data-chronicles-touch-action="interact"
                    onClick={interactWithContext}
                    aria-label={exitUnderfoot ? 'Usar salida de la región'
                      : contextualAction?.id === CHRONICLES_QUARTERMASTER_ID ? 'Entrar en tienda de provisiones'
                      : contextualAction?.label || `Hablar con ${npcAtPosition.name}`}
                  >✦<small>{exitUnderfoot ? 'USAR' : contextualAction?.id === CHRONICLES_SWORDHAVEN_RETURN_PORTAL_ID ? 'VOLVER' : npcAtPosition || contextualAction?.id === CHRONICLES_QUARTERMASTER_ID ? 'ENTRAR' : 'USAR'}</small></button>
                )}
                <button
                  type="button"
                  data-chronicles-touch-action="backward"
                  disabled={chroniclesCombatPartyStepBlocked(state, 'backward')}
                  title={state.initiative ? 'En combate no puedes mover al grupo' : 'Retroceder'}
                  onPointerDown={(event) => startTouchHold('backward', event)}
                  onPointerUp={clearTouchHold}
                  onPointerCancel={clearTouchHold}
                  onLostPointerCapture={clearTouchHold}
                  onClick={(event) => activateTouchAction('backward', event)}
                  aria-label="Retroceder"
                >↓<small>ATRÁS</small></button>
                <button
                  type="button"
                  data-chronicles-touch-action="turn-right"
                  onPointerDown={(event) => startTouchHold('turn-right', event)}
                  onPointerUp={clearTouchHold}
                  onPointerCancel={clearTouchHold}
                  onLostPointerCapture={clearTouchHold}
                  onClick={(event) => activateTouchAction('turn-right', event)}
                  aria-label="Girar a la derecha"
                >↷<small>GIRAR</small></button>
              </div>

              <div className="chronicles-keyboard-help">
                {state.initiative && state.combatRules === 'mm3'
                  ? <span data-chronicles-combat-movement-hint>COMBATE · grupo inmóvil</span>
                  : <>
                    <span><kbd>↑</kbd> avanzar</span>
                    <span><kbd>↓</kbd> retroceder</span>
                  </>}
                <span><kbd>←</kbd>/<kbd>→</kbd> girar</span>
                <span><kbd>Q</kbd>/<kbd>E</kbd> lateral</span>
                <span><kbd>A</kbd> atacar</span>
                <span><kbd>S</kbd> disparar</span>
                <span><kbd>B</kbd> bloquear (+4 CA)</span>
                <span><kbd>1</kbd>–<kbd>4</kbd> pieza</span>
                <span><kbd>F</kbd> usar/recoger</span>
                <span><kbd>C</kbd> hechizos</span>
                <span><kbd>I</kbd> objetos</span>
                <span><kbd>M</kbd> mapa</span>
              </div>
            </>
          )}
        </main>

        {/* Legacy large portrait of the active hero; the MM3 chrome hides it (faces live in the strip). */}
        <div className="chronicles-party-preview" data-condition={selectedCondition} data-relic={selectedRelic || undefined}>
          <img
            className="chronicles-party-preview-image"
            src={chroniclesPartyPortraitUrl(selectedMember)}
            alt={`Retrato de ${selectedMember.name}`}
            data-chronicles-party-renderer="authored"
            data-member-id={selectedMember.id}
            draggable="false"
          />
          <div className="chronicles-party-preview-copy">
            <span>{selectedMember?.role}</span>
            <strong>{selectedMember?.name}</strong>
            <small>{state.combatRules === 'mm3' ? chroniclesArmsLabel(state, selectedMember?.id) : selectedMember?.attackName} · daño {selectedAttackStats.damage} · alcance {selectedAttackStats.reach}</small>
          </div>
        </div>
      </div>

      {spellMenuOpen && caster && !expeditionOver && !sheetMember && !state.shop && !state.guild && !state.inn && (
        <ChroniclesSpellMenu
          state={state}
          member={caster}
          initialTab={spellMenuOpen === 'items' ? 'items' : 'spells'}
          itemUser={itemUser}
          onClose={() => setSpellMenuOpen(false)}
          onOpenSheet={(memberId) => {
            setSpellMenuOpen(false);
            openMemberSheet(memberId);
          }}
          onRequestTarget={(spellId) => {
            setSpellMenuOpen(false);
            setPendingSpellTarget({ spellId, memberId: caster.id });
            setSpellTargetNotice('');
          }}
          onCast={(spellId, targetId = null) => {
            setSpellMenuOpen(false);
            dispatch({ type: 'cast', memberId: caster.id, spellId, ...(targetId ? { targetId } : {}) });
          }}
          onUse={(itemId, targetId = null) => {
            setSpellMenuOpen(false);
            if (itemUser) dispatch({
              type: 'use-item', memberId: itemUser.id, itemId,
              ...(targetId ? { targetId } : {}),
            });
          }}
        />
      )}

      {state.guild && !sheetMember && (
        <ChroniclesGuild
          state={state}
          onAction={dispatch}
          onClose={() => dispatch({ type: 'guild-close' })}
        />
      )}

      {state.inn && !sheetMember && (
        <ChroniclesInn state={state} onAction={dispatch}
          onClose={() => dispatch({ type: 'inn-close' })} />
      )}

      {provisionsOpen && !sheetMember && (
        <ChroniclesProvisions state={state}
          onBuy={() => {
            const current = stateRef.current;
            if (chroniclesContextualContentAction(current)?.id !== CHRONICLES_QUARTERMASTER_ID) return current;
            return dispatch({ type: 'interact', provisionsPurchase: true });
          }}
          onClose={closeProvisions} />
      )}

      {state.shop && !sheetMember && (
        <ChroniclesShop
          state={state}
          onAction={dispatch}
          onClose={() => dispatch({ type: 'shop-close' })}
        />
      )}

      {noticeBoardOpen && !sheetMember && (
        <ChroniclesNoticeBoard state={state} onClose={closeNoticeBoard}
          onAccept={(offerId) => {
            const current = stateRef.current;
            const contextual = chroniclesContextualContentAction(current);
            if (contextual?.id !== offerId || contextual.locked) return;
            dispatch('interact');
          }} />
      )}

      {audience && !sheetMember && (
        <ChroniclesAudience
          dialogue={audience}
          onAction={(actionId) => {
            const context = chroniclesContextualContentAction(stateRef.current);
            if (context?.id !== actionId) return 'Ese asunto ya está resuelto.';
            const next = dispatch('interact');
            return next?.message || 'Aldric asiente.';
          }}
          onClose={() => { audienceRef.current = null; setAudience(null); }}
        />
      )}

      {sheetMember && (
        <ChroniclesCharacterSheet
          key={sheetInitialFolio}
          state={state}
          progression={progression}
          member={sheetMember}
          mode="first-person"
          initialFolio={sheetInitialFolio}
          onClose={() => setSheetMemberId(null)}
          onSelectMember={(memberId) => {
            if (!stateRef.current?.party.some((candidate) => candidate.id === memberId)) return;
            const actor = chroniclesCurrentInitiativeActor(stateRef.current?.initiative);
            if (actor?.kind !== 'party' || actor.id === memberId) {
              selectedMemberIdRef.current = memberId;
              setSelectedMemberId(memberId);
            }
            // Browsing any companion never transfers initiative or action rights.
            setSheetMemberId(memberId);
          }}
          onAllocateAttribute={allocateAttribute}
          onLearnSkill={learnSkill}
          onEquipmentAction={(action) => dispatch({ ...action, memberId: sheetMember.id })}
        />
      )}

      {!scenePainted && <LoadingScreen />}
      <ChroniclesAutomap
        open={automapOpen}
        state={state}
        target={routeHint?.position || null}
        routeLabel={routeHint?.text || ''}
        objective={objective}
        visitedMapIds={Object.keys(automapVisitedByMap)}
        visitedCells={automapVisitedByMap[state.mapId] || []}
        onClose={() => setAutomapOpen(false)}
        onOpenSheet={(memberId) => openMemberSheet(memberId)}
      />
    </div>
  );
}