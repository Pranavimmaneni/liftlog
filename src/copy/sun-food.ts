/** Copy for the Rising Sun Food screens (F01–F07). Merged into `en.sun.food`. */
export const sunFood = {
  diary: {
    title: 'Food',
    left: 'Calories left',
    over: 'Calories over',
    eaten: (eaten: string, target: string) => `${eaten} of ${target} kcal eaten`,
    bar: (name: string, eaten: string, target: string) => `${name}: ${eaten} of ${target} grams`,
    nothing: 'Nothing yet',
    mealKcal: (kcal: string) => `${kcal} kcal`,
  },
  add: {
    scan: 'Scan',
    create: 'Create a new food',
    suggested: (meal: string) => `Suggested for ${meal.toLowerCase()}`,
    results: 'Results',
    portion: (portion: string, protein: string | null) =>
      protein ? `${portion} · ${protein} g protein` : portion,
    left: (kcal: string, today: boolean) => (today ? `${kcal} kcal left today` : `${kcal} kcal left`),
    over: (kcal: string, today: boolean) => (today ? `${kcal} kcal over today` : `${kcal} kcal over`),
    proteinToGo: (g: string) => `${g} g protein to go`,
  },
  portion: {
    kcal: 'kcal',
  },
  newFood: {
    serving: 'Serving',
    grams: 'g',
  },
  targets: {
    macros: 'Macros a day',
    inputs: 'What the numbers come from',
    fibreNote: 'follows calories',
  },
  review: {
    title: 'Review',
    period: 'Period',
    week: 'Week',
    month: 'Month',
    calories: 'Calories',
    daysOnTarget: (days: number, of: number) => `${days} of ${of} days on target`,
    day: (date: string, pct: number | null) =>
      pct === null ? `${date}: nothing logged` : `${date}: ${pct}% of the calorie target`,
    averages: 'Daily average, share of target',
    low: 'low',
  },
  fasting: {
    fasting: 'Fasting',
    planLabel: (plan: string) => `Plan ${plan}`,
    week: (n: number) => (n === 1 ? '1 fast this week' : `${n} fasts this week`),
  },
  meal: {
    macros: (p: string, c: string, f: string) => `Protein ${p} g · Carbs ${c} g · Fat ${f} g`,
  },
};
