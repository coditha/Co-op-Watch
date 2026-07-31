import { useState, useRef } from 'react';
import type { GameState } from '../types/game';
import type { GameAction } from '../store/gameReducer';

// 6-sided cube die, numbered 3–8 (the game's actual roll range) instead of
// the usual 1–6 — same cube geometry as a standard CSS 3D die.
const CUBE_SIZE = 35; // half the die's width/height, matches .die3d-cube's 70px
const CUBE_FACES: { value: number; transform: string }[] = [
  { value: 3, transform: `translateZ(${CUBE_SIZE}px)` },
  { value: 8, transform: `rotateY(180deg) translateZ(${CUBE_SIZE}px)` },
  { value: 5, transform: `rotateY(90deg) translateZ(${CUBE_SIZE}px)` },
  { value: 6, transform: `rotateY(-90deg) translateZ(${CUBE_SIZE}px)` },
  { value: 4, transform: `rotateX(-90deg) translateZ(${CUBE_SIZE}px)` },
  { value: 7, transform: `rotateX(90deg) translateZ(${CUBE_SIZE}px)` },
];

// Landing pose per rolled value — just a resting orientation for the whole
// die once it settles; the true result is shown via a separate number overlay.
const FACE_LANDING: Record<number, { rx: number; ry: number }> = {
  3: { rx: 0, ry: 0 }, 4: { rx: 90, ry: 0 }, 5: { rx: 0, ry: -90 },
  6: { rx: 0, ry: 90 }, 7: { rx: -90, ry: 0 }, 8: { rx: 0, ry: 180 },
};
const SPARKLE_DIRS = [
  { tx: 0, ty: -56 }, { tx: 40, ty: -40 }, { tx: 56, ty: 0 }, { tx: 40, ty: 40 },
  { tx: 0, ty: 56 }, { tx: -40, ty: 40 }, { tx: -56, ty: 0 }, { tx: -40, ty: -40 },
  { tx: 28, ty: -50 }, { tx: -28, ty: -50 },
];

function DieCube() {
  return (
    <div className="die3d-cube">
      {CUBE_FACES.map((f) => (
        <div key={f.value} className="die3d-face" style={{ transform: f.transform }}>
          <span className="die3d-face-num">{f.value}</span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  state: GameState;
  dispatch: (a: GameAction) => void;
}

export default function CenterDiceRoll({ state, dispatch }: Props) {
  const [rolling, setRolling] = useState(false);
  const [landed, setLanded] = useState(false);
  const [rollingFace, setRollingFace] = useState(6);
  const [dicePos, setDicePos] = useState({ x: 0, y: 0 });
  const [diceRot, setDiceRot] = useState({ rx: 0, ry: 0, rz: 0 });
  const [diceScale, setDiceScale] = useState(1);
  const [diceTransition, setDiceTransition] = useState('none');
  const rollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const rotAccum = useRef({ rx: 0, ry: 0, rz: 0 });

  const player = state.players[state.currentPlayerIndex];

  function handleDiceTap() {
    if (rolling || landed) return;
    const finalRoll = Math.floor(Math.random() * 6) + 3;
    setRolling(true);
    setLanded(false);
    rotAccum.current = { rx: 0, ry: 0, rz: 0 };

    // Physics-ish throw: pick a consistent launch direction + spin axis.
    // The die travels along a decaying arc and tumbles consistently, then settles.
    const dir = Math.random() * Math.PI * 2;
    const throwDist = 170 + Math.random() * 70;
    const launchX = Math.cos(dir) * throwDist;
    const launchY = Math.sin(dir) * throwDist;
    // A second wander direction so the die roams across the picture, not just out-and-back
    const wanderX = (Math.random() * 2 - 1) * 130;
    const wanderY = (Math.random() * 2 - 1) * 110;
    // Consistent spin velocity per axis (deg per step) — the die keeps spinning
    // the same way like a real thrown die, rather than jittering randomly.
    const spinX = (240 + Math.random() * 160) * (Math.random() < 0.5 ? 1 : -1);
    const spinY = (240 + Math.random() * 160) * (Math.random() < 0.5 ? 1 : -1);
    const spinZ = (80 + Math.random() * 80) * (Math.random() < 0.5 ? 1 : -1);

    const totalSteps = 18;
    function scheduleStep(step: number) {
      const t = step / totalSteps;
      // ease-out timing: steps get slower toward the end
      const delay = 45 + t * t * 240;
      rollTimer.current = setTimeout(() => {
        if (step >= totalSteps) {
          const target = FACE_LANDING[finalRoll];
          const nearest = (acc: number, tt: number) => Math.round((acc - tt) / 360) * 360 + tt;
          const finalRot = {
            rx: nearest(rotAccum.current.rx, target.rx),
            ry: nearest(rotAccum.current.ry, target.ry),
            rz: Math.round(rotAccum.current.rz / 360) * 360,
          };
          setRollingFace(finalRoll);
          setRolling(false);
          setLanded(true);
          const landMs = 260;
          setDiceTransition(`transform ${landMs}ms cubic-bezier(0.34, 1.56, 0.64, 1)`);
          setDicePos({ x: 0, y: 0 });
          setDiceRot(finalRot);
          setDiceScale(1);
          navigator.vibrate?.([60, 30, 60]);
          setTimeout(() => dispatch({ type: 'ROLL_DIE', precomputedRoll: finalRoll }), landMs + 900);
        } else {
          // Decaying spin — fast at first, slows as it settles
          const decay = 1 - t * 0.7;
          rotAccum.current = {
            rx: rotAccum.current.rx + spinX * decay,
            ry: rotAccum.current.ry + spinY * decay,
            rz: rotAccum.current.rz + spinZ * decay,
          };
          // Position roams the picture: an out-and-back arc plus a wandering
          // figure that fades as the die settles back to center.
          const arc = Math.sin(t * Math.PI);            // 0 → 1 → 0 over the roll
          const settle = 1 - t * t;                      // stays wide longer, then pulls in
          const x = (launchX * arc + wanderX * Math.sin(t * Math.PI * 2)) * settle;
          const hop = Math.abs(Math.sin(t * Math.PI * 3)) * 24 * (1 - t); // little bounces
          const y = (launchY * arc + wanderY * Math.cos(t * Math.PI * 2)) * settle - hop;
          const scale = 1.12 - t * 0.12;
          setDiceTransition(`transform ${delay}ms cubic-bezier(0.33, 0, 0.67, 1)`);
          setDicePos({ x, y });
          setDiceRot({ ...rotAccum.current });
          setDiceScale(scale);
          const buzzLen = Math.round(6 + (1 - t) * 40);
          navigator.vibrate?.(buzzLen);
          scheduleStep(step + 1);
        }
      }, delay);
    }
    scheduleStep(0);
  }

  const facesTop = player.role.id === 'organizer' || player.role.id === 'captain';

  return (
    <div className="center-dice-overlay">
      <div className="center-dice-bg" />
      <div className={`center-dice-panel${facesTop ? ' center-dice-panel-rotated' : ''}`} style={{ borderColor: player.role.colorHex }}>
        <div className="ap-dice-perspective">
          {landed && <div className="center-dice-result">{rollingFace}</div>}
          {landed && <div className="center-dice-ground-shadow" />}
          <div
            className={`ap-die-wrap${rolling ? ' jitter' : landed ? ' land' : ''}`}
            onClick={handleDiceTap}
            role="button"
            aria-label="Roll dice"
            style={{
              transform: `translate(${dicePos.x}px, ${dicePos.y}px) rotateX(${diceRot.rx}deg) rotateY(${diceRot.ry}deg) rotateZ(${diceRot.rz}deg) scale(${diceScale})`,
              transition: diceTransition,
            }}
          >
            <DieCube />
          </div>
          {landed && SPARKLE_DIRS.map((dir, i) => (
            <span
              key={i}
              className="px-sparkle"
              style={{ '--tx': `${dir.tx}px`, '--ty': `${dir.ty}px` } as React.CSSProperties}
            />
          ))}
        </div>
        {!rolling && !landed && (
          <div className="center-dice-cta" style={{ background: player.role.colorHex, borderColor: player.role.colorHex, cursor: 'pointer' }} onClick={handleDiceTap}>
            Click dice to roll
          </div>
        )}
      </div>
    </div>
  );
}
