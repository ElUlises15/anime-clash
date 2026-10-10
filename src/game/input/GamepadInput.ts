import { BTN, NO_INPUT, type InputBits, has } from './buttons';
import {
  createDoubleTapState,
  noteDirPress,
  tickDash,
  type DoubleTapState,
} from './doubleTap';

const AXIS_DEAD = 0.45;
const AXIS_TAP = 0.55;

interface PadState {
  prev: InputBits;
  dt: DoubleTapState;
}

/**
 * Standard Gamepad mapping → BTN bits.
 * Pad 0 is combined with p1keys, pad 1 with p2keys (see InputManager).
 *
 * Face: A light, B heavy, X sp1, Y sp2
 * LB / LT block, RB ult, RT / L3 dash
 * D-pad + left stick for movement
 */
export class GamepadInput {
  private pads: PadState[] = [fresh(), fresh(), fresh(), fresh()];
  private frame = 0;
  private advanced = false;

  beginFrame(): void {
    if (this.advanced) return;
    this.frame += 1;
    this.advanced = true;
  }

  endFrame(): void {
    this.advanced = false;
  }

  sample(index: number): InputBits {
    this.beginFrame();
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return NO_INPUT;
    let list: (Gamepad | null)[];
    try {
      list = navigator.getGamepads();
    } catch {
      return NO_INPUT;
    }
    const gp = list[index];
    if (!gp) return NO_INPUT;

    const st = this.pads[index] ?? (this.pads[index] = fresh());
    let bits = NO_INPUT;
    const b = gp.buttons;
    const ax = gp.axes;

    const leftStick = (ax[0] ?? 0) < -AXIS_DEAD;
    const rightStick = (ax[0] ?? 0) > AXIS_DEAD;
    const upStick = (ax[1] ?? 0) < -AXIS_DEAD;
    const downStick = (ax[1] ?? 0) > AXIS_DEAD;

    if (pressed(b[14]) || leftStick) bits |= BTN.LEFT;
    if (pressed(b[15]) || rightStick) bits |= BTN.RIGHT;
    if (pressed(b[12]) || upStick) bits |= BTN.UP;
    if (pressed(b[13]) || downStick) bits |= BTN.DOWN;

    if (pressed(b[0])) bits |= BTN.LIGHT;
    if (pressed(b[1])) bits |= BTN.HEAVY;
    if (pressed(b[2])) bits |= BTN.SP1;
    if (pressed(b[3])) bits |= BTN.SP2;
    if (pressed(b[4]) || pressed(b[6])) bits |= BTN.BLOCK;
    if (pressed(b[5])) bits |= BTN.ULT;

    const dashBtn = pressed(b[7]) || pressed(b[10]) || pressed(b[11]);
    const dirHeld = has(bits, BTN.LEFT) || has(bits, BTN.RIGHT);

    const leftEdge = has(bits, BTN.LEFT) && !has(st.prev, BTN.LEFT) && (pressed(b[14]) || (ax[0] ?? 0) < -AXIS_TAP);
    const rightEdge = has(bits, BTN.RIGHT) && !has(st.prev, BTN.RIGHT) && (pressed(b[15]) || (ax[0] ?? 0) > AXIS_TAP);
    if (leftEdge) noteDirPress(st.dt, 'left', this.frame);
    if (rightEdge) noteDirPress(st.dt, 'right', this.frame);

    const lingering = tickDash(st.dt);
    if (lingering || (dashBtn && dirHeld)) bits |= BTN.DASH;

    st.prev = bits;
    return bits;
  }

  clear(): void {
    this.pads = [fresh(), fresh(), fresh(), fresh()];
  }
}

function fresh(): PadState {
  return { prev: NO_INPUT, dt: createDoubleTapState() };
}

function pressed(b: GamepadButton | undefined): boolean {
  if (!b) return false;
  return b.pressed || b.value > 0.5;
}
