/** Copy for the Rising Sun Progress, review, strength, summary and body screens. Merged into `en.sun.progress`. */
export const sunProgress = {
  /** S12 Progress hub. */
  hub: {
    week: (n: number) => `Week ${n}`,
    inWeeks: (n: number) => `in ${n} week${n === 1 ? '' : 's'}`,
    latest: 'Latest weigh-in',
    since: (date: string) => `since ${date}`,
    more: 'Your numbers',
    bodyWeight: 'Body weight',
    add: 'Add',
    level: (n: number) => `Level ${n}`,
    xp: (n: string) => `${n} XP`,
    streak: 'Streak',
    weeks: (n: number) => (n === 1 ? '1 week' : `${n} weeks`),
    thisWeek: (done: number, planned: number) => `${done} of ${planned} sessions this week`,
    strength: 'Strength level',
    records: 'Records',
    noRecords: 'None yet',
    recordSet: (set: string, date: string) => `${set} · ${date}`,
    sessionCount: (n: number) => (n === 1 ? '1 session' : `${n} sessions`),
  },
  /** S09 Workout summary. */
  summary: {
    title: 'Workout done',
    goalSetsHit: 'goal sets hit',
    pct: (n: number) => `${n}%`,
    time: 'time',
    lifted: 'lifted',
    xp: 'XP',
    sets: 'sets',
    lifts: 'Lifts',
    record: 'New record',
    moreLifts: (n: number) => (n === 1 ? '1 more lift' : `${n} more lifts`),
    reps: (reps: string) => `${reps} reps`,
    details: 'Details',
    celebrate: (name: string, sets: number) => `${name} · ${sets === 1 ? '1 set' : `${sets} sets`}`,
  },
  /** S10 Weekly / monthly review. */
  review: {
    title: 'Review',
    week: 'Week',
    month: 'Month',
    sessions: 'sessions',
    goalSets: 'goal sets',
    records: 'records',
    of: (a: number, b: number) => `${a} of ${b}`,
  },
  /** S11 Strength levels. */
  strength: {
    overall: 'Overall',
    notYet: 'Not yet',
    basedOn: 'Muscles these levels are based on',
    best: (name: string, value: string) => `${name} · ${value}`,
  },
  /** S18 Past session. */
  session: {
    records: (n: number) => (n === 1 ? '1 record' : `${n} records`),
    goalSets: 'goal sets',
    line: (sets: number, reps: string, bonus: number) =>
      `${sets === 1 ? '1 set' : `${sets} sets`} · ${reps} reps · +${bonus} bonus`,
    warm: 'Warm-up',
  },
  /** S20 Weigh-in sheet. */
  weighIn: {
    unit: (units: string, step: number) => `${units} · steps of ${step}`,
  },
};
