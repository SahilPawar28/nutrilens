import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Dimensions, ActivityIndicator, TouchableOpacity, Share
} from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db, auth } from '../services/firebase';
import { COLORS, SPACING, RADIUS, TAB_BAR_HEIGHT } from '../constants/theme';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - SPACING.md * 2;

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekDay(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

type Period = '7D' | '30D' | 'All';
const PERIODS: Period[] = ['7D', '30D', 'All'];
const PERIOD_DAYS: Record<Period, number> = { '7D': 7, '30D': 30, 'All': 90 };

function buildDailyTotals(meals: any[], days: number) {
  const now = new Date();
  const buckets: { dateKey: string; label: string; calories: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    buckets.push({
      dateKey: d.toDateString(),
      label: days <= 7 ? DAYS[getWeekDay(d)] : (i % 5 === 0 ? String(d.getDate()) : ''),
      calories: 0,
    });
  }
  meals.forEach(meal => {
    if (!meal.logged_at) return;
    const date = meal.logged_at.toDate ? meal.logged_at.toDate() : new Date(meal.logged_at);
    const bucket = buckets.find(b => b.dateKey === date.toDateString());
    if (bucket) bucket.calories += meal.calories || 0;
  });
  return buckets;
}

interface StatCardProps {
  label: string;
  value: string;
  unit: string;
  color: string;
  icon: string;
  gradientColors: [string, string];
}

function StatCard({ label, value, unit, color, icon, gradientColors }: StatCardProps) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <LinearGradient
        colors={gradientColors}
        style={styles.statIconWrapper}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name={icon as any} size={18} color={COLORS.white} />
      </LinearGradient>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

interface InsightCardProps {
  icon: string;
  text: string;
  color: string;
  bgColor: string;
}

function InsightCard({ icon, text, color, bgColor }: InsightCardProps) {
  return (
    <View style={[styles.insightCard, { backgroundColor: bgColor, borderLeftColor: color }]}>
      <View style={[styles.insightIconWrapper, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.insightText}>{text}</Text>
    </View>
  );
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const [meals, setMeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('7D');
  const [dietGoal, setDietGoal] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'meal_logs'),
      orderBy('logged_at', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMeals(data);
      setLoading(false);
    });

    getDoc(doc(db, 'users', user.uid, 'profile', 'settings'))
      .then(snap => { if (snap.exists()) setDietGoal(snap.data().dietGoal || null); })
      .catch(() => {});

    return unsubscribe;
  }, []);

  const now = new Date();
  const periodMeals = period === 'All'
    ? meals
    : meals.filter(m => {
        if (!m.logged_at) return false;
        const date = m.logged_at.toDate ? m.logged_at.toDate() : new Date(m.logged_at);
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays < PERIOD_DAYS[period];
      });

  const dailyTotals = buildDailyTotals(meals, PERIOD_DAYS[period]);

  const totalMeals = periodMeals.length;
  const avgCalories = totalMeals > 0
    ? Math.round(periodMeals.reduce((s, m) => s + (m.calories || 0), 0) / totalMeals)
    : 0;
  const totalProtein = periodMeals.reduce((s, m) => s + (m.protein || 0), 0);
  const totalCarbs = periodMeals.reduce((s, m) => s + (m.carbs || 0), 0);
  const totalFat = periodMeals.reduce((s, m) => s + (m.fat || 0), 0);
  const avgProtein = totalMeals > 0 ? Math.round(totalProtein / totalMeals) : 0;
  const healthyCount = periodMeals.filter(m => (m.health_score || 0) >= 7).length;
  const healthyPct = totalMeals > 0 ? Math.round((healthyCount / totalMeals) * 100) : 0;
  const processedCount = periodMeals.filter(m => m.image_type === 'packaged_label').length;
  const processedPct = totalMeals > 0 ? Math.round((processedCount / totalMeals) * 100) : 0;

  const insights = [];
  if (avgProtein < 30) {
    insights.push({
      icon: 'trending-up-outline',
      color: COLORS.primary,
      bgColor: COLORS.primaryLight,
      text: 'Your protein intake is low. Try adding eggs, chicken, or legumes to your meals.',
    });
  } else {
    insights.push({
      icon: 'barbell-outline',
      color: COLORS.macroProtein,
      bgColor: COLORS.macroProteinBg,
      text: `Great protein intake! You're averaging ${avgProtein}g per meal — keep it up!`,
    });
  }
  if (processedPct > 40) {
    insights.push({
      icon: 'warning-outline',
      color: COLORS.warning,
      bgColor: '#FFF8F0',
      text: `${processedPct}% of your meals are packaged foods. Try adding more whole foods.`,
    });
  } else {
    insights.push({
      icon: 'leaf-outline',
      color: COLORS.primary,
      bgColor: COLORS.primaryLight,
      text: 'Try adding more leafy greens — you\'re light on micronutrients this week.',
    });
  }
  if (avgCalories > 700) {
    insights.push({
      icon: 'flame-outline',
      color: COLORS.macroFat,
      bgColor: COLORS.macroFatBg,
      text: `Average ${avgCalories} kcal/meal is high. Consider lighter options for snacks.`,
    });
  } else if (avgCalories > 0) {
    insights.push({
      icon: 'checkmark-circle-outline',
      color: COLORS.primary,
      bgColor: COLORS.primaryLight,
      text: `Great calorie balance! Averaging ${avgCalories} kcal per meal this week.`,
    });
  }

  if (totalMeals > 0 && dietGoal) {
    if (dietGoal === 'Weight Loss' && avgCalories > 500) {
      insights.push({
        icon: 'trophy-outline',
        color: COLORS.warning,
        bgColor: '#FFF8F0',
        text: `Your goal is Weight Loss — averaging ${avgCalories} kcal/meal is a bit high. Aim for smaller, protein-forward meals.`,
      });
    } else if (dietGoal === 'Muscle Gain' && avgProtein < 40) {
      insights.push({
        icon: 'trophy-outline',
        color: COLORS.macroProtein,
        bgColor: COLORS.macroProteinBg,
        text: `Your goal is Muscle Gain — try pushing protein past 40g/meal for better recovery and growth.`,
      });
    } else if (dietGoal === 'Low Carb' && totalCarbs > totalProtein + totalFat) {
      insights.push({
        icon: 'trophy-outline',
        color: COLORS.macroCarbs,
        bgColor: COLORS.macroCarbsBg,
        text: `Your goal is Low Carb, but carbs are outpacing protein and fat combined this period. Consider swapping in more veggies and protein.`,
      });
    } else {
      insights.push({
        icon: 'trophy-outline',
        color: COLORS.primary,
        bgColor: COLORS.primaryLight,
        text: `You're on track for your ${dietGoal} goal — keep up the consistent logging!`,
      });
    }
  }

  const chartData = {
    labels: dailyTotals.map(b => b.label),
    datasets: [{ data: dailyTotals.map(b => b.calories || 0) }],
  };

  const periodLabel = period === '7D' ? 'Last 7 days' : period === '30D' ? 'Last 30 days' : 'All time';

  const handleShare = async () => {
    const lines = [
      `🌿 NutriLens Report — ${periodLabel}`,
      '',
      `Meals logged: ${totalMeals}`,
      `Avg calories/meal: ${avgCalories} kcal`,
      `Avg protein/meal: ${avgProtein}g`,
      `Healthy meals: ${healthyPct}%`,
      `Packaged/processed: ${processedPct}%`,
    ];
    if (dietGoal) lines.push(`Diet goal: ${dietGoal}`);
    lines.push('', 'Tracked with NutriLens 🍽️');
    try {
      await Share.share({ message: lines.join('\n') });
    } catch (e) {
      // user cancelled or share failed silently — no action needed
    }
  };

  const macroTotal = totalProtein + totalCarbs + totalFat;
  const macroPieData = macroTotal > 0 ? [
    { name: 'Protein', population: totalProtein, color: COLORS.macroProtein, legendFontColor: COLORS.textSecondary, legendFontSize: 12 },
    { name: 'Carbs', population: totalCarbs, color: COLORS.macroCarbs, legendFontColor: COLORS.textSecondary, legendFontSize: 12 },
    { name: 'Fat', population: totalFat, color: COLORS.macroFat, legendFontColor: COLORS.textSecondary, legendFontSize: 12 },
  ] : [];

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + SPACING.md, paddingBottom: TAB_BAR_HEIGHT + SPACING.lg },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>Analytics</Text>
          <Text style={styles.subtitle}>Your nutrition overview</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
          <Ionicons name="share-outline" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Period Selector */}
      <View style={styles.periodRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            onPress={() => setPeriod(p)}
            activeOpacity={0.8}
          >
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Stats Strip */}
      <View style={styles.stripRow}>
        <View style={styles.stripItem}>
          <Text style={styles.stripValue}>{totalMeals}</Text>
          <Text style={styles.stripLabel}>Total Meals</Text>
        </View>
        <View style={styles.stripDivider} />
        <View style={styles.stripItem}>
          <Text style={styles.stripValue}>{avgCalories}</Text>
          <Text style={styles.stripLabel}>Avg kcal/meal</Text>
        </View>
        <View style={styles.stripDivider} />
        <View style={styles.stripItem}>
          <Text style={styles.stripValue}>{healthyCount}</Text>
          <Text style={styles.stripLabel}>Healthy Meals</Text>
        </View>
      </View>

      {/* Calorie Chart */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Calories</Text>
          <View style={styles.chartBadge}>
            <Text style={styles.chartBadgeText}>{PERIOD_DAYS[period]} days</Text>
          </View>
        </View>
        {dailyTotals.every(b => b.calories === 0) ? (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyChartEmoji}>📊</Text>
            <Text style={styles.emptyChartText}>No data yet — start logging meals!</Text>
          </View>
        ) : (
          <BarChart
            data={chartData}
            width={CHART_WIDTH - SPACING.md * 2}
            height={180}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={{
              backgroundColor: COLORS.white,
              backgroundGradientFrom: COLORS.white,
              backgroundGradientTo: COLORS.white,
              decimalPlaces: 0,
              color: () => COLORS.primary,
              labelColor: () => COLORS.textSecondary,
              barPercentage: 0.6,
              propsForBackgroundLines: {
                stroke: COLORS.border,
                strokeDasharray: '4',
              },
            }}
            style={styles.chart}
            showValuesOnTopOfBars={false}
            withInnerLines={true}
            fromZero
          />
        )}
      </View>

      {/* Macro Breakdown */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Macro Breakdown</Text>
        </View>
        {macroPieData.length === 0 ? (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyChartEmoji}>🥗</Text>
            <Text style={styles.emptyChartText}>No data yet — start logging meals!</Text>
          </View>
        ) : (
          <PieChart
            data={macroPieData}
            width={CHART_WIDTH - SPACING.md * 2}
            height={160}
            chartConfig={{
              color: () => COLORS.text,
            }}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="8"
            absolute={false}
          />
        )}
      </View>

      {/* Stat Cards */}
      <View style={styles.statsGrid}>
        <StatCard
          label="AVG PROTEIN"
          value={`${avgProtein}g`}
          unit="per meal"
          color={COLORS.macroProtein}
          icon="barbell-outline"
          gradientColors={[COLORS.macroProtein, '#3A7FC9']}
        />
        <StatCard
          label="HEALTH SCORE"
          value={`${healthyPct}%`}
          unit="of meals"
          color={COLORS.primary}
          icon="leaf-outline"
          gradientColors={[COLORS.primary, COLORS.primaryDark]}
        />
        <StatCard
          label="PROCESSED"
          value={`${processedPct}%`}
          unit="packaged"
          color={COLORS.warning}
          icon="cube-outline"
          gradientColors={[COLORS.warning, '#C06010']}
        />
      </View>

      {/* AI Insights */}
      {insights.length > 0 && (
        <View style={styles.insightsSection}>
          <View style={styles.insightsTitleRow}>
            <Ionicons name="sparkles" size={18} color={COLORS.primary} />
            <Text style={styles.insightsTitle}>AI Insights</Text>
          </View>
          {insights.map((insight, i) => (
            <InsightCard key={i} {...insight} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.md },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.md, marginTop: 2, fontWeight: '500' },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },

  periodRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    padding: 4,
    marginBottom: SPACING.md,
    elevation: 2,
  },
  periodBtn: { flex: 1, paddingVertical: SPACING.sm - 2, borderRadius: RADIUS.full, alignItems: 'center' },
  periodBtnActive: { backgroundColor: COLORS.primary },
  periodText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  periodTextActive: { color: COLORS.white, fontWeight: '700' },

  // Strip
  stripRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
  stripItem: { flex: 1, alignItems: 'center' },
  stripValue: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  stripLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2, fontWeight: '500' },
  stripDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  // Chart
  chartCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  chartTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  chartBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chartBadgeText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  chart: { borderRadius: RADIUS.md, marginLeft: -SPACING.md },
  emptyChart: { height: 150, justifyContent: 'center', alignItems: 'center', gap: SPACING.sm },
  emptyChartEmoji: { fontSize: 40 },
  emptyChartText: { fontSize: 13, color: COLORS.textSecondary },

  // Stat cards
  statsGrid: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm + 2,
    alignItems: 'center',
    gap: 3,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    borderTopWidth: 3,
  },
  statIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  statValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  statUnit: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '500' },
  statLabel: {
    fontSize: 9,
    color: COLORS.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },

  // Insights
  insightsSection: { gap: SPACING.sm },
  insightsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.xs,
  },
  insightsTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  insightCard: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    borderLeftWidth: 4,
    elevation: 1,
  },
  insightIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightText: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 20 },
});
