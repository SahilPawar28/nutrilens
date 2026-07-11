import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import FoodIconBox from './FoodIconBox';

const MEAL_COLORS: Record<string, string> = {
  Breakfast: '#D4920A',
  Lunch:     '#4A90D9',
  Dinner:    '#9C27B0',
  Snack:     '#C94030',
};

interface Props {
  foodName: string;
  emoji?: string;
  calories: number;
  protein: number;
  mealType: string;
  time?: string;
  index?: number;
}

export default function MealCard({ foodName, emoji, calories, protein, mealType, time }: Props) {
  const mealColor = MEAL_COLORS[mealType] || COLORS.textSecondary;

  return (
    <View style={styles.card}>
      <FoodIconBox foodName={foodName} emoji={emoji} size={52} />

      <View style={styles.info}>
        <Text style={styles.foodName} numberOfLines={1}>{foodName}</Text>
        <View style={styles.meta}>
          <View style={[styles.badge, { backgroundColor: mealColor + '22' }]}>
            <Text style={[styles.badgeText, { color: mealColor }]}>{mealType}</Text>
          </View>
          {time ? <Text style={styles.time}>{time}</Text> : null}
        </View>
      </View>

      <View style={styles.nutrition}>
        <Text style={styles.calories}>{calories}</Text>
        <Text style={styles.caloriesUnit}>kcal</Text>
        <Text style={styles.protein}>{protein}g protein</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    gap: SPACING.sm,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  foodName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  time: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  nutrition: {
    alignItems: 'flex-end',
  },
  calories: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  caloriesUnit: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  protein: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
