/** CONTRACT FILE — data passed between Phaser scenes. */
import type { MatchStats, PlayerIndex } from '../game/sim/types';

export const SCENES = {
  Boot: 'Boot',
  Title: 'Title',
  Settings: 'Settings',
  Select: 'Select',
  Fight: 'Fight',
  PostMatch: 'PostMatch',
} as const;

export type GameMode = 'versus' | 'training' | 'online';

export interface SelectSceneData { mode: GameMode }

export interface FightSceneData {
  mode: GameMode;
  p1: string; // character id
  p2: string;
  /** Who controls each side: local keyboard set, CPU bot, or (phase 2) remote peer. */
  controllers: ['p1keys' | 'p2keys' | 'cpu' | 'remote' | 'dummy', 'p1keys' | 'p2keys' | 'cpu' | 'remote' | 'dummy'];
  seed?: number;
  /** Testing hook: both sides driven by QA bot. */
  autoplay?: boolean;
}

export interface MatchResult {
  mode: GameMode;
  p1: string; p2: string;
  winner: PlayerIndex | -1; // -1 draw
  roundWinners: (PlayerIndex | -1)[];
  roundWins: [number, number];
  stats: [MatchStats, MatchStats];
  durationFrames: number;
  fightData: FightSceneData; // to support REMATCH
}

export interface PostMatchSceneData { result: MatchResult }

/** Logical game resolution. Everything is laid out in these coordinates; Phaser Scale.FIT handles the window. */
export const GAME_W = 1920;
export const GAME_H = 1080;
/** Screen Y of the stage floor at camera zoom 1. sim y=0 maps here. */
export const GROUND_Y = 940;
