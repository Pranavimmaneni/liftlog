/** Muscle map (front + back) from pictos.py, ported 1:1 (FR-ILL-1). Red = main, brass = helpers. */
import { C } from './rig';

function colour(key: string, prim: string[], sec: string[]): string {
  if (prim.includes(key)) return C.PRIM;
  if (sec.includes(key)) return C.SEC;
  return C.IDLE;
}

function silhouette(): string {
  const B = C.BODY;
  let s = `<circle cx="50" cy="15" r="10" fill="${B}"/>`;
  s += `<path d="M34 34 Q50 28 66 34 L68 100 Q50 106 32 100 Z" fill="${B}"/>`;
  s += `<path d="M30 40 L20 96" stroke="${B}" stroke-width="11" stroke-linecap="round"/>`;
  s += `<path d="M70 40 L80 96" stroke="${B}" stroke-width="11" stroke-linecap="round"/>`;
  s += `<path d="M42 100 L40 164" stroke="${B}" stroke-width="15" stroke-linecap="round"/>`;
  s += `<path d="M58 100 L60 164" stroke="${B}" stroke-width="15" stroke-linecap="round"/>`;
  return s;
}

export function muscleFront(prim: string[], sec: string[], ox = 0): string {
  const c = (k: string) => colour(k, prim, sec);
  const B = C.BODY;
  let s = `<g transform="translate(${ox} 0)">`;
  s += silhouette();
  s += `<ellipse cx="29" cy="41" rx="8" ry="9" fill="${c('shoulders')}"/>`;
  s += `<ellipse cx="71" cy="41" rx="8" ry="9" fill="${c('shoulders')}"/>`;
  s += `<path d="M49 36 C41 35 35 38 35 44 C35 52 40 57 49 57 Z" fill="${c('chest')}"/>`;
  s += `<path d="M51 36 C59 35 65 38 65 44 C65 52 60 57 51 57 Z" fill="${c('chest')}"/>`;
  s += `<rect x="42" y="60" width="16" height="34" rx="5" fill="${c('abs')}"/>`;
  for (const yy of [69, 77.5, 86]) s += `<path d="M42 ${yy}H58" stroke="${B}" stroke-width="1.6"/>`;
  s += `<path d="M50 60V94" stroke="${B}" stroke-width="1.6"/>`;
  s += `<ellipse cx="25" cy="59" rx="5" ry="10" transform="rotate(10 25 59)" fill="${c('biceps')}"/>`;
  s += `<ellipse cx="75" cy="59" rx="5" ry="10" transform="rotate(-10 75 59)" fill="${c('biceps')}"/>`;
  s += `<ellipse cx="21" cy="83" rx="4.2" ry="10" transform="rotate(10 21 83)" fill="${c('forearms')}"/>`;
  s += `<ellipse cx="79" cy="83" rx="4.2" ry="10" transform="rotate(-10 79 83)" fill="${c('forearms')}"/>`;
  s += `<ellipse cx="42" cy="121" rx="7.5" ry="19" fill="${c('quads')}"/>`;
  s += `<ellipse cx="58" cy="121" rx="7.5" ry="19" fill="${c('quads')}"/>`;
  s += `<ellipse cx="40.5" cy="152" rx="4.5" ry="10" fill="${c('calves')}"/>`;
  s += `<ellipse cx="59.5" cy="152" rx="4.5" ry="10" fill="${c('calves')}"/>`;
  s += '</g>';
  return s;
}

export function muscleBack(prim: string[], sec: string[], ox = 0): string {
  const c = (k: string) => colour(k, prim, sec);
  let s = `<g transform="translate(${ox} 0)">`;
  s += silhouette();
  s += `<ellipse cx="29" cy="41" rx="8" ry="9" fill="${c('shoulders')}"/>`;
  s += `<ellipse cx="71" cy="41" rx="8" ry="9" fill="${c('shoulders')}"/>`;
  s += `<path d="M50 29 L63 38 L50 60 L37 38 Z" fill="${c('upper back')}"/>`;
  s += `<path d="M36 44 C34 58 38 74 47 84 L48 64 Z" fill="${c('lats')}"/>`;
  s += `<path d="M64 44 C66 58 62 74 53 84 L52 64 Z" fill="${c('lats')}"/>`;
  s += `<rect x="44" y="84" width="12" height="14" rx="4" fill="${c('lower back')}"/>`;
  s += `<ellipse cx="25" cy="59" rx="5" ry="10" transform="rotate(10 25 59)" fill="${c('triceps')}"/>`;
  s += `<ellipse cx="75" cy="59" rx="5" ry="10" transform="rotate(-10 75 59)" fill="${c('triceps')}"/>`;
  s += `<ellipse cx="21" cy="83" rx="4.2" ry="10" transform="rotate(10 21 83)" fill="${c('forearms')}"/>`;
  s += `<ellipse cx="79" cy="83" rx="4.2" ry="10" transform="rotate(-10 79 83)" fill="${c('forearms')}"/>`;
  s += `<circle cx="43" cy="107" r="8.5" fill="${c('glutes')}"/>`;
  s += `<circle cx="57" cy="107" r="8.5" fill="${c('glutes')}"/>`;
  s += `<ellipse cx="41.5" cy="130" rx="6.5" ry="14" fill="${c('hamstrings')}"/>`;
  s += `<ellipse cx="58.5" cy="130" rx="6.5" ry="14" fill="${c('hamstrings')}"/>`;
  s += `<ellipse cx="40.5" cy="154" rx="5.2" ry="9.5" fill="${c('calves')}"/>`;
  s += `<ellipse cx="59.5" cy="154" rx="5.2" ry="9.5" fill="${c('calves')}"/>`;
  s += '</g>';
  return s;
}

/** Inner markup of the 210×170 muscle map (front at x 0, back at x 110). */
export function muscleMapBody(prim: string[], sec: string[]): string {
  return muscleFront(prim, sec, 0) + muscleBack(prim, sec, 110);
}

/** Same string pictos.muscle_map() produces (used by the port test). */
export function muscleMapSvg(prim: string[], sec: string[], label = 'Muscles worked'): string {
  return `<svg viewBox="0 0 210 170" width="100%" role="img" aria-label="${label}">${muscleMapBody(prim, sec)}</svg>`;
}
