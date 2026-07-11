import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SectionList,
  TouchableOpacity, ActivityIndicator, RefreshControl
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../services/firebase';
import { COLORS, SPACING, RADIUS, TAB_BAR_HEIGHT } from '../constants/theme';
import MealCard from '../components/MealCard';
import MealDetailModal from '../components/MealDetailModal';

function getLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateLabel(dateStr: string): string {
  const now = new Date();
  const todayKey = getLocalDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getLocalDateKey(yesterday);

  if (dateStr === todayKey) return 'Today';
  if (dateStr === yesterdayKey) return 'Yesterday';

  const [y, mo, d] = dateStr.split('-').map(Number);
  const date = new Date(y, mo - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatTime(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getDateKey(timestamp: any): string {
  if (!timestamp) return 'Unknown';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return getLocalDateKey(date);
}

function DaySectionHeader({ title, dayCalories }: { title: string; dayCalories: number }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <View style={styles.sectionDot} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionCalBadge}>
        <Ionicons name="flame-outline" size={11} color={COLORS.primary} />
        <Text style={styles.sectionCal}>{dayCalories} kcal</Text>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [meals, setMeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('All');
  const [selectedMeal, setSelectedMeal] = useState<any>(null);

  const FILTERS = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack'];

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'meal_logs'),
      orderBy('logged_at', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMeals(data);
      setLoading(false);
      setRefreshing(false);
    });

    return unsubscribe;
  }, []);

  const filteredMeals = filter === 'All'
    ? meals
    : meals.filter(m => m.meal_type === filter);

  const groupedByDay: { [key: string]: any[] } = {};
  filteredMeals.forEach(meal => {
    const key = getDateKey(meal.logged_at);
    if (!groupedByDay[key]) groupedByDay[key] = [];
    groupedByDay[key].push(meal);
  });

  const sections = Object.keys(groupedByDay)
    .sort((a, b) => b.localeCompare(a))
    .map(dateKey => ({
      dateKey,
      title: formatDateLabel(dateKey),
      data: groupedByDay[dateKey],
      dayCalories: groupedByDay[dateKey].reduce((s: number, m: any) => s + (m.calories || 0), 0),
    }));

  const uniqueDays = Object.keys(groupedByDay).length || 1;
  const totalCalories = filteredMeals.reduce((s, m) => s + (m.calories || 0), 0);
  const totalProtein = filteredMeals.reduce((s, m) => s + (m.protein || 0), 0);
  const avgCalPerDay = Math.round(totalCalories / uniqueDays);
  const avgProteinPerDay = Math.round(totalProtein / uniqueDays);
  const avgCalPerMeal = Math.round(totalCalories / (filteredMeals.length || 1));

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>Your meal timeline</Text>
        </View>
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark]}
          style={styles.countBadge}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.countValue}>{filteredMeals.length}</Text>
          <Text style={styles.countLabel}>meals</Text>
        </LinearGradient>
      </View>

      {/* Summary Bar */}
      {filteredMeals.length > 0 && (
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{avgCalPerDay}</Text>
            <Text style={styles.summaryLabel}>avg kcal/day</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{avgProteinPerDay}g</Text>
            <Text style={styles.summaryLabel}>avg protein/day</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{avgCalPerMeal}</Text>
            <Text style={styles.summaryLabel}>avg kcal/meal</Text>
          </View>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Meal List */}
      {filteredMeals.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🍽️</Text>
          <Text style={styles.emptyTitle}>No meals logged yet</Text>
          <Text style={styles.emptySubtitle}>
            Use the Scan button to log your first meal
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <TouchableOpacity activeOpacity={0.7} onPress={() => setSelectedMeal(item)}>
              <MealCard
                foodName={item.food_name}
                emoji={item.emoji}
                calories={item.calories}
                protein={item.protein}
                mealType={item.meal_type}
                time={formatTime(item.logged_at)}
                index={index}
              />
            </TouchableOpacity>
          )}
          renderSectionHeader={({ section }) => (
            <DaySectionHeader title={section.title} dayCalories={section.dayCalories} />
          )}
          contentContainerStyle={{
            paddingHorizontal: SPACING.md,
            paddingBottom: TAB_BAR_HEIGHT + SPACING.lg,
            paddingTop: SPACING.xs,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => setRefreshing(true)}
              colors={[COLORS.primary]}
            />
          }
          stickySectionHeadersEnabled={false}
        />
      )}

      <MealDetailModal
        visible={!!selectedMeal}
        meal={selectedMeal}
        onClose={() => setSelectedMeal(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, fontWeight: '500' },
  countBadge: {
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  countValue: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  countLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },

  // Summary bar
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  summaryLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center', fontWeight: '500' },
  summaryDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  // Filter
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  filterBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  filterBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  filterTextActive: { color: COLORS.white, fontWeight: '700' },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingTop: SPACING.md,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  sectionCalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  sectionCal: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  // Empty
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.sm },
  emptyEmoji: { fontSize: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  emptySubtitle: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: SPACING.xl },
});
