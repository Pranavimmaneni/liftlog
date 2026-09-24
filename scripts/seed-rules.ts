/**
 * Deterministic rules that turn free-exercise-db rows into LiftLog exercises (FR-LIB-1/2).
 * The dataset has no patterns, load types, increments, machine ids or limitation areas,
 * so they are derived here (DECISIONS D9, D10, D11, D18). Every rule is unit-tested.
 */
import type { Experience, LoadType, MuscleGroup, Pattern, Role } from '../src/engine/types';

export interface RawExercise {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

export const KEEP_CATEGORIES = ['strength', 'powerlifting'];
export const KEEP_EQUIPMENT = [
  'barbell',
  'dumbbell',
  'body only',
  'cable',
  'machine',
  'kettlebells',
  'e-z curl bar',
];

/** Useful lifts whose dataset category/equipment would otherwise drop them. */
export const INCLUDE_ANYWAY: Record<string, string> = {
  'Trap Bar Deadlift': 'trap bar',
  "Farmer's Walk": 'dumbbell',
  'Ab Roller': 'body only',
  'Hyperextensions (Back Extensions)': 'body only',
  'Parallel Bar Dip': 'body only',
  'Dips - Chest Version': 'body only',
};

/** Explicit drops with reasons (listed in SEED-REPORT.md). Regexes are tested against the dataset name. */
export const DROP_RULES: { re: RegExp; reason: string }[] = [
  {
    re: /with (chains|bands)|reverse band|band(s)?\b/i,
    reason: 'band or chain accommodating resistance (load can’t be logged)',
  },
  {
    re: /\b(speed|board press|pin press(es)?|plate movers|power partials|anti-gravity|car drivers|judo flip)\b/i,
    reason: 'specialist powerlifting drill',
  },
  {
    re: /\b(clean|snatch|jerk|swings?|thruster|high pull|get-up|windmill|figure 8|halo|pirate|pass between|pass through|sumo high pull)\b/i,
    reason: 'ballistic / Olympic-style lift (not tracked as sets × reps × load)',
  },
  {
    re: /\b(jump|sprint|air bike|wind sprints|plyo|spider crawl|body-up|clock push-up|bottoms up)\b/i,
    reason: 'conditioning / plyometric drill',
  },
  { re: /\bneck\b|isometric/i, reason: 'neck or isometric drill' },
  {
    re: /\b(landmine|linear jammer|bradford|jefferson|kneeling squat|guillotine|cuban press|around the worlds|spell caster|iron cross)\b/i,
    reason: 'uncommon equipment or technique-heavy variation',
  },
  { re: /exercise ball|bosu/i, reason: 'needs a stability ball' },
  { re: /\bpistol\b|single-arm push-up|handstand/i, reason: 'advanced skill movement' },
  {
    re: /(internal|external) rotation|pronation|supination|wrist rotations|finger curls/i,
    reason: 'rehab / prehab accessory',
  },
  {
    re: /^(cocoons|butt-ups|frog sit-ups|gorilla chin\/crunch|hanging pike|leg pull-in|seated leg tucks|flutter kicks|isometric wipers|elbow to knee|janda sit-up|3\/4 sit-up|alternate heel touchers|tuck crunch|bent-knee hip raise|body tricep press|step-up with knee raise|dead bug)$/i,
    reason: 'near-duplicate core drill',
  },
  {
    re: /^(barbell squat|barbell full squat to a bench|narrow stance squats|wide stance barbell squat|squat with plate movers|barbell squat to a bench|front barbell squat to a bench|dumbbell squat to a bench|chair squat|lying machine squat|one leg barbell squat)$/i,
    reason: 'duplicate squat variation',
  },
  {
    re: /^(hyperextensions with no hyperextension bench|pushups \(close and wide hand positions\)|incline push-up medium|incline push-up reverse grip|incline push-up wide|push-up wide|triceps pushdown - v-bar attachment|wide-grip pulldown behind the neck|standing barbell press behind neck|bodyweight flyes|close-grip ez-bar curl with band|middle back shrug|calf-machine shoulder shrug|smith machine behind the back shrug|barbell shrug behind the back|smith machine hang power clean|smith machine pistol squat|smith machine leg press|lunge sprint)$/i,
    reason: 'duplicate or awkward variation',
  },
];

/** Dataset name → canonical LiftLog name (matches aliases.json / machines.json keys). */
export const RENAMES: Record<string, string> = {
  'Barbell Full Squat': 'Back Squat',
  'Barbell Bench Press - Medium Grip': 'Bench Press',
  'Barbell Incline Bench Press - Medium Grip': 'Incline Barbell Bench Press',
  'Barbell Deadlift': 'Deadlift',
  'Bent Over Barbell Row': 'Bent-Over Barbell Row',
  'Standing Military Press': 'Overhead Press',
  'Wide-Grip Lat Pulldown': 'Lat Pulldown',
  'Seated Cable Rows': 'Seated Cable Row',
  'Triceps Pushdown - Rope Attachment': 'Rope Pushdown',
  Pullups: 'Pull-Up',
  'Machine Shoulder (Military) Press': 'Machine Shoulder Press',
  'Lying Triceps Press': 'Lying Triceps Extension',
  'Barbell Hip Thrust': 'Hip Thrust',
  Butterfly: 'Pec Deck Fly',
  'Reverse Machine Flyes': 'Reverse Pec Deck',
  'Leg Extensions': 'Leg Extension',
  'Standing Calf Raises': 'Standing Calf Raise',
  'Side Lateral Raise': 'Dumbbell Lateral Raise',
  'Hammer Curls': 'Hammer Curl',
  'Lying Leg Curls': 'Lying Leg Curl',
  'Thigh Abductor': 'Hip Abduction',
  'Thigh Adductor': 'Hip Adduction',
  'Machine Bicep Curl': 'Machine Biceps Curl',
  'Dip Machine': 'Seated Dip Machine',
  'Ab Crunch Machine': 'Machine Crunch',
  'Leverage Chest Press': 'Machine Chest Press',
  'Leverage Incline Chest Press': 'Machine Incline Chest Press',
  'Leverage Decline Chest Press': 'Machine Decline Chest Press',
  'Leverage Iso Row': 'Iso-Lateral Row',
  'Leverage High Row': 'Iso-Lateral High Row',
  'Leverage Shoulder Press': 'Iso-Lateral Shoulder Press',
  'Leverage Deadlift': 'Machine Deadlift',
  'Leverage Shrug': 'Machine Shrug',
  'Glute Ham Raise': 'Glute-Ham Raise',
  'Smith Machine Squat': 'Smith Squat',
  'Smith Machine Bench Press': 'Smith Bench Press',
  'Smith Machine Incline Bench Press': 'Smith Incline Press',
  'Smith Machine Overhead Shoulder Press': 'Smith Shoulder Press',
  'Smith Machine Calf Raise': 'Smith Calf Raise',
  'Smith Machine Stiff-Legged Deadlift': 'Smith Romanian Deadlift',
  'Close-Grip Front Lat Pulldown': 'Close-Grip Pulldown',
  'Cable Crossover': 'Cable Fly',
  'Pull Through': 'Cable Pull-Through',
  'Triceps Overhead Extension with Rope': 'Overhead Cable Triceps Extension',
  'Standing Biceps Cable Curl': 'Cable Curl',
  'Standing Low-Pulley Deltoid Raise': 'Cable Lateral Raise',
  'Lying T-Bar Row': 'Chest-Supported T-Bar Row',
  'T-Bar Row with Handle': 'T-Bar Row',
  'Calf Press On The Leg Press Machine': 'Leg Press Calf Raise',
  'Dips - Triceps Version': 'Dip',
  'Parallel Bar Dip': 'Parallel Bar Dip',
  'Dips - Chest Version': 'Chest Dip',
  'Dumbbell Incline Row': 'Chest-Supported Dumbbell Row',
  'One-Arm Dumbbell Row': 'Single-Arm Dumbbell Row',
  'Hyperextensions (Back Extensions)': '45 Degree Back Extension',
  'Ab Roller': 'Ab Wheel Rollout',
  "Farmer's Walk": "Farmer's Carry",
  Pushups: 'Push-Up',
  Crunches: 'Crunch',
  'Barbell Curl': 'Barbell Curl',
  'EZ-Bar Curl': 'EZ-Bar Curl',
  'Machine Preacher Curls': 'Machine Preacher Curl',
  'Narrow Stance Hack Squats': 'Narrow Stance Hack Squat',
  'Smith Machine Upright Row': 'Smith Upright Row',
  'Smith Machine Bent Over Row': 'Smith Bent-Over Row',
  'Smith Machine Close-Grip Bench Press': 'Smith Close-Grip Bench Press',
  'Smith Machine Decline Press': 'Smith Decline Press',
  'Smith Machine Hip Raise': 'Smith Hip Raise',
  'Smith Machine Reverse Calf Raises': 'Smith Reverse Calf Raise',
  'Smith Machine One-Arm Upright Row': 'Smith One-Arm Upright Row',
  'Smith Single-Leg Split Squat': 'Smith Split Squat',
  'Standing Leg Curl': 'Standing Leg Curl',
  'Calf Press': 'Machine Calf Press',
  'Decline Smith Press': 'Smith Decline Bench Press',
  'Machine Bench Press': 'Machine Bench Press',
  'Front Barbell Squat': 'Front Squat',
  'Stiff-Legged Barbell Deadlift': 'Stiff-Legged Deadlift',
  'Split Squat with Dumbbells': 'Dumbbell Split Squat',
  'Dumbbell Step Ups': 'Dumbbell Step-Up',
  'Barbell Step Ups': 'Barbell Step-Up',
  'Dumbbell Lunges': 'Dumbbell Lunge',
  'Concentration Curls': 'Concentration Curl',
  'Dumbbell Flyes': 'Dumbbell Fly',
  'Incline Dumbbell Flyes': 'Incline Dumbbell Fly',
  'Decline Dumbbell Flyes': 'Decline Dumbbell Fly',
  'Flat Bench Cable Flyes': 'Flat Bench Cable Fly',
  'Reverse Flyes': 'Dumbbell Reverse Fly',
  'Seated Calf Raise': 'Seated Calf Raise',
  'Tricep Dumbbell Kickback': 'Dumbbell Triceps Kickback',
};

/** Extra aliases per canonical name (on top of aliases.json and the original dataset name). */
export const EXTRA_ALIASES: Record<string, string[]> = {
  'Back Squat': ['squat', 'barbell squat', 'high bar squat'],
  'Bench Press': ['barbell bench press', 'flat bench'],
  Deadlift: ['conventional deadlift', 'barbell deadlift'],
  'Incline Dumbbell Press': ['incline db press'],
  'Machine Shoulder Press': ['shoulder press machine'],
  'Seated Leg Curl': ['seated hamstring curl'],
  'Leg Press': ['45 leg press', 'sled press'],
  'Single-Arm Dumbbell Row': ['single-arm db row', 'one arm row', 'db row'],
  'Chest-Supported Dumbbell Row': ['chest-supported db row', 'incline db row'],
  'Dumbbell Bench Press': ['db bench press', 'db bench'],
  'Dumbbell Shoulder Press': ['db shoulder press', 'seated dumbbell press'],
  'Triceps Pushdown': ['tricep pushdown', 'bar pushdown'],
  'Push-Up': ['pushup', 'press-up'],
};

/** Exercises named in machines.json (and a few staples) that the dataset lacks. */
export interface CustomSeed {
  name: string;
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  equipment: string;
  mechanic: 'compound' | 'isolation';
  level: Experience;
  instructions: string[];
}

export const CUSTOM_SEEDS: CustomSeed[] = [
  {
    name: 'Seated Machine Row',
    primary: ['upper back'],
    secondary: ['lats', 'biceps'],
    equipment: 'machine',
    mechanic: 'compound',
    level: 'beginner',
    instructions: [
      'Set the seat so the handles are at chest height and the chest pad supports you.',
      'Pull the handles to your ribs, squeezing the shoulder blades together.',
      'Return under control until the arms are straight.',
    ],
  },
  {
    name: 'Machine Lateral Raise',
    primary: ['shoulders'],
    secondary: [],
    equipment: 'machine',
    mechanic: 'isolation',
    level: 'beginner',
    instructions: [
      'Line your shoulders up with the machine pivots.',
      'Raise the pads out to the side until the upper arms are level with the shoulders.',
      'Lower slowly.',
    ],
  },
  {
    name: 'Assisted Pull-Up',
    primary: ['lats'],
    secondary: ['biceps', 'upper back'],
    equipment: 'machine',
    mechanic: 'compound',
    level: 'beginner',
    instructions: [
      'Kneel or stand on the platform and choose the assistance. More weight = more help.',
      'Pull until your chin clears the handles.',
      'Lower until the arms are straight.',
    ],
  },
  {
    name: 'Assisted Dip',
    primary: ['triceps'],
    secondary: ['chest', 'shoulders'],
    equipment: 'machine',
    mechanic: 'compound',
    level: 'beginner',
    instructions: [
      'Kneel on the pad and grip the dip handles. More weight = more help.',
      'Lower until the upper arms are about level with the floor.',
      'Press back up to straight arms.',
    ],
  },
  {
    name: 'Rotary Torso',
    primary: ['abs'],
    secondary: [],
    equipment: 'machine',
    mechanic: 'isolation',
    level: 'beginner',
    instructions: [
      'Sit tall with the chest against the pads.',
      'Rotate the torso against the resistance, keeping the hips still.',
      'Return slowly and repeat, then switch sides.',
    ],
  },
  {
    name: 'Machine Back Extension',
    primary: ['lower back'],
    secondary: ['glutes', 'hamstrings'],
    equipment: 'machine',
    mechanic: 'isolation',
    level: 'beginner',
    instructions: [
      'Sit with the pad across your upper back and feet braced.',
      'Extend backwards until the torso is just past upright.',
      'Return slowly.',
    ],
  },
  {
    name: 'Single-Leg Press',
    primary: ['quads'],
    secondary: ['glutes', 'hamstrings'],
    equipment: 'machine',
    mechanic: 'compound',
    level: 'intermediate',
    instructions: [
      'Place one foot in the middle of the platform.',
      'Lower until the knee is at about 90°, keeping the hips down.',
      'Press back up without locking the knee. Repeat, then switch legs.',
    ],
  },
  {
    name: 'Seated Leg Press',
    primary: ['quads'],
    secondary: ['glutes', 'hamstrings'],
    equipment: 'machine',
    mechanic: 'compound',
    level: 'beginner',
    instructions: [
      'Set the seat so the knees start at about 90°.',
      'Press the platform away until the legs are nearly straight.',
      'Return under control.',
    ],
  },
  {
    name: 'Reverse Hack Squat',
    primary: ['glutes'],
    secondary: ['quads', 'hamstrings'],
    equipment: 'machine',
    mechanic: 'compound',
    level: 'intermediate',
    instructions: [
      'Face the pad with shoulders under the yokes.',
      'Sit back and down, hinging slightly at the hips.',
      'Drive up through the whole foot.',
    ],
  },
  {
    name: 'Pendulum Squat',
    primary: ['quads'],
    secondary: ['glutes'],
    equipment: 'machine',
    mechanic: 'compound',
    level: 'intermediate',
    instructions: [
      'Stand on the platform with the pads on your shoulders.',
      'Squat down as deep as is comfortable, knees tracking over toes.',
      'Drive back up.',
    ],
  },
  {
    name: 'Belt Squat',
    primary: ['quads'],
    secondary: ['glutes'],
    equipment: 'machine',
    mechanic: 'compound',
    level: 'intermediate',
    instructions: [
      'Attach the belt at the hips and stand on the platform.',
      'Squat down with a tall torso.',
      'Stand back up.',
    ],
  },
  {
    name: 'Machine Glute Kickback',
    primary: ['glutes'],
    secondary: ['hamstrings'],
    equipment: 'machine',
    mechanic: 'isolation',
    level: 'beginner',
    instructions: [
      'Brace on the chest pad with one foot on the platform.',
      'Push the leg back until the hip is fully extended.',
      'Return slowly, then switch legs.',
    ],
  },
  {
    name: 'Machine Hip Thrust',
    primary: ['glutes'],
    secondary: ['hamstrings'],
    equipment: 'machine',
    mechanic: 'compound',
    level: 'beginner',
    instructions: [
      'Sit with your upper back on the pad and the belt across the hips.',
      'Drive the hips up until they are in line with the torso.',
      'Lower under control.',
    ],
  },
  {
    name: 'Iso-Lateral Chest Press',
    primary: ['chest'],
    secondary: ['triceps', 'shoulders'],
    equipment: 'machine',
    mechanic: 'compound',
    level: 'beginner',
    instructions: [
      'Set the seat so the handles are at mid-chest.',
      'Press forward until the arms are straight.',
      'Return until you feel a stretch across the chest.',
    ],
  },
  {
    name: 'Iso-Lateral Pulldown',
    primary: ['lats'],
    secondary: ['biceps', 'upper back'],
    equipment: 'machine',
    mechanic: 'compound',
    level: 'beginner',
    instructions: [
      'Sit with thighs under the pad.',
      'Pull the handles down to the upper chest, elbows driving down.',
      'Return until the arms are straight.',
    ],
  },
  {
    name: 'EZ-Bar Preacher Curl',
    primary: ['biceps'],
    secondary: ['forearms'],
    equipment: 'e-z curl bar',
    mechanic: 'isolation',
    level: 'beginner',
    instructions: [
      'Rest the backs of the upper arms on the preacher pad.',
      'Curl the bar up without lifting the elbows.',
      'Lower until the arms are almost straight.',
    ],
  },
  {
    name: 'Hanging Knee Raise',
    primary: ['abs'],
    secondary: [],
    equipment: 'body only',
    mechanic: 'isolation',
    level: 'beginner',
    instructions: [
      'Hang from the bar with straight arms.',
      'Bring the knees up towards the chest, curling the pelvis.',
      'Lower slowly without swinging.',
    ],
  },
  {
    name: "Captain's Chair Leg Raise",
    primary: ['abs'],
    secondary: [],
    equipment: 'body only',
    mechanic: 'isolation',
    level: 'beginner',
    instructions: [
      'Support yourself on the forearm pads, back against the chair.',
      'Raise the knees (or straight legs) to hip height.',
      'Lower slowly.',
    ],
  },
  {
    name: 'Bulgarian Split Squat',
    primary: ['quads'],
    secondary: ['glutes', 'hamstrings'],
    equipment: 'dumbbell',
    mechanic: 'compound',
    level: 'intermediate',
    instructions: [
      'Stand in front of a bench and rest the back foot on it.',
      'Lower until the front thigh is about level, torso tall.',
      'Drive up through the front foot. Finish the set, then switch legs.',
    ],
  },
  {
    name: 'Cable Lateral Raise',
    primary: ['shoulders'],
    secondary: [],
    equipment: 'cable',
    mechanic: 'isolation',
    level: 'beginner',
    instructions: [
      'Stand side-on to a low pulley and hold the handle in the far hand.',
      'Raise the arm out to the side to shoulder height.',
      'Lower slowly. Finish the set, then switch sides.',
    ],
  },
];

// ---------- muscles ----------

export const MUSCLE_MAP: Record<string, MuscleGroup | null> = {
  abdominals: 'abs',
  abductors: 'glutes',
  adductors: 'quads',
  biceps: 'biceps',
  calves: 'calves',
  chest: 'chest',
  forearms: 'forearms',
  glutes: 'glutes',
  hamstrings: 'hamstrings',
  lats: 'lats',
  'lower back': 'lower back',
  'middle back': 'upper back',
  neck: null,
  quadriceps: 'quads',
  shoulders: 'shoulders',
  traps: 'upper back',
  triceps: 'triceps',
};

export function mapMuscles(list: string[]): MuscleGroup[] {
  const out: MuscleGroup[] = [];
  for (const m of list) {
    const g = MUSCLE_MAP[m];
    if (g && !out.includes(g)) out.push(g);
  }
  return out;
}

// ---------- patterns ----------

/** Ordered: first match wins. Tested against the lower-cased canonical name. */
const PATTERN_RULES: [RegExp, Pattern | null][] = [
  [/calf/, 'calf_raise'],
  [/wrist curl/, 'elbow_flexion'],
  [/leg curl|hamstring curl|glute-ham|glute ham/, 'knee_flexion'],
  [/leg extension|sissy squat/, 'knee_extension'],
  [/curl/, 'elbow_flexion'],
  [/face pull|rear delt|reverse fly|reverse pec|rear lateral|band pull apart|back flyes/, 'rear_delt'],
  [
    /lateral raise|side lateral|deltoid raise|laterals|scaption|shoulder raise|front .*raise|raise.*front|dumbbell raise|cable raise/,
    'lateral_raise',
  ],
  [/upright row|shrug/, null],
  [/fly|flye|crossover|pec deck|butterfly/, 'chest_fly'],
  [/pullover/, 'vertical_pull'],
  [/pulldown|pull-up|pullup|chin-up|chinup|pull up/, 'vertical_pull'],
  [/pull-through|pull through|good morning|deadlift|rdl|rack pull/, 'hinge'],
  [/row/, 'horizontal_pull'],
  [
    /pushdown|kickback(?!.*glute)|triceps? extension|tricep extension|skull|jm press|tate press|triceps press|dip machine|bench dips|^dip$|assisted dip|parallel bar dip|triceps? .*extension/,
    'elbow_extension',
  ],
  [/chest dip/, 'horizontal_press'],
  [
    /hip thrust|glute bridge|hip raise|butt lift|kickback|back extension|hyperextension|hip extension|hip lift/,
    'hip_extension',
  ],
  [/abduct|monster walk/, 'hip_abduction'],
  [/adduct/, null],
  [/leg press|lunge|split squat|step-up|step up/, 'leg_press_or_lunge'],
  [/incline.*(press|bench)|(press|bench).*incline/, 'incline_press'],
  [
    /shoulder press|military press|overhead press|arnold|push press|seesaw press|see-saw press|kettlebell press|seated press|dumbbell press(?!.*bench)|standing .*press|alternating .*press|cable shoulder/,
    'overhead_press',
  ],
  [
    /bench press|chest press|push-up|pushup|push up|floor press|decline .*press|close-grip .*press|dumbbell press|bench|press$/,
    'horizontal_press',
  ],
  [/squat/, 'squat'],
  [/plank|rollout|ab wheel|pallof|side bridge|dead bug/, 'core_antiextension'],
  [
    /crunch|sit-up|situp|leg raise|knee raise|jackknife|leg lift|russian twist|side bend|wood chop|cable lift|leg pull-in|twist|rotary torso|tuck/,
    'core_flexion',
  ],
  [/carry|farmer/, 'carry'],
];

export function patternFor(name: string): Pattern | null {
  const n = name.toLowerCase();
  for (const [re, p] of PATTERN_RULES) if (re.test(n)) return p;
  return null;
}

const COMPOUND_PATTERNS: Pattern[] = [
  'vertical_pull',
  'horizontal_pull',
  'horizontal_press',
  'incline_press',
  'overhead_press',
  'squat',
  'hinge',
  'leg_press_or_lunge',
  'carry',
];

export function roleFor(pattern: Pattern | null, mechanic: string | null, name: string): Role {
  if (/pullover|fly|curl|extension|raise|kickback/i.test(name)) return 'isolation';
  if (pattern && COMPOUND_PATTERNS.includes(pattern)) return 'compound';
  if (pattern === 'elbow_extension' && /dip|close-grip .*press/i.test(name)) return 'compound';
  if (pattern === 'hip_extension' && /hip thrust|glute bridge/i.test(name)) return 'compound';
  return mechanic === 'compound' && !pattern ? 'compound' : 'isolation';
}

// ---------- machines ----------

export interface MachineDef {
  id: string;
  name: string;
  category: string;
  loadType: string;
  defaultIncrementKg: number;
  exercises: string[];
  primaryMuscles: string[];
}

/** Keyword → machine id for dataset machine/cable exercises not listed in machines.json. */
const MACHINE_KEYWORDS: [RegExp, string][] = [
  [/^smith|smith /i, 'smith-machine'],
  [/hack squat/i, 'hack-squat'],
  [/leg press/i, 'leg-press'],
  [/leg extension/i, 'leg-extension'],
  [/lying leg curl/i, 'lying-leg-curl'],
  [/leg curl/i, 'seated-leg-curl'],
  [/calf press|machine calf/i, 'leg-press'],
  [/seated calf/i, 'seated-calf'],
  [/standing calf raise/i, 'standing-calf'],
  [/chest press|machine bench press|machine decline/i, 'chest-press'],
  [/iso-lateral (high )?row/i, 'iso-lateral-row'],
  [/iso-lateral shoulder|machine shoulder/i, 'shoulder-press'],
  [/machine (deadlift|shrug)/i, 'iso-lateral-row'],
  [/preacher/i, 'preacher-bench'],
  [/biceps curl|bicep curl/i, 'biceps-curl-machine'],
  [/triceps extension/i, 'triceps-extension-machine'],
  [/reverse hyper/i, 'reverse-hyper'],
  [/glute-ham/i, 'glute-ham-raise'],
  [/abduction|abductor/i, 'hip-abduction'],
  [/adduction|adductor/i, 'hip-adduction'],
  [/t-bar/i, 't-bar-row'],
  [/pulldown|pull down/i, 'lat-pulldown'],
  [/seated cable row|low row|seated one-arm cable/i, 'cable-row-station'],
];

export function machineFor(
  canonical: string,
  equipment: string,
  byExercise: Map<string, string>,
): string | undefined {
  const listed = byExercise.get(canonical.toLowerCase());
  if (listed) return EQUIPMENT_NOT_MACHINE.includes(listed) ? undefined : listed;
  if (equipment !== 'machine' && equipment !== 'cable') return undefined;
  for (const [re, id] of MACHINE_KEYWORDS) if (re.test(canonical)) return id;
  return equipment === 'cable' ? 'cable-tower' : undefined;
}

// ---------- load types, increments, requirements ----------

export const BODYWEIGHT_STATIONS = ['pullup-bar', 'dip-station', 'glute-ham-raise', 'roman-chair'];
/** machines.json lists these, but equipment.json treats them as equipment: no machine panel (S08). */
export const EQUIPMENT_NOT_MACHINE = ['pullup-bar', 'dip-station'];

export function loadTypeFor(canonical: string, equipment: string, machine: MachineDef | undefined): LoadType {
  const n = canonical.toLowerCase();
  if (/plank|side bridge/.test(n)) return 'timed';
  if (/farmer|carry/.test(n)) return 'dumbbell';
  if (/^assisted /.test(n)) return 'assisted';
  if (machine) {
    // Bodyweight stations (pull-up bar, dip station, 45° bench) start as bodyweight; FR-PRG-5
    // suggests bodyweight_plus once reps outgrow the range.
    if (BODYWEIGHT_STATIONS.includes(machine.id)) return 'bodyweight';
    return machine.loadType as LoadType;
  }
  switch (equipment) {
    case 'dumbbell':
      return 'dumbbell';
    case 'kettlebells':
      return 'kettlebell';
    case 'barbell':
    case 'e-z curl bar':
    case 'trap bar':
      return 'barbell';
    case 'cable':
      return 'cable';
    case 'machine':
      return 'machine_stack';
    default:
      return 'bodyweight';
  }
}

const BENCH_ANY = ['flat-bench', 'adjustable-bench'];

/** AND of OR-groups of equipment / machine ids (DECISIONS D11). */
export function requiresFor(canonical: string, equipment: string, machineId: string | undefined): string[][] {
  const n = canonical.toLowerCase();
  const req: string[][] = [];
  if (machineId && !['cable-tower', 'functional-trainer'].includes(machineId)) {
    req.push([machineId]);
    if (machineId === 'preacher-bench')
      req.push(equipment === 'e-z curl bar' ? ['ez-bar', 'barbell'] : ['barbell', 'ez-bar', 'dumbbells']);
    return req;
  }
  if (machineId) req.push(['cable-tower', 'functional-trainer']);
  switch (equipment) {
    case 'barbell':
      req.push(['barbell']);
      break;
    case 'e-z curl bar':
      req.push(['ez-bar', 'barbell']);
      break;
    case 'dumbbell':
      req.push(['dumbbells']);
      break;
    case 'kettlebells':
      req.push(['kettlebells']);
      break;
    case 'trap bar':
      req.push(['trap-bar']);
      break;
  }
  if (equipment === 'body only') {
    if (/pull-up|pullup|chin-up|hanging|pull up/.test(n)) req.push(['pullup-bar']);
    else if (/captain/.test(n)) req.push(['dip-station']);
    else if (/^dip$|parallel bar dip|chest dip/.test(n)) req.push(['dip-station']);
    else if (/bench dips|flat bench|decline|jackknife|leg pull-in|lying leg raise/.test(n))
      req.push(BENCH_ANY);
    else if (/back extension/.test(n)) req.push(['roman-chair']);
    return req;
  }
  if (/goblet/.test(n)) return [['kettlebells', 'dumbbells']];
  if (/incline|decline/.test(n)) req.push(['adjustable-bench']);
  else if (
    /bench press|bench|fly|flye|pullover|lying|seated|skull|chest-supported|tate press|jm press|split squat|step-up|prone|hip thrust/.test(
      n,
    ) &&
    equipment !== 'cable'
  )
    req.push(BENCH_ANY);
  if (equipment === 'barbell' && /squat|overhead press|military press|standing press/.test(n))
    req.push(['squat-rack']);
  return req;
}

export function incrementFor(
  loadType: LoadType,
  machine: MachineDef | undefined,
  loadTypes: Record<string, { defaultIncrementKg: number }>,
): number {
  if (machine && machine.defaultIncrementKg > 0 && loadType !== 'bodyweight')
    return machine.defaultIncrementKg;
  return loadTypes[loadType]?.defaultIncrementKg ?? 0;
}

export function equipmentLabel(
  equipment: string,
  machine: MachineDef | undefined,
  req: string[][],
  names: Record<string, string>,
): string {
  if (machine) return machine.name.replace(/\s*\(.*\)/, '');
  const parts = req.map((g) => names[g[0]!] ?? g[0]!).map((s) => s.replace(/ \/.*$/, ''));
  if (parts.length) return parts.join(' + ');
  return equipment === 'body only' ? 'Bodyweight' : equipment;
}

// ---------- unilateral, limitations, poses ----------

export function isUnilateral(name: string): boolean {
  return /one-arm|one arm|single-arm|single arm|one-leg|one leg|single-leg|single leg|split squat|lunge|step-up|step up|bulgarian|kickback(?!.*triceps)|cable lateral raise|concentration curl/i.test(
    name,
  );
}

export function limitationAreasFor(name: string, pattern: Pattern | null, equipment: string): string[] {
  const n = name.toLowerCase();
  const out = new Set<string>();
  if (
    pattern === 'squat' ||
    pattern === 'leg_press_or_lunge' ||
    pattern === 'knee_extension' ||
    /sissy|lunge|step-up/.test(n)
  )
    out.add('knees');
  if (pattern === 'hinge' || /good morning|back extension|hyperextension|deadlift/.test(n))
    out.add('lower back');
  if (/bent-over|bent over|t-bar row(?!.*chest)|pendlay/.test(n) && !/chest-supported|head on bench/.test(n))
    out.add('lower back');
  if (/back squat|^squat|front squat|barbell lunge|good morning/.test(n) && equipment === 'barbell')
    out.add('lower back');
  if (pattern === 'overhead_press' || /dip|upright row|behind the neck|pullover/.test(n))
    out.add('shoulders');
  if (
    /push-up|pushup|front squat|wrist curl|skull|lying triceps|triceps extension -pronated|press to chin|handstand/.test(
      n,
    )
  )
    out.add('wrists');
  return [...out].sort();
}

export const TIER1_POSES: Record<string, string> = {
  'Incline Dumbbell Press': 'incline-db-press',
  'Seated Cable Row': 'seated-cable-row',
  'Machine Shoulder Press': 'machine-shoulder-press',
  'Lat Pulldown': 'lat-pulldown',
  'Rope Pushdown': 'rope-pushdown',
  'Back Squat': 'back-squat',
  'Romanian Deadlift': 'romanian-deadlift',
  'Leg Press': 'leg-press',
  'Seated Leg Curl': 'seated-leg-curl',
  'Pull-Up': 'pull-up',
};

// ---------- text ----------

export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function cleanText(s: string): string {
  return s.replace(/�/g, '¾').replace(/\s+/g, ' ').replace(/ \./g, '.').trim();
}

export function levelFor(raw: string): Experience {
  if (raw === 'expert') return 'advanced';
  if (raw === 'intermediate') return 'intermediate';
  return 'beginner';
}
