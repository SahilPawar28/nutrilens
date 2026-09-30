import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { updateMeal, deleteMeal } from '../services/mealLogger';
import FoodIconBox from './FoodIconBox';
import { confirmAction } from '../utils/confirm';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];

interface Props {
  visible: boolean;
  meal: any;
  onClose: () => void;
}

function formatTime(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export default function MealDetailModal({ visible, meal, onClose }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState<any>(null);

  useEffect(() => {
    if (meal) {
      setEdited({
        food_name: meal.food_name,
        calories: String(meal.calories ?? ''),
        protein: String(meal.protein ?? ''),
        carbs: String(meal.carbs ?? ''),
        fat: String(meal.fat ?? ''),
        meal_type: meal.meal_type,
      });
      setEditing(false);
    }
  }, [meal]);

  if (!meal || !edited) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMeal(meal.id, {
        food_name: edited.food_name,
        calories: parseInt(edited.calories) || 0,
        protein: parseInt(edited.protein) || 0,
        carbs: parseInt(edited.carbs) || 0,
        fat: parseInt(edited.fat) || 0,
        meal_type: edited.meal_type,
      });
      setEditing(false);
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    confirmAction('Delete meal', `Remove "${meal.food_name}" from your log?`, 'Delete', async () => {
      try {
        await deleteMeal(meal.id);
        onClose();
      } catch (e) {
        Alert.alert('Error', 'Could not delete meal.');
      }
    });
  };

  const NUTRITION_FIELDS = [
    { label: 'Calories', field: 'calories', unit: 'kcal', color: COLORS.primary, bg: COLORS.primaryLight, icon: 'flame-outline' },
    { label: 'Protein', field: 'protein', unit: 'g', color: COLORS.macroProtein, bg: COLORS.macroProteinBg, icon: 'barbell-outline' },
    { label: 'Carbs', field: 'carbs', unit: 'g', color: COLORS.macroCarbs, bg: COLORS.macroCarbsBg, icon: 'leaf-outline' },
    { label: 'Fat', field: 'fat', unit: 'g', color: COLORS.macroFat, bg: COLORS.macroFatBg, icon: 'water-outline' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <FoodIconBox foodName={meal.food_name} emoji={meal.emoji} size={52} />
              <View style={styles.headerInfo}>
                {editing ? (
                  <TextInput
                    style={styles.foodNameInput}
                    value={edited.food_name}
                    onChangeText={(v) => setEdited({ ...edited, food_name: v })}
                  />
                ) : (
                  <Text style={styles.foodName}>{meal.food_name}</Text>
                )}
                <Text style={styles.timeText}>{formatTime(meal.logged_at)}</Text>
              </View>
              <TouchableOpacity style={styles.editToggle} onPress={() => setEditing(!editing)}>
                <Ionicons name={editing ? 'close' : 'pencil-outline'} size={16} color={COLORS.primaryDark} />
              </TouchableOpacity>
            </View>

            {/* Meal type */}
            <View style={styles.mealTypeRow}>
              {MEAL_TYPES.map((mt) => (
                <TouchableOpacity
                  key={mt}
                  disabled={!editing}
                  style={[
                    styles.mealTypeChip,
                    edited.meal_type === mt && styles.mealTypeChipActive,
                    !editing && styles.mealTypeChipDisabled,
                  ]}
                  onPress={() => setEdited({ ...edited, meal_type: mt })}
                  activeOpacity={editing ? 0.8 : 1}
                >
                  <Text style={[styles.mealTypeChipText, edited.meal_type === mt && styles.mealTypeChipTextActive]}>{mt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Nutrition grid */}
            <View style={styles.nutritionGrid}>
              {NUTRITION_FIELDS.map((item) => (
                <View key={item.field} style={[styles.nutritionCard, { backgroundColor: item.bg, borderTopColor: item.color }]}>
                  <Ionicons name={item.icon as any} size={16} color={item.color} style={{ marginBottom: 4 }} />
                  {editing ? (
                    <TextInput
                      style={[styles.nutritionValue, styles.nutritionValueInput, { color: item.color }]}
                      value={String(edited[item.field])}
                      onChangeText={(v) => setEdited({ ...edited, [item.field]: v.replace(/[^0-9]/g, '') })}
                      keyboardType="numeric"
                    />
                  ) : (
                    <Text style={[styles.nutritionValue, { color: item.color }]}>{edited[item.field] ?? '—'}</Text>
                  )}
                  <Text style={styles.nutritionUnit}>{item.unit}</Text>
                  <Text style={styles.nutritionLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            {meal.health_score != null && (
              <View style={styles.scoreRow}>
                <Ionicons name="star-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.scoreText}>Health score: {meal.health_score}/10</Text>
              </View>
            )}

            {meal.harmful_ingredients?.length > 0 && (
              <View style={styles.warningSection}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="warning-outline" size={16} color={COLORS.warning} />
                  <Text style={styles.sectionTitle}>Watch Out For</Text>
                </View>
                {meal.harmful_ingredients.map((ing: string, i: number) => (
                  <View key={i} style={styles.harmfulItem}>
                    <View style={styles.harmfulDot} />
                    <Text style={styles.harmfulText}>{ing}</Text>
                  </View>
                ))}
              </View>
            )}

            {meal.summary ? (
              <View style={styles.insightCard}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="bulb-outline" size={16} color={COLORS.primary} />
                  <Text style={[styles.sectionTitle, { color: COLORS.primaryDark }]}>Health Insight</Text>
                </View>
                <Text style={styles.insightText}>{meal.summary}</Text>
              </View>
            ) : null}

            {/* Actions */}
            <View style={styles.actions}>
              {editing ? (
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
                  <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.saveBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    {saving ? <ActivityIndicator color={COLORS.white} /> : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
                        <Text style={styles.saveBtnText}>Save Changes</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.85}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                  <Text style={styles.deleteBtnText}>Delete Meal</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.closeLink} onPress={onClose}>
                <Text style={styles.closeLinkText}>Close</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: SPACING.lg,
    maxHeight: '90%',
    elevation: 20,
  },
  handle: {
    width: 44, height: 4, backgroundColor: COLORS.border,
    borderRadius: RADIUS.full, alignSelf: 'center', marginBottom: SPACING.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  headerInfo: { flex: 1 },
  foodName: { fontSize: 19, fontWeight: '800', color: COLORS.text },
  foodNameInput: {
    fontSize: 19, fontWeight: '800', color: COLORS.text,
    borderBottomWidth: 1.5, borderBottomColor: COLORS.primary, paddingVertical: 2,
  },
  timeText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  editToggle: {
    width: 36, height: 36, borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
  },

  mealTypeRow: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.md },
  mealTypeChip: {
    flex: 1, paddingVertical: 8, borderRadius: RADIUS.full,
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center',
  },
  mealTypeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  mealTypeChipDisabled: { opacity: 0.7 },
  mealTypeChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  mealTypeChipTextActive: { color: COLORS.white, fontWeight: '700' },

  nutritionGrid: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  nutritionCard: {
    flex: 1, borderRadius: RADIUS.md, padding: SPACING.sm, alignItems: 'center',
    borderTopWidth: 3, elevation: 1,
  },
  nutritionValue: { fontSize: 18, fontWeight: '800' },
  nutritionValueInput: {
    textAlign: 'center', minWidth: 30, padding: 0,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.15)',
  },
  nutritionUnit: { fontSize: 9, color: COLORS.textSecondary, fontWeight: '600', letterSpacing: 0.5 },
  nutritionLabel: { fontSize: 9, color: COLORS.textSecondary, marginTop: 2, fontWeight: '600', letterSpacing: 0.3 },

  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.md },
  scoreText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  warningSection: {
    backgroundColor: '#FFF8F0', borderRadius: RADIUS.md, padding: SPACING.md,
    marginBottom: SPACING.md, borderLeftWidth: 3, borderLeftColor: COLORS.warning,
  },
  harmfulItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
  harmfulDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.warning },
  harmfulText: { fontSize: 13, color: COLORS.text, flex: 1, lineHeight: 18 },
  insightCard: {
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: SPACING.md,
    marginBottom: SPACING.md, borderLeftWidth: 3, borderLeftColor: COLORS.primary,
  },
  insightText: { fontSize: 13, color: COLORS.text, lineHeight: 20 },

  actions: { gap: SPACING.sm, marginTop: SPACING.xs, paddingBottom: SPACING.lg },
  saveBtn: {
    borderRadius: RADIUS.full, overflow: 'hidden', elevation: 4,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  saveBtnGradient: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: SPACING.md, gap: SPACING.sm,
  },
  saveBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  deleteBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: SPACING.sm,
    borderRadius: RADIUS.full, paddingVertical: SPACING.md,
    borderWidth: 1.5, borderColor: COLORS.danger + '55',
  },
  deleteBtnText: { color: COLORS.danger, fontWeight: '700', fontSize: 15 },
  closeLink: { alignItems: 'center', paddingVertical: SPACING.sm },
  closeLinkText: { color: COLORS.textSecondary, fontSize: 13 },
});
