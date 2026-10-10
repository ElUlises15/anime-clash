/** Ability registry (no imports of concrete abilities here to keep module graph acyclic). */
import type { Ability } from './types';

const REGISTRY: Record<string, Ability> = {};

export function registerAbility(a: Ability): void {
  REGISTRY[a.type] = a;
}

export function getAbility(type: string): Ability | undefined {
  return REGISTRY[type];
}

export function listAbilityTypes(): string[] {
  return Object.keys(REGISTRY).sort();
}
