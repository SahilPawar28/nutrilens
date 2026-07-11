import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Modal, TextInput
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { getMealType } from '../services/mealLogger';
import { getFoodEmoji } from '../utils/foodIcons';

interface Props {
  visible: boolean;
  result: any;
  mode: 'ate' | 'should_eat';
  onClose: () => void;
  onConfirmEat: (edited: any, mealType: string) => void;
}

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];

const SCORE_GRADE = (score: number) => {
  if (score >= 9) return { grade: 'A+', color: '#27AE60' };
  if (score >= 8) return { grade: 'A', color: COLORS.primary };
  if (score >= 7) return { grade: 'A-', color: COLORS.primary };
  if (score >= 6) return { grade: 'B+', color: COLORS.macroCarbs };
  if (score >= 5) return { grade: 'B', color: COLORS.macroCarbs };
  if (score >= 4) return { grade: 'C', color: COLORS.warning };
  return { grade: 'D', color: COLORS.danger };
};

const NUTRITION_ITEMS = (edited: any) => [
  { label: 'Calories', field: 'calories', value: edited.calories, unit: 'kcal', color: COLORS.primary, bg: COLORS.primaryLight, icon: 'flame-outline' },
  { label: 'Protein', field: 'protein', value: edited.protein, unit: 'g', color: COLORS.macroProtein, bg: COLORS.macroProteinBg, icon: 'barbell-outline' },
  { label: 'Carbs', field: 'carbs', value: edited.carbs, unit: 'g', color: COLORS.macroCarbs, bg: COLORS.macroCarbsBg, icon: 'leaf-outline' },
  { label: 'Fat', field: 'fat', value: edited.fat, unit: 'g', color: COLORS.macroFat, bg: COLORS.macroFatBg, icon: 'water-outline' },
];

export default function NutritionResult({ visible, result, mode, onClose, onConfirmEat }: Props) {
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState<any>(null);
  const [mealType, setMealType] = useState(getMealType());

  useEffect(() => {
    if (result) {
      setEdited({
        food_name: result.food_name,
        calories: String(result.calories ?? ''),
        protein: String(result.protein ?? ''),
        carbs: String(result.carbs ?? ''),
        fat: String(result.fat ?? ''),
      });
      setMealType(getMealType());
      setEditing(false);
    }
  }, [result]);

  if (!result || !edited) return null;

  const { grade, color: gradeColor } = SCORE_GRADE(result.health_score ?? 5);
  const isPackaged = result.image_type === 'packaged_label';
  const foodEmoji = result.emoji || getFoodEmoji(result.food_name || '');

  const handleConfirm = () => {
    onConfirmEat(
      {
        ...result,
        food_name: edited.food_name,
        calories: parseInt(edited.calories) || 0,
        protein: parseInt(edited.protein) || 0,
        carbs: parseInt(edited.carbs) || 0,
        fat: parseInt(edited.fat) || 0,
      },
      mealType
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>

            {/* Handle */}
            <View style={styles.handle} />

            {/* Header with grade badge */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.foodTypeTag}>
                  <View style={styles.foodIconBg}>
                    <Text style={styles.foodTypeEmoji}>{foodEmoji}</Text>
                  </View>
                  <Text style={styles.foodTypeText}>{isPackaged ? 'Packaged Food' : 'Prepared Food'}</Text>
                </View>
                {editing ? (
                  <TextInput
                    style={styles.foodNameInput}
                    value={edited.food_name}
                    onChangeText={(v) => setEdited({ ...edited, food_name: v })}
                  />
                ) : (
                  <Text style={styles.foodName}>{edited.food_name || 'Food Item'}</Text>
                )}
              </View>

              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                {result.health_score !== undefined && (
                  <LinearGradient
                    colors={[gradeColor, gradeColor + 'CC']}
                    style={styles.gradeBadge}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                  >
                    <Text style={styles.gradeText}>{grade}</Text>
                    <Text style={styles.gradeScore}>{result.health_score}/10</Text>
                  </LinearGradient>
                )}
                <TouchableOpacity style={styles.editToggle} onPress={() => setEditing(!editing)}>
                  <Ionicons name={editing ? 'checkmark' : 'pencil-outline'} size={14} color={COLORS.primaryDark} />
                  <Text style={styles.editToggleText}>{editing ? 'Done' : 'Edit'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Nutrition Grid */}
            <View style={styles.nutritionGrid}>
              {NUTRITION_ITEMS(edited).map((item) => (
                <View key={item.label} style={[styles.nutritionCard, { backgroundColor: item.bg, borderTopColor: item.color }]}>
                  <Ionicons name={item.icon as any} size={16} color={item.color} style={{ marginBottom: 4 }} />
                  {editing ? (
                    <TextInput
                      style={[styles.nutritionValue, styles.nutritionValueInput, { color: item.color }]}
                      value={String(item.value)}
                      onChangeText={(v) => setEdited({ ...edited, [item.field]: v.replace(/[^0-9]/g, '') })}
                      keyboardType="numeric"
                    />
                  ) : (
                    <Text style={[styles.nutritionValue, { color: item.color }]}>{item.value ?? '—'}</Text>
                  )}
                  <Text style={styles.nutritionUnit}>{item.unit}</Text>
                  <Text style={styles.nutritionLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* Meal Type Picker */}
            <View style={styles.mealTypeRow}>
              {MEAL_TYPES.map((mt) => (
                <TouchableOpacity
                  key={mt}
                  style={[styles.mealTypeChip, mealType === mt && styles.mealTypeChipActive]}
                  onPress={() => setMealType(mt)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.mealTypeChipText, mealType === mt && styles.mealTypeChipTextActive]}>{mt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Harmful Ingredients */}
            {result.harmful_ingredients?.length > 0 && (
              <View style={styles.warningSection}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="warning-outline" size={16} color={COLORS.warning} />
                  <Text style={styles.sectionTitle}>Watch Out For</Text>
                </View>
                {result.harmful_ingredients.map((ing: string, i: number) => (
                  <View key={i} style={styles.harmfulItem}>
                    <View style={styles.harmfulDot} />
                    <Text style={styles.harmfulText}>{ing}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Health Insight */}
            {(result.awareness_summary || result.summary) && (
              <View style={styles.insightCard}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="bulb-outline" size={16} color={COLORS.primary} />
                  <Text style={[styles.sectionTitle, { color: COLORS.primaryDark }]}>Health Insight</Text>
                </View>
                <Text style={styles.insightText}>
                  {result.awareness_summary || result.summary}
                </Text>
              </View>
            )}

            {/* AI Recommendation */}
            {mode === 'should_eat' && result.recommendation && (
              <View style={[styles.insightCard, { backgroundColor: '#E8F5EE', borderLeftColor: COLORS.primary }]}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="sparkles-outline" size={16} color={COLORS.primary} />
                  <Text style={[styles.sectionTitle, { color: COLORS.primaryDark }]}>AI Recommendation</Text>
                </View>
                <Text style={styles.insightText}>{result.recommendation}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actions}>
              {mode === 'should_eat' ? (
                <>
                  <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
                    <LinearGradient
                      colors={[COLORS.primary, COLORS.primaryDark]}
                      style={styles.confirmBtnGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
                      <Text style={styles.confirmText}>Yes, I ate it — Log it</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.skipBtn} onPress={onClose} activeOpacity={0.7}>
                    <Text style={styles.skipText}>No, I skipped it</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
                  <LinearGradient
                    colors={[COLORS.primary, COLORS.primaryDark]}
                    style={styles.confirmBtnGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
                    <Text style={styles.confirmText}>Add to my log</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.closeLink} onPress={onClose}>
                <Text style={styles.closeLinkText}>Dismiss</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: SPACING.lg,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 44,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  headerLeft: { flex: 1, marginRight: SPACING.sm },
  foodTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  foodIconBg: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: '#ECEFF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  foodTypeEmoji: { fontSize: 20 },
  foodTypeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  foodName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    lineHeight: 27,
  },
  foodNameInput: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.primary,
    paddingVertical: 2,
  },
  editToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  editToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  gradeBadge: {
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    minWidth: 56,
  },
  gradeText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 20,
    lineHeight: 24,
  },
  gradeScore: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '600',
  },

  // Nutrition grid
  nutritionGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  nutritionCard: {
    flex: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    borderTopWidth: 3,
    elevation: 1,
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  nutritionValueInput: {
    textAlign: 'center',
    minWidth: 30,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.15)',
  },
  mealTypeRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  mealTypeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  mealTypeChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  mealTypeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  mealTypeChipTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  nutritionUnit: {
    fontSize: 9,
    color: COLORS.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  nutritionLabel: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Sections
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  warningSection: {
    backgroundColor: '#FFF8F0',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  harmfulItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 4,
  },
  harmfulDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.warning,
  },
  harmfulText: {
    fontSize: 13,
    color: COLORS.text,
    flex: 1,
    lineHeight: 18,
  },
  insightCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  insightText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 20,
  },

  // Actions
  actions: {
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  confirmBtn: {
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  confirmBtnGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  confirmText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  skipBtn: {
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  skipText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  closeLink: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  closeLinkText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
});
