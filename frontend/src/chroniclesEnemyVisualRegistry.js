import { buildCorruptedPawn, buildGateJailer } from './chroniclesOfMatthiasArt.js';
import { buildScavengerKnight } from './chroniclesOfMatthiasScavengerKnight.js';
import { buildSpectralBishop } from './chroniclesOfMatthiasSpectralBishop.js';
import {
  buildAshGoblin,
  buildBoneHound,
  buildCryptSpider,
  buildEmberWisp,
  buildForkStalker,
} from './chroniclesFantasyEnemyArt.js';
import { installChroniclesEnemyMotionArt } from './chroniclesEnemyMotionArt.js';
import { buildChroniclesSpriteBillboard } from './chronicles/chroniclesSpriteBillboards.js';
import { buildChroniclesRemoteSpiderBillboard } from './chronicles/chroniclesRemoteSpiderSprite.js';
import { buildChroniclesRemoteSmugglerBillboard } from './chronicles/chroniclesRemoteSmugglerSprite.js';
import { buildChroniclesRemoteOverworldBillboard, chroniclesOverworldSpriteSpec } from './chronicles/chroniclesRemoteOverworldSprite.js';

const VISUALS = Object.freeze({
  'corrupted-pawn': Object.freeze({ build: buildCorruptedPawn, scale: 0.92 }),
  'gate-jailer': Object.freeze({ build: buildGateJailer, scale: 1.04 }),
  'spectral-bishop': Object.freeze({ build: buildSpectralBishop, scale: 0.9 }),
  'scavenger-knight': Object.freeze({ build: buildScavengerKnight, scale: 0.96 }),
  'ash-goblin': Object.freeze({ build: buildAshGoblin, scale: 1.08 }),
  'crypt-spider': Object.freeze({ build: buildCryptSpider, scale: 1.02 }),
  'ember-wisp': Object.freeze({ build: buildEmberWisp, scale: 0.96 }),
  'bone-hound': Object.freeze({ build: buildBoneHound, scale: 1.08 }),
  'fork-stalker': Object.freeze({ build: buildForkStalker, scale: 1.02 }),
  // Overworld foes painted as first-person billboards; Tactics keeps a 3D
  // stand-in from the closest procedural model.
  'road-bandit': Object.freeze({ build: buildScavengerKnight, scale: 0.96 }),
  'bandit-captain': Object.freeze({ build: buildScavengerKnight, scale: 1.18 }),
  'weaver-spider': Object.freeze({ build: buildCryptSpider, scale: 1.2 }),
  'sewer-rat': Object.freeze({ build: buildBoneHound, scale: 0.72 }),
  'salt-crab': Object.freeze({ build: buildCryptSpider, scale: 1.05 }),
  drowned: Object.freeze({ build: buildScavengerKnight, scale: 0.94 }),
  'mire-witch': Object.freeze({ build: buildSpectralBishop, scale: 1.06 }),
  // Act V: Varren's cult and the knights bound to his hollow crown.
  'silent-acolyte': Object.freeze({ build: buildSpectralBishop, scale: 0.86 }),
  'oathbound-knight': Object.freeze({ build: buildScavengerKnight, scale: 1.06 }),
  'chancellor-varren': Object.freeze({ build: buildSpectralBishop, scale: 1.04 }),
  // Terra's wider bestiary: first-person shows their billboards; Tactics
  // borrows the closest procedural silhouette.
  skeleton: Object.freeze({ build: buildScavengerKnight, scale: 0.92 }),
  harpy: Object.freeze({ build: buildForkStalker, scale: 0.94 }),
  troll: Object.freeze({ build: buildGateJailer, scale: 1.26 }),
  'ice-wraith': Object.freeze({ build: buildSpectralBishop, scale: 1.0 }),
  'ash-salamander': Object.freeze({ build: buildCryptSpider, scale: 1.12 }),
  'bog-toad': Object.freeze({ build: buildBoneHound, scale: 0.9 }),
  // Third wave: camps, wolf packs and the Tower of Names.
  'bandit-archer': Object.freeze({ build: buildScavengerKnight, scale: 0.94 }),
  'dire-wolf': Object.freeze({ build: buildBoneHound, scale: 1.0 }),
  'stone-golem': Object.freeze({ build: buildGateJailer, scale: 1.3 }),
  'orc-raider': Object.freeze({ build: buildGateJailer, scale: 1.12 }),
  gnoll: Object.freeze({ build: buildScavengerKnight, scale: 1.1 }),
  hellhound: Object.freeze({ build: buildBoneHound, scale: 1.14 }),
  ghoul: Object.freeze({ build: buildScavengerKnight, scale: 0.9 }),
  'name-scribe': Object.freeze({ build: buildSpectralBishop, scale: 1.2 }),
});

export function chroniclesEnemyVisualSpec(visualType) {
  const visual = VISUALS[visualType];
  if (!visual) return null;
  return Object.freeze({ visualType, scale: visual.scale });
}

export function buildChroniclesEnemyVisual(visualType, options = {}) {
  const visual = VISUALS[visualType];
  if (!visual) return null;
  // First-person opts into 2.5D painted billboards where a sheet exists;
  // everything else (and Tactics) keeps the procedural 3D model.
  if (options.sprites) {
    const billboard = buildChroniclesSpriteBillboard(visualType);
    if (billboard && visualType === 'road-bandit') {
      // The existing five-frame road bandit stays visible until the
      // independent painted R2 replacement has loaded and validated.
      return Object.freeze({
        model: buildChroniclesRemoteSmugglerBillboard(billboard), scale: 1,
      });
    }
    if (billboard && chroniclesOverworldSpriteSpec(visualType)) {
      return Object.freeze({
        model: buildChroniclesRemoteOverworldBillboard(visualType, billboard), scale: 1,
      });
    }
    if (billboard) return Object.freeze({ model: billboard, scale: 1 });
    // An all-new species needs its procedural fallback until the atlas decodes.
    if (chroniclesOverworldSpriteSpec(visualType)) {
      const fallback = visual.build(options);
      installChroniclesEnemyMotionArt(fallback, visualType, options);
      return Object.freeze({
        model: buildChroniclesRemoteOverworldBillboard(visualType, fallback), scale: 1,
      });
    }
    if (visualType === 'crypt-spider') {
      // Show the existing procedural spider until the approved R2 atlas is
      // decoded. Tactics continues using its genuine 3D model.
      const fallback = visual.build(options);
      installChroniclesEnemyMotionArt(fallback, visualType, options);
      return Object.freeze({
        model: buildChroniclesRemoteSpiderBillboard(fallback), scale: 1,
      });
    }
  }
  const model = visual.build(options);
  installChroniclesEnemyMotionArt(model, visualType, options);
  return Object.freeze({
    model,
    scale: visual.scale,
  });
}
