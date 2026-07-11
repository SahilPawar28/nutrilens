// Learns simple per-food "preferences" from the user's own meal history — no
// external model, just aggregation + scoring over their own logged data.

export interface FoodProfile {
  food_name: string;
  emoji?: string;
  count: number;
  avgProtein: number;
  avgCalories: number;
  avgCarbs: number;
  avgFat: number;
  avgHealthScore: number | null;
  lastEatenAt: number;
  preferredMealType?: string;
}

interface RecommenderContext {
  currentMealType: string;
  remainingProtein: number;
  remainingCalories: number;
  excludeFoodNames: Set<string>;
}

function mealTimestamp(meal: any): number {
  if (!meal.logged_at) return 0;
  const d = meal.logged_at.toDate ? meal.logged_at.toDate() : new Date(meal.logged_at);
  return d.getTime() || 0;
}

export function buildFoodProfiles(history: any[]): FoodProfile[] {
  const map = new Map<string, {
    food_name: string; emoji?: string; count: number;
    totalProtein: number; totalCalories: number; totalCarbs: number; totalFat: number;
    totalHealthScore: number; healthScoreCount: number;
    lastEatenAt: number; mealTypeCounts: Record<string, number>;
  }>();

  for (const m of history) {
    const key = (m.food_name || '').trim().toLowerCase();
    if (!key) continue;
    const entry = map.get(key) || {
      food_name: m.food_name, emoji: m.emoji, count: 0,
      totalProtein: 0, totalCalories: 0, totalCarbs: 0, totalFat: 0,
      totalHealthScore: 0, healthScoreCount: 0,
      lastEatenAt: 0, mealTypeCounts: {} as Record<string, number>,
    };
    entry.count += 1;
    entry.totalProtein += m.protein || 0;
    entry.totalCalories += m.calories || 0;
    entry.totalCarbs += m.carbs || 0;
    entry.totalFat += m.fat || 0;
    if (m.health_score) {
      entry.totalHealthScore += m.health_score;
      entry.healthScoreCount += 1;
    }
    entry.lastEatenAt = Math.max(entry.lastEatenAt, mealTimestamp(m));
    if (m.meal_type) entry.mealTypeCounts[m.meal_type] = (entry.mealTypeCounts[m.meal_type] || 0) + 1;
    map.set(key, entry);
  }

  return Array.from(map.values()).map(e => ({
    food_name: e.food_name,
    emoji: e.emoji,
    count: e.count,
    avgProtein: Math.round(e.totalProtein / e.count),
    avgCalories: Math.round(e.totalCalories / e.count),
    avgCarbs: Math.round(e.totalCarbs / e.count),
    avgFat: Math.round(e.totalFat / e.count),
    avgHealthScore: e.healthScoreCount ? e.totalHealthScore / e.healthScoreCount : null,
    lastEatenAt: e.lastEatenAt,
    preferredMealType: Object.entries(e.mealTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0],
  }));
}

// A food only counts as a "learned" preference once it's been eaten at least
// twice — a single scan shouldn't be treated as an established habit.
const MIN_OCCURRENCES = 2;
const MIN_SCORE = 1.5;

function scoreProfile(profile: FoodProfile, ctx: RecommenderContext): number {
  const familiarity = Math.min(Math.log2(1 + profile.count), 3);

  const proteinFit = ctx.remainingProtein > 0
    ? Math.min(profile.avgProtein / ctx.remainingProtein, 1)
    : 0.3;

  const caloriesFit = ctx.remainingCalories <= 0
    ? 0.2
    : profile.avgCalories <= ctx.remainingCalories
      ? 1
      : Math.max(0, 1 - (profile.avgCalories - ctx.remainingCalories) / ctx.remainingCalories);

  const healthFit = (profile.avgHealthScore ?? 5) / 10;
  const mealTypeMatch = profile.preferredMealType === ctx.currentMealType ? 1 : 0.3;

  const daysSinceEaten = profile.lastEatenAt ? (Date.now() - profile.lastEatenAt) / 86400000 : 999;
  const varietyFactor = daysSinceEaten < 1 ? 0 : daysSinceEaten < 2 ? 0.4 : 1;

  return familiarity * 1.0
    + proteinFit * 1.5
    + caloriesFit * 1.0
    + healthFit * 1.0
    + mealTypeMatch * 0.8
    + varietyFactor * 0.6;
}

export function getBestRecommendation(history: any[], ctx: RecommenderContext): FoodProfile | null {
  const candidates = buildFoodProfiles(history)
    .filter(p => p.count >= MIN_OCCURRENCES)
    .filter(p => !ctx.excludeFoodNames.has(p.food_name));

  if (candidates.length === 0) return null;

  const scored = candidates
    .map(p => ({ profile: p, score: scoreProfile(p, ctx) }))
    .sort((a, b) => b.score - a.score);

  return scored[0].score >= MIN_SCORE ? scored[0].profile : null;
}
