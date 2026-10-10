import { NO_INPUT, type InputBits } from './buttons';
import { KeyboardInput } from './KeyboardInput';
import { GamepadInput } from './GamepadInput';

export type ControllerId = 'p1keys' | 'p2keys' | 'cpu' | 'remote' | 'dummy';

/**
 * Combines keyboard + gamepad per controller id.
 * - p1keys: keyboard P1  OR  gamepad 0
 * - p2keys: keyboard P2  OR  gamepad 1
 * - cpu / remote / dummy: NO_INPUT (Fight scene / AI / netcode fill these in)
 *
 * Call `sample(id)` once per sim frame per side (or `samplePair` for both).
 * The first sample of a new pair auto-advances the frame.
 */
export class InputManager {
  readonly keyboard: KeyboardInput;
  readonly gamepad: GamepadInput;
  private seen = new Set<ControllerId>();
  private started = false;
  private owns = true;

  constructor(opts?: { keyboard?: KeyboardInput; gamepad?: GamepadInput }) {
    this.keyboard = opts?.keyboard ?? new KeyboardInput();
    this.gamepad = opts?.gamepad ?? new GamepadInput();
    this.owns = !opts?.keyboard;
  }

  sample(id: ControllerId): InputBits {
    if (this.seen.has(id)) {
      this.advance();
      this.seen.clear();
    } else if (!this.started) {
      this.advance();
      this.started = true;
    }
    this.seen.add(id);
    return this.read(id);
  }

  samplePair(ids: [ControllerId, ControllerId]): [InputBits, InputBits] {
    this.advance();
    this.seen.clear();
    this.started = true;
    const a = this.read(ids[0]);
    const b = this.read(ids[1]);
    this.seen.add(ids[0]);
    this.seen.add(ids[1]);
    this.keyboard.endFrame();
    this.gamepad.endFrame();
    return [a, b];
  }

  destroy(): void {
    if (this.owns) this.keyboard.destroy();
    this.gamepad.clear();
  }

  private advance(): void {
    this.keyboard.endFrame();
    this.gamepad.endFrame();
    this.keyboard.beginFrame();
    this.gamepad.beginFrame();
  }

  private read(id: ControllerId): InputBits {
    switch (id) {
      case 'p1keys':
        return this.keyboard.sample('p1keys') | this.gamepad.sample(0);
      case 'p2keys':
        return this.keyboard.sample('p2keys') | this.gamepad.sample(1);
      default:
        return NO_INPUT;
    }
  }
}
