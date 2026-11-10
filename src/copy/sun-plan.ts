/** Copy for the Rising Sun Plan, routine, library and exercise screens. Merged into `en.sun.plan`. */
export const sunPlan = {
  sessions: (d: number, t: number) => `${d} of ${t} sessions`,
  liftsSets: (lifts: number, sets: number) =>
    `${lifts === 1 ? '1 lift' : `${lifts} lifts`} · ${sets === 1 ? '1 set' : `${sets} sets`}`,
  library: 'Library',
  newExercise: 'New',
  weeklySets: 'Weekly sets per muscle',
  setsOf: (sets: number, target: number) => `${sets} of ${target} sets`,
  lastSessions: 'Last sessions',
  about: (main: string, helps: string, gear: string) => [main, helps, gear].filter(Boolean).join(' · '),
};
