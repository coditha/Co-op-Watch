import { useState, useRef } from 'react';
import type { GameState } from '../types/game';
import type { GameAction } from '../store/gameReducer';

// 8-sided die (octahedron): a square bipyramid — 4 upper + 4 lower triangular
// faces. Each face's exact 3D placement is solved from its 3 target vertices
// (rather than guessed via rotateX/rotateY signs), which is what guarantees
// the upper and lower halves seal together with no gap at the equator.
type Vec3 = [number, number, number];
function vsub(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function vnorm(v: Vec3): number { return Math.hypot(v[0], v[1], v[2]); }
function vnormalize(v: Vec3): Vec3 { const n = vnorm(v); return [v[0] / n, v[1] / n, v[2] / n]; }
type Mat3 = [[number, number, number], [number, number, number], [number, number, number]];
function matFromCols(c1: Vec3, c2: Vec3, c3: Vec3): Mat3 {
  return [[c1[0], c2[0], c3[0]], [c1[1], c2[1], c3[1]], [c1[2], c2[2], c3[2]]];
}
function matInverse(m: Mat3): Mat3 {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const D = -(b * i - c * h), E = a * i - c * g, F = -(a * h - b * g);
  const G = b * f - c * e, H = -(a * f - c * d), I = a * e - b * d;
  const det = a * A + b * B + c * C;
  return [[A / det, D / det, G / det], [B / det, E / det, H / det], [C / det, F / det, I / det]];
}
function matMul(m1: Mat3, m2: Mat3): Mat3 {
  const r: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let s = 0; for (let k = 0; k < 3; k++) s += m1[i][k] * m2[k][j];
    r[i][j] = s;
  }
  return r as Mat3;
}
function matVec(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

// Octahedron vertices: shared top/bottom poles + 4 equatorial points.
const OCTA_S = 50;
const OCTA_N: Vec3 = [0, -OCTA_S, 0];
const OCTA_SP: Vec3 = [0, OCTA_S, 0];
const OCTA_AZIMUTHS = [45, 135, 225, 315];
const OCTA_EQUATOR: Vec3[] = OCTA_AZIMUTHS.map((deg) => {
  const a = (deg * Math.PI) / 180;
  return [OCTA_S * Math.sin(a), 0, OCTA_S * Math.cos(a)];
});
const OCTA_PAIRS: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0]];

// Flat (pre-transform) triangle: apex at top-center, base at bottom, local
// origin at the div's own center (its default transform-origin).
const FACE_W = 67, FACE_H = 58;
const LOCAL_APEX: Vec3 = [0, -FACE_H / 2, 0];
const LOCAL_BASE_L: Vec3 = [-FACE_W / 2, FACE_H / 2, 0];
const LOCAL_BASE_R: Vec3 = [FACE_W / 2, FACE_H / 2, 0];
const SOURCE_INV = matInverse(matFromCols(
  vsub(LOCAL_BASE_L, LOCAL_APEX), vsub(LOCAL_BASE_R, LOCAL_APEX), [0, 0, 1],
));

function faceMatrix3d(apex: Vec3, v1: Vec3, v2: Vec3): string {
  const centroid: Vec3 = [
    (apex[0] + v1[0] + v2[0]) / 3, (apex[1] + v1[1] + v2[1]) / 3, (apex[2] + v1[2] + v2[2]) / 3,
  ];
  const normal = vnormalize(centroid); // outward normal, since the shape is centered at the origin
  const target = matFromCols(vsub(v1, apex), vsub(v2, apex), normal);
  const M = matMul(target, SOURCE_INV);
  const T = vsub(apex, matVec(M, LOCAL_APEX));
  const c1 = [M[0][0], M[1][0], M[2][0], 0];
  const c2 = [M[0][1], M[1][1], M[2][1], 0];
  const c3 = [M[0][2], M[1][2], M[2][2], 0];
  const c4 = [T[0], T[1], T[2], 1];
  return `matrix3d(${[...c1, ...c2, ...c3, ...c4].join(',')})`;
}

const OCTA_TOP_FACES = OCTA_PAIRS.map(([i, j], idx) => ({
  value: idx + 1,
  transform: faceMatrix3d(OCTA_N, OCTA_EQUATOR[i], OCTA_EQUATOR[j]),
}));
const OCTA_BOTTOM_FACES = OCTA_PAIRS.map(([i, j], idx) => ({
  value: idx + 5,
  transform: faceMatrix3d(OCTA_SP, OCTA_EQUATOR[i], OCTA_EQUATOR[j]),
}));

// Landing pose per rolled value — just a resting orientation for the whole
// die once it settles; the true result is shown via a separate number overlay.
const OCTA_TILT = 35.264;
const FACE_LANDING: Record<number, { rx: number; ry: number }> = {
  3: { rx: -OCTA_TILT, ry: 45 },
  4: { rx: -OCTA_TILT, ry: 135 },
  5: { rx: -OCTA_TILT, ry: 225 },
  6: { rx: -OCTA_TILT, ry: 315 },
  7: { rx: OCTA_TILT, ry: 45 },
  8: { rx: OCTA_TILT, ry: 135 },
};
const SPARKLE_DIRS = [
  { tx: 0, ty: -56 }, { tx: 40, ty: -40 }, { tx: 56, ty: 0 }, { tx: 40, ty: 40 },
  { tx: 0, ty: 56 }, { tx: -40, ty: 40 }, { tx: -56, ty: 0 }, { tx: -40, ty: -40 },
  { tx: 28, ty: -50 }, { tx: -28, ty: -50 },
];

function DieOcta() {
  return (
    <div className="die3d-octa">
      {OCTA_TOP_FACES.map((f) => (
        <div key={`top-${f.value}`} className="die3d-face die3d-face-top" style={{ transform: f.transform }}>
          <span className="die3d-face-num">{f.value}</span>
        </div>
      ))}
      {OCTA_BOTTOM_FACES.map((f) => (
        <div key={`bot-${f.value}`} className="die3d-face die3d-face-bottom" style={{ transform: f.transform }}>
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
            <DieOcta />
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
