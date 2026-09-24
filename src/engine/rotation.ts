/** FR-RTN-4: sessions form a rotation queue (not weekdays). Completing one advances; skip-to picks any. */

export interface RotationRoutine {
  sessions: { id: string; name: string }[];
}

export interface RotationQueue {
  nextSessionIndex: number;
  /** Optional user order (indices into routine.sessions). Invalid orders fall back to natural order. */
  order?: number[];
}

export function rotationOrder(routine: RotationRoutine, queue: RotationQueue): number[] {
  const n = routine.sessions.length;
  const o = queue.order;
  if (o && o.length === n && new Set(o).size === n && o.every((i) => i >= 0 && i < n)) return o;
  return Array.from({ length: n }, (_, i) => i);
}

export interface UpNext {
  /** Position in the rotation (0-based). */
  position: number;
  total: number;
  sessionIndex: number;
  session: { id: string; name: string };
}

export function upNext(routine: RotationRoutine, queue: RotationQueue): UpNext | null {
  const order = rotationOrder(routine, queue);
  if (!order.length) return null;
  const position = ((queue.nextSessionIndex % order.length) + order.length) % order.length;
  const sessionIndex = order[position]!;
  return { position, total: order.length, sessionIndex, session: routine.sessions[sessionIndex]! };
}

/** After finishing `completedSessionId`, the next session is the one after it in the rotation. */
export function advance(
  routine: RotationRoutine,
  queue: RotationQueue,
  completedSessionId: string,
): RotationQueue {
  const order = rotationOrder(routine, queue);
  const idx = routine.sessions.findIndex((s) => s.id === completedSessionId);
  const pos = order.indexOf(idx);
  if (pos < 0) return queue;
  return { ...queue, nextSessionIndex: (pos + 1) % order.length };
}

/** "Skip to…": makes the session at rotation position `position` next. */
export function skipTo(routine: RotationRoutine, queue: RotationQueue, position: number): RotationQueue {
  const n = rotationOrder(routine, queue).length;
  if (!n) return queue;
  return { ...queue, nextSessionIndex: ((position % n) + n) % n };
}

/** Moves a session within the rotation (S15 drag reorder), keeping the same session up next. */
export function reorder(
  routine: RotationRoutine,
  queue: RotationQueue,
  from: number,
  to: number,
): RotationQueue {
  const order = [...rotationOrder(routine, queue)];
  if (from < 0 || from >= order.length || to < 0 || to >= order.length) return queue;
  const nextSession = order[queue.nextSessionIndex % order.length];
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved!);
  return { order, nextSessionIndex: Math.max(0, order.indexOf(nextSession!)) };
}
