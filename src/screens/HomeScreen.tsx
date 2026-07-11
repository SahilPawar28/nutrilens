import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Dimensions, RefreshControl, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { db, auth } from '../services/firebase';
import { COLORS, SPACING, RADIUS, TAB_BAR_HEIGHT } from '../constants/theme';
import ProgressRing from '../components/ProgressRing';
import MacroCard from '../components/MacroCard';
import FoodIconBox from '../components/FoodIconBox';
import MealDetailModal from '../components/MealDetailModal';
import { subscribeToTodayWater, setTodayWaterCount } from '../services/waterLogger';
import { flushMealQueue, getPendingMealCount, getMealType } from '../services/mealLogger';
import { getBestRecommendation } from '../services/mealRecommender';

const { width } = Dimensions.get('window');
const WATER_TARGET = 8;

function BiteCard({ meal, onPress }: { meal: any; onPress: () => void }) {
  return (
    <TouchableOpacity style={biteStyles.card} onPress={onPress} activeOpacity={0.8}>
      <FoodIconBox foodName={meal.food_name} emoji={meal.emoji} size={60} borderRadius={RADIUS.xl} fontSize={32} />
      <Text style={biteStyles.label} numberOfLines={2}>{meal.food_name}</Text>
      <View style={biteStyles.footer}>
        <Ionicons name="flame-outline" size={11} color={COLORS.textSecondary} />
        <Text style={biteStyles.calories}>{meal.calories}</Text>
      </View>
    </TouchableOpacity>
  );
}

const biteStyles = StyleSheet.create({
  card: {
    width: 116,
    height: 140,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
    padding: SPACING.sm,
    gap: 7,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 14,
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  calories: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
});

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [todayMeals, setTodayMeals] = useState<any[]>([]);
  const [recentMeals, setRecentMeals] = useState<any[]>([]);
  const [recentHistory, setRecentHistory] = useState<any[]>([]);
  const [calorieTarget, setCalorieTarget] = useState(2000);
  const [proteinTarget, setProteinTarget] = useState(120);
  const [carbTarget, setCarbTarget] = useState<number | null>(null);
  const [fatTarget, setFatTarget] = useState<number | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [waterCount, setWaterCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const firstName = user?.email?.split('@')[0] || 'there';
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning ☀️';
    if (hour < 17) return 'Good afternoon 👋';
    return 'Good evening 🌙';
  };

  const loadProfile = useCallback(async () => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'profile', 'settings');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCalorieTarget(parseInt(data.calorieTarget) || 2000);
        setProteinTarget(parseInt(data.proteinTarget) || 120);
        setCarbTarget(data.carbTarget ? parseInt(data.carbTarget) : null);
        setFatTarget(data.fatTarget ? parseInt(data.fatTarget) : null);
      }
      setError(null);
    } catch (e) {
      setError('Could not load your profile. Pull down to retry.');
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const q = query(
      collection(db, 'users', currentUser.uid, 'meal_logs'),
      orderBy('logged_at', 'desc'),
      limit(300)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const all: any[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const today = new Date().toDateString();
        const todayList = all.filter(m => {
          if (!m.logged_at) return false;
          const d = m.logged_at.toDate ? m.logged_at.toDate() : new Date(m.logged_at);
          return d.toDateString() === today;
        });
        setTodayMeals(todayList);
        setRecentMeals(todayList.slice(0, 20));
        setRecentHistory(all);
        setLoading(false);
        setError(null);
      },
      () => {
        setLoading(false);
        setError('Could not load your meals. Pull down to retry.');
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    return subscribeToTodayWater(setWaterCount);
  }, []);

  const syncPendingMeals = useCallback(async () => {
    await flushMealQueue().catch(() => {});
    setPendingCount(await getPendingMealCount().catch(() => 0));
  }, []);

  useEffect(() => {
    syncPendingMeals();
  }, [syncPendingMeals]);

  const handleWaterChange = (delta: number) => {
    const next = Math.max(0, waterCount + delta);
    setWaterCount(next);
    setTodayWaterCount(next).catch(() => {});
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    await syncPendingMeals();
    setRefreshing(false);
  };

  const consumed = todayMeals.reduce((s, m) => s + (m.calories || 0), 0);
  const protein = todayMeals.reduce((s, m) => s + (m.protein || 0), 0);
  const carbs = todayMeals.reduce((s, m) => s + (m.carbs || 0), 0);
  const fat = todayMeals.reduce((s, m) => s + (m.fat || 0), 0);
  const remaining = Math.max(calorieTarget - consumed, 0);
  const progress = Math.min(consumed / calorieTarget, 1);

  const resolvedCarbTarget = carbTarget ?? Math.round(calorieTarget * 0.5 / 4);
  const resolvedFatTarget = fatTarget ?? Math.round(calorieTarget * 0.3 / 9);

  const remainingProtein = Math.max(proteinTarget - protein, 0);
  const todayFoodNames = new Set(todayMeals.map(m => m.food_name));
  const recommendation = getBestRecommendation(recentHistory, {
    currentMealType: getMealType(),
    remainingProtein,
    remainingCalories: remaining,
    excludeFoodNames: todayFoodNames,
  });

  let suggestion: { title: string; subtitle: string } | null = null;
  if (recommendation) {
    suggestion = {
      title: `Try ${recommendation.food_name} again`,
      subtitle: `You've had it ${recommendation.count}× before (avg ${recommendation.avgProtein}g protein` +
        (recommendation.avgHealthScore != null ? `, ${recommendation.avgHealthScore.toFixed(1)}/10 health score` : '') +
        `) — a good fit for what's left of today's targets.`,
    };
  } else if (remainingProtein >= 15) {
    suggestion = {
      title: `You need ${remainingProtein}g more protein today`,
      subtitle: 'Try eggs, grilled chicken, paneer, or legumes to close the gap.',
    };
  } else if (remaining <= 100 && consumed > 0) {
    suggestion = {
      title: "You're close to your calorie goal",
      subtitle: 'Consider a light snack or hold off until tomorrow.',
    };
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + SPACING.md, paddingBottom: TAB_BAR_HEIGHT + SPACING.xl },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />
      }
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.name}>{displayName}, you're doing great 💪</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn}>
          <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {pendingCount > 0 && (
        <View style={styles.pendingBanner}>
          <Ionicons name="cloud-upload-outline" size={16} color={COLORS.warning} />
          <Text style={styles.pendingText}>
            {pendingCount} meal{pendingCount > 1 ? 's' : ''} saved offline — will sync automatically.
          </Text>
        </View>
      )}

      {/* ── Calorie Ring Card ── */}
      <View style={styles.ringCard}>
        <LinearGradient
          colors={['#F0FAF4', '#FFFFFF']}
          style={styles.ringCardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <ProgressRing size={170} strokeWidth={14} progress={progress} remaining={remaining} />
          <View style={styles.ringFooter}>
            <View style={styles.ringFooterItem}>
              <Text style={styles.ringFooterValue}>{consumed}</Text>
              <Text style={styles.ringFooterLabel}>eaten</Text>
            </View>
            <View style={styles.ringFooterDivider} />
            <View style={styles.ringFooterItem}>
              <Text style={styles.ringFooterValue}>{calorieTarget}</Text>
              <Text style={styles.ringFooterLabel}>goal</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* ── Macro Cards ── */}
      <View style={styles.macrosRow}>
        <MacroCard
          label="PROTEIN"
          value={protein}
          unit="g"
          target={proteinTarget}
          color={COLORS.macroProtein}
          bgColor={COLORS.macroProteinBg}
        />
        <MacroCard
          label="CARBS"
          value={carbs}
          unit="g"
          target={resolvedCarbTarget}
          color={COLORS.macroCarbs}
          bgColor={COLORS.macroCarbsBg}
        />
        <MacroCard
          label="FAT"
          value={fat}
          unit="g"
          target={resolvedFatTarget}
          color={COLORS.macroFat}
          bgColor={COLORS.macroFatBg}
        />
      </View>

      {/* ── Water Tracker ── */}
      <View style={styles.waterCard}>
        <View style={styles.waterHeader}>
          <View style={styles.waterHeaderLeft}>
            <Ionicons name="water" size={18} color={COLORS.info} />
            <Text style={styles.waterTitle}>Water</Text>
          </View>
          <Text style={styles.waterCount}>{waterCount}/{WATER_TARGET} glasses</Text>
        </View>
        <View style={styles.waterRow}>
          <TouchableOpacity
            style={styles.waterStepBtn}
            onPress={() => handleWaterChange(-1)}
            disabled={waterCount === 0}
          >
            <Ionicons name="remove" size={18} color={waterCount === 0 ? COLORS.border : COLORS.text} />
          </TouchableOpacity>
          <View style={styles.waterGlasses}>
            {Array.from({ length: WATER_TARGET }).map((_, i) => (
              <Ionicons
                key={i}
                name={i < waterCount ? 'water' : 'water-outline'}
                size={20}
                color={i < waterCount ? COLORS.info : COLORS.border}
              />
            ))}
          </View>
          <TouchableOpacity style={styles.waterStepBtn} onPress={() => handleWaterChange(1)}>
            <Ionicons name="add" size={18} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Smart Suggestion ── */}
      {suggestion && (
        <View style={styles.suggestionCard}>
          <View style={styles.suggestionIconWrapper}>
            <Ionicons name="bulb" size={18} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
            <Text style={styles.suggestionSubtitle}>{suggestion.subtitle}</Text>
          </View>
        </View>
      )}

      {/* ── Quick Actions ── */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: COLORS.primaryLight }]}
          onPress={() => navigation.navigate('Scan')}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconWrapper, { backgroundColor: COLORS.primary + '22' }]}>
            <Ionicons name="scan-outline" size={20} color={COLORS.primary} />
          </View>
          <Text style={[styles.actionLabel, { color: COLORS.primaryDark }]}>Scan Food</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: COLORS.macroCarbsBg }]}
          onPress={() => navigation.navigate('Scan')}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconWrapper, { backgroundColor: COLORS.macroCarbs + '22' }]}>
            <Ionicons name="pricetag-outline" size={20} color={COLORS.macroCarbs} />
          </View>
          <Text style={[styles.actionLabel, { color: COLORS.macroCarbs }]}>Scan Label</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: COLORS.macroProteinBg }]}
          onPress={() => navigation.navigate('Chat')}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconWrapper, { backgroundColor: COLORS.macroProtein + '22' }]}>
            <Ionicons name="chatbubble-outline" size={20} color={COLORS.macroProtein} />
          </View>
          <Text style={[styles.actionLabel, { color: COLORS.macroProtein }]}>Ask AI</Text>
        </TouchableOpacity>
      </View>

      {/* ── Today's Bites ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Today's Bites</Text>
        <TouchableOpacity onPress={() => navigation.navigate('History')} activeOpacity={0.7}>
          <Text style={styles.seeAll}>See all →</Text>
        </TouchableOpacity>
      </View>

      {recentMeals.length === 0 ? (
        <View style={styles.emptyBites}>
          <Text style={styles.emptyBitesEmoji}>🍽️</Text>
          <Text style={styles.emptyBitesTitle}>No meals yet today</Text>
          <Text style={styles.emptyBitesSubtitle}>Tap Scan Food to log your first meal</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bitesScrollContent}
        >
          {recentMeals.map((meal) => (
            <BiteCard key={meal.id} meal={meal} onPress={() => setSelectedMeal(meal)} />
          ))}
        </ScrollView>
      )}

      <MealDetailModal
        visible={!!selectedMeal}
        meal={selectedMeal}
        onClose={() => setSelectedMeal(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.md },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: '#FDF0EE',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  errorText: { flex: 1, fontSize: 12, color: COLORS.danger, fontWeight: '600' },

  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: '#FFF8F0',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  pendingText: { flex: 1, fontSize: 12, color: COLORS.warning, fontWeight: '600' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  greeting: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    maxWidth: width * 0.75,
    marginTop: 2,
  },
  notifBtn: {
    backgroundColor: COLORS.white,
    padding: SPACING.sm,
    borderRadius: RADIUS.full,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },

  // Ring card
  ringCard: {
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  ringCardGradient: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },
  ringFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    gap: SPACING.md,
  },
  ringFooterItem: { alignItems: 'center' },
  ringFooterValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  ringFooterLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  ringFooterDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },

  // Macros
  macrosRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  // Water tracker
  waterCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
  waterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  waterHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  waterTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  waterCount: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  waterRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  waterGlasses: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  waterStepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Suggestion
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  suggestionIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primaryDark },
  suggestionSubtitle: { fontSize: 12, color: COLORS.text, marginTop: 2, lineHeight: 17 },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  actionBtn: {
    flex: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    gap: 6,
    elevation: 1,
  },
  actionIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  seeAll: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Bites scroll container
  bitesScrollContent: {
    paddingRight: SPACING.md,
  },

  // Empty state
  emptyBites: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
    elevation: 2,
  },
  emptyBitesEmoji: { fontSize: 44 },
  emptyBitesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyBitesSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
