import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Switch, Alert, Modal,
  TextInput, ActivityIndicator, Platform, Linking
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db, auth } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { enableMealReminders, disableMealReminders } from '../services/notifications';
import { COLORS, SPACING, RADIUS, TAB_BAR_HEIGHT } from '../constants/theme';
import { confirmAction } from '../utils/confirm';

const DIET_GOALS = ['Weight Loss', 'Muscle Gain', 'Maintenance', 'Healthy Eating', 'Low Carb'];

type TargetField = 'calorieTarget' | 'proteinTarget' | 'carbTarget' | 'fatTarget';

const TARGET_CONFIG: Record<TargetField, { title: string; placeholder: string; min: number; max: number; label: string; successMessage: string }> = {
  calorieTarget: { title: 'Set Calorie Target', placeholder: 'e.g. 2000', min: 800, max: 8000, label: 'calorie target', successMessage: 'Calorie target updated' },
  proteinTarget: { title: 'Set Protein Target', placeholder: 'e.g. 120', min: 10, max: 500, label: 'protein target', successMessage: 'Protein target updated' },
  carbTarget: { title: 'Set Carb Target', placeholder: 'e.g. 250', min: 10, max: 900, label: 'carb target', successMessage: 'Carb target updated' },
  fatTarget: { title: 'Set Fat Target', placeholder: 'e.g. 65', min: 10, max: 300, label: 'fat target', successMessage: 'Fat target updated' },
};

interface SettingRowProps {
  icon: string;
  iconGradient: [string, string];
  label: string;
  value?: string;
  onPress?: () => void;
  isSwitch?: boolean;
  switchValue?: boolean;
  onSwitch?: (val: boolean) => void;
}

function SettingRow({ icon, iconGradient, label, value, onPress, isSwitch, switchValue, onSwitch }: SettingRowProps) {
  return (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      disabled={isSwitch}
      activeOpacity={isSwitch ? 1 : 0.7}
    >
      <LinearGradient colors={iconGradient} style={styles.settingIconWrapper} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Ionicons name={icon as any} size={17} color={COLORS.white} />
      </LinearGradient>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.settingRight}>
        {isSwitch ? (
          <Switch
            value={switchValue}
            onValueChange={onSwitch}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor={COLORS.white}
          />
        ) : (
          <>
            {value && <Text style={styles.settingValue}>{value}</Text>}
            <Ionicons name="chevron-forward" size={15} color={COLORS.textSecondary} />
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [meals, setMeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [dietGoal, setDietGoal] = useState('Weight Loss');
  const [targets, setTargets] = useState<Record<TargetField, string>>({
    calorieTarget: '2000',
    proteinTarget: '120',
    carbTarget: '250',
    fatTarget: '67',
  });
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [editingTarget, setEditingTarget] = useState<TargetField | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const openTargetModal = (field: TargetField) => {
    setTempValue(targets[field]);
    setModalError(null);
    setEditingTarget(field);
  };

  const saveTargetModal = () => {
    if (!editingTarget) return;
    const config = TARGET_CONFIG[editingTarget];
    const n = parseInt(tempValue, 10);
    if (!Number.isFinite(n) || n < config.min || n > config.max) {
      setModalError(`Enter a ${config.label} between ${config.min} and ${config.max}.`);
      return;
    }
    setTargets(prev => ({ ...prev, [editingTarget]: String(n) }));
    saveProfile({ [editingTarget]: String(n) }, config.successMessage);
    setEditingTarget(null);
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const firstName = user?.email?.split('@')[0] || 'User';
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, 'users', user.uid, 'profile', 'settings');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDietGoal(data.dietGoal || 'Weight Loss');
          const calorieTarget = data.calorieTarget || '2000';
          setTargets({
            calorieTarget,
            proteinTarget: data.proteinTarget || '120',
            carbTarget: data.carbTarget || String(Math.round(parseInt(calorieTarget) * 0.5 / 4)),
            fatTarget: data.fatTarget || String(Math.round(parseInt(calorieTarget) * 0.3 / 9)),
          });
          const notifPref = data.notifications ?? true;
          setNotifications(notifPref);
          if (notifPref) enableMealReminders(); else disableMealReminders();
        }
      } catch (e) {
        console.log('Profile load error:', e);
      }
    };
    loadProfile();
  }, [user]);

  const saveProfile = async (updates: any, successMessage?: string) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'profile', 'settings');
      await setDoc(docRef, updates, { merge: true });
      if (successMessage) showToast(successMessage);
    } catch (e) {
      Alert.alert('Error', 'Could not save your changes. Please try again.');
    }
  };

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const q = query(collection(db, 'users', currentUser.uid, 'meal_logs'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMeals(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const computeStreak = () => {
    if (meals.length === 0) return 0;
    const dates = meals
      .filter(m => m.logged_at)
      .map(m => {
        const d = m.logged_at.toDate ? m.logged_at.toDate() : new Date(m.logged_at);
        return d.toDateString();
      });
    const uniqueDates = [...new Set(dates)].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    if (uniqueDates.length === 0) return 0;

    // A streak stays "alive" through today even before today's meal is logged,
    // as long as the most recent log was yesterday. Only reset to 0 if the
    // gap since the last log is more than a day.
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (uniqueDates[0] !== today.toDateString() && uniqueDates[0] !== yesterday.toDateString()) {
      return 0;
    }

    let streak = 1;
    let cursor = new Date(uniqueDates[0]);
    for (let i = 1; i < uniqueDates.length; i++) {
      const expected = new Date(cursor);
      expected.setDate(cursor.getDate() - 1);
      if (uniqueDates[i] === expected.toDateString()) {
        streak++;
        cursor = expected;
      } else break;
    }
    return streak;
  };

  const avgScore = meals.length > 0
    ? meals.filter(m => m.health_score).reduce((s, m) => s + m.health_score, 0) / meals.filter(m => m.health_score).length
    : 0;

  const getLetterGrade = (score: number) => {
    if (score >= 9) return 'A+';
    if (score >= 8) return 'A';
    if (score >= 7) return 'A-';
    if (score >= 6) return 'B+';
    if (score >= 5) return 'B';
    return 'C';
  };

  const handleLogout = () => {
    confirmAction('Log Out', 'Are you sure you want to log out?', 'Log Out', logout);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + SPACING.md, paddingBottom: TAB_BAR_HEIGHT + SPACING.lg },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar Section */}
      <LinearGradient
        colors={['#E8F5EE', COLORS.background]}
        style={styles.avatarSection}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark]}
          style={styles.avatar}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.avatarInitial}>{displayName[0].toUpperCase()}</Text>
        </LinearGradient>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.goalTag}>
          <Ionicons name="trophy-outline" size={12} color={COLORS.primary} />
          <Text style={styles.goalTagText}>{dietGoal}</Text>
        </View>
      </LinearGradient>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{computeStreak()}</Text>
          <Text style={styles.statLabel}>🔥 Streak</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{meals.length}</Text>
          <Text style={styles.statLabel}>🍽️ Meals</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{avgScore > 0 ? getLetterGrade(avgScore) : '—'}</Text>
          <Text style={styles.statLabel}>⭐ Avg Score</Text>
        </View>
      </View>

      {/* Goals & Targets */}
      <Text style={styles.sectionTitle}>Goals & Targets</Text>
      <View style={styles.settingsCard}>
        <SettingRow
          icon="trophy-outline"
          iconGradient={[COLORS.primary, COLORS.primaryDark]}
          label="Diet Goals"
          value={dietGoal}
          onPress={() => setGoalModalVisible(true)}
        />
        <View style={styles.divider} />
        <SettingRow
          icon="flame-outline"
          iconGradient={[COLORS.warning, '#C06010']}
          label="Calorie Target"
          value={`${targets.calorieTarget} kcal`}
          onPress={() => openTargetModal('calorieTarget')}
        />
        <View style={styles.divider} />
        <SettingRow
          icon="barbell-outline"
          iconGradient={[COLORS.macroProtein, '#3A7FC9']}
          label="Protein Target"
          value={`${targets.proteinTarget}g`}
          onPress={() => openTargetModal('proteinTarget')}
        />
        <View style={styles.divider} />
        <SettingRow
          icon="leaf-outline"
          iconGradient={[COLORS.macroCarbs, '#B87608']}
          label="Carb Target"
          value={`${targets.carbTarget}g`}
          onPress={() => openTargetModal('carbTarget')}
        />
        <View style={styles.divider} />
        <SettingRow
          icon="water-outline"
          iconGradient={[COLORS.macroFat, '#A03020']}
          label="Fat Target"
          value={`${targets.fatTarget}g`}
          onPress={() => openTargetModal('fatTarget')}
        />
      </View>

      {/* Preferences */}
      <Text style={styles.sectionTitle}>Preferences</Text>
      <View style={styles.settingsCard}>
        <SettingRow
          icon="notifications-outline"
          iconGradient={['#9C27B0', '#6A1B9A']}
          label="Notifications"
          isSwitch
          switchValue={notifications}
          onSwitch={async (val) => {
            if (val) {
              const granted = await enableMealReminders();
              if (!granted) {
                Alert.alert(
                  'Permission needed',
                  Platform.OS === 'web'
                    ? 'Notifications were blocked. Allow them for this site in your browser settings to get daily meal reminders.'
                    : 'Enable notifications for NutriLens in your device settings to get daily meal reminders.'
                );
                return;
              }
            } else {
              await disableMealReminders();
            }
            setNotifications(val);
            saveProfile({ notifications: val }, val ? 'Reminders turned on' : 'Reminders turned off');
          }}
        />
      </View>

      {/* Account */}
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.settingsCard}>
        <SettingRow
          icon="mail-outline"
          iconGradient={[COLORS.macroProtein, '#3A7FC9']}
          label="Email"
          value={user?.email?.split('@')[0] + '...'}
        />
        {Platform.OS === 'web' && (
          <>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.logoutRow}
              onPress={() => Linking.openURL('/downloads/nutrilens-android.bin')}
              activeOpacity={0.8}
            >
              <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.settingIconWrapper} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="logo-android" size={17} color={COLORS.white} />
              </LinearGradient>
              <Text style={[styles.logoutText, { color: COLORS.text }]}>Download Android App</Text>
            </TouchableOpacity>
          </>
        )}
        <View style={styles.divider} />
        <TouchableOpacity style={styles.logoutRow} onPress={handleLogout} activeOpacity={0.8}>
          <LinearGradient colors={[COLORS.danger, '#A03020']} style={styles.settingIconWrapper} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Ionicons name="log-out-outline" size={17} color={COLORS.white} />
          </LinearGradient>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Diet Goal Modal */}
      <Modal visible={goalModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Diet Goal</Text>
            {DIET_GOALS.map(goal => (
              <TouchableOpacity
                key={goal}
                style={[styles.goalOption, dietGoal === goal && styles.goalOptionActive]}
                onPress={() => { setDietGoal(goal); saveProfile({ dietGoal: goal }, 'Diet goal updated'); setGoalModalVisible(false); }}
              >
                <Text style={[styles.goalOptionText, dietGoal === goal && styles.goalOptionTextActive]}>{goal}</Text>
                {dietGoal === goal && <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalClose} onPress={() => setGoalModalVisible(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Target Modal (Calorie / Protein / Carb / Fat) */}
      <Modal visible={!!editingTarget} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editingTarget ? TARGET_CONFIG[editingTarget].title : ''}</Text>
            <TextInput
              style={[styles.modalInput, modalError && styles.modalInputError]}
              value={tempValue}
              onChangeText={(v) => { setTempValue(v); setModalError(null); }}
              keyboardType="numeric"
              placeholder={editingTarget ? TARGET_CONFIG[editingTarget].placeholder : ''}
            />
            {modalError && <Text style={styles.modalErrorText}>{modalError}</Text>}
            <TouchableOpacity style={styles.modalSaveBtn} onPress={saveTargetModal}>
              <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.modalSaveBtnGradient}>
                <Text style={styles.modalSaveBtnText}>Save</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalClose} onPress={() => setEditingTarget(null)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {toast && (
        <View style={styles.toast} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.md },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.xl,
    marginHorizontal: -SPACING.md,
    paddingHorizontal: SPACING.md,
    gap: 6,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  avatarInitial: { fontSize: 34, fontWeight: '800', color: COLORS.white },
  name: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  email: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  goalTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 2,
  },
  goalTagText: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  settingsCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  settingIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingLabel: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: '500' },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  settingValue: { fontSize: 13, color: COLORS.textSecondary },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: SPACING.md + 36 + SPACING.sm,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  logoutText: { fontSize: 15, color: COLORS.danger, fontWeight: '700' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  modalHandle: {
    width: 44, height: 4, backgroundColor: COLORS.border,
    borderRadius: RADIUS.full, alignSelf: 'center', marginBottom: SPACING.sm,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  goalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  goalOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  goalOptionText: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  goalOptionTextActive: { color: COLORS.primary, fontWeight: '700' },
  modalInput: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 18,
    textAlign: 'center',
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  modalInputError: {
    borderColor: COLORS.danger,
  },
  modalErrorText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalSaveBtn: {
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  modalSaveBtnGradient: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  modalSaveBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  modalClose: { alignItems: 'center', paddingVertical: SPACING.sm },
  modalCloseText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '500' },

  toast: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT + SPACING.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  toastText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
});
