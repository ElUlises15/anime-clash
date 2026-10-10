import type { CharacterDef } from '../../types';
import { config } from './config';
import { moves } from './moves';
import { visuals } from './visuals';

export const def: CharacterDef = { ...config, moves, visuals };
