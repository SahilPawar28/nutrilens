import { db } from './firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { auth } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'nutrilens_pending_meals';

interface QueuedMeal {
  uid: string;
  nutritionData: any;
  imageUri: string;
  mealType: string;
  queuedAtMillis: number;
}

async function getQueue(): Promise<QueuedMeal[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function setQueue(queue: QueuedMeal[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function writeMealDoc(uid: string, nutritionData: any, imageUri: string, mealType: string) {
  await addDoc(collection(db, 'users', uid, 'meal_logs'), {
    food_name: nutritionData.food_name,
    emoji: nutritionData.emoji || '🍽️',
    calories: nutritionData.calories,
    protein: nutritionData.protein,
    carbs: nutritionData.carbs,
    fat: nutritionData.fat,
    image_type: nutritionData.image_type,
    harmful_ingredients: nutritionData.harmful_ingredients || [],
    summary: nutritionData.awareness_summary || nutritionData.summary || '',
    health_score: nutritionData.health_score || null,
    imageUri,
    logged_at: serverTimestamp(),
    meal_type: mealType,
  });
}

/** Logs a meal. If the write fails (e.g. no connectivity), queues it locally and returns queued: true. */
export async function logMeal(nutritionData: any, imageUri: string, mealType?: string): Promise<{ queued: boolean }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not logged in');
  const resolvedMealType = mealType || getMealType();

  try {
    await writeMealDoc(user.uid, nutritionData, imageUri, resolvedMealType);
    flushMealQueue().catch(() => {});
    return { queued: false };
  } catch (e) {
    const queue = await getQueue();
    queue.push({ uid: user.uid, nutritionData, imageUri, mealType: resolvedMealType, queuedAtMillis: Date.now() });
    await setQueue(queue);
    return { queued: true };
  }
}

/** Retries any locally-queued meals for the current user. Returns how many synced successfully. */
export async function flushMealQueue(): Promise<number> {
  const user = auth.currentUser;
  if (!user) return 0;
  const queue = await getQueue();
  if (queue.length === 0) return 0;

  const remaining: QueuedMeal[] = [];
  let synced = 0;
  for (const item of queue) {
    if (item.uid !== user.uid) { remaining.push(item); continue; }
    try {
      await writeMealDoc(item.uid, item.nutritionData, item.imageUri, item.mealType);
      synced++;
    } catch {
      remaining.push(item);
    }
  }
  await setQueue(remaining);
  return synced;
}

export async function getPendingMealCount(): Promise<number> {
  const user = auth.currentUser;
  if (!user) return 0;
  const queue = await getQueue();
  return queue.filter(item => item.uid === user.uid).length;
}

export async function updateMeal(mealId: string, updates: any) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not logged in');
  await updateDoc(doc(db, 'users', user.uid, 'meal_logs', mealId), updates);
}

export async function deleteMeal(mealId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not logged in');
  await deleteDoc(doc(db, 'users', user.uid, 'meal_logs', mealId));
}

export function getMealType(): string {
  const hour = new Date().getHours();
  if (hour < 10) return 'Breakfast';
  if (hour < 14) return 'Lunch';
  if (hour < 18) return 'Snack';
  return 'Dinner';
}
