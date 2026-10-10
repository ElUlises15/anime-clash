/**
 * Engine tuning constants (frame counts at 60 Hz, fixed-point where noted).
 * Character-specific numbers live in character data; these are the universal rules.
 */
export const INTRO_FRAMES = 100;
export const KO_FRAMES = 90; // 1.5 s KO pause (includes the KO hitstop freeze)
export const ROUND_END_FRAMES = 80;
export const TIMEUP_FRAMES = 60; // pause after 'timeUp' before roundEnd

export const ENERGY_START = 300;
export const BUFFER_FRAMES = 8; // attack/dash press buffer (generous: keyboard players mash/press early)
/** Air move cancelled by landing before it got going: its button is re-buffered so the ground version comes out. */
export const LANDING_REBUFFER_FRAMES = 8;

/** Spawn distance of each fighter from stage center (px). */
export const START_OFFSET_PX = 280;

/** Push box (px): half width and height. Fighters can't overlap unless one is this high above the other. */
export const PUSH_HALF_W_PX = 36;
export const PUSH_HEIGHT_PX = 240;

export const HITSTOP = { light: 6, heavy: 10, special: 12, ultimate: 16 } as const;
export const KO_HITSTOP = 30;
export const BLOCK_HITSTOP_PCT = 70;

/** Damage scaling by hit index in combo (percent). After the table, MIN_SCALING. */
export const COMBO_SCALING = [100, 100, 90, 80, 70, 60, 50, 42] as const;
export const MIN_SCALING = 35;
export const ULTIMATE_MIN_SCALING = 80;
/** Max hits an airborne (juggled) fighter can take before becoming intangible until landing. */
export const JUGGLE_MAX = 7;
/** Hitstun decay: after this many hits in a combo, each hit removes 1 frame of hitstun. */
export const HITSTUN_DECAY_START = 4;
export const MIN_HITSTUN = 8;

export const KNOCKDOWN_FRAMES = 36;
export const GETUP_FRAMES = 22;
export const GETUP_INVULN = 30;
export const BACKDASH_INVULN: [number, number] = [1, 10];
export const DASH_CANCEL_FRAME = 4; // forward dash can be cancelled into attacks from this frame
export const AIR_DASH_FRAMES = 14;
export const MAX_FALL_SPEED = 2600;

/** Meter economy. */
export const ENERGY_GAIN_LIGHT = 22;
export const ENERGY_GAIN_HEAVY = 38;
export const ENERGY_GAIN_TAKEN_PCT = 25; // defender gains % of damage taken
export const ENERGY_GAIN_BLOCK = 18;
export const ULT_GAIN_DEALT_PCT = 70;
export const ULT_GAIN_TAKEN_PCT = 90;
export const ULT_GAIN_BLOCK = 6;
export const DEFAULT_CHIP_PCT = 15; // specials/ultimates chip on block
export const BLOCK_PUSH_PCT = 75;
export const CORNER_PUSH_PCT = 60;
export const CORNER_DIST_PX = 70;

/** Status 'burn': damage applied every BURN_INTERVAL frames = magnitude. */
export const BURN_INTERVAL = 30;

/** Training mode regen. */
export const TRAINING_REGEN_DELAY = 60;
export const TRAINING_HP_REGEN_PER_FRAME = 25;
