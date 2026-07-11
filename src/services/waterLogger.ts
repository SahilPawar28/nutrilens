import { db, auth } from './firebase';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function subscribeToTodayWater(onChange: (count: number) => void) {
  const user = auth.currentUser;
  if (!user) return () => {};
  const ref = doc(db, 'users', user.uid, 'water_logs', todayKey());
  return onSnapshot(ref, (snap) => {
    onChange(snap.exists() ? snap.data().count || 0 : 0);
  });
}

export async function getTodayWaterCount(): Promise<number> {
  const user = auth.currentUser;
  if (!user) return 0;
  const ref = doc(db, 'users', user.uid, 'water_logs', todayKey());
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().count || 0 : 0;
}

export async function setTodayWaterCount(count: number) {
  const user = auth.currentUser;
  if (!user) return;
  const ref = doc(db, 'users', user.uid, 'water_logs', todayKey());
  await setDoc(ref, { count: Math.max(0, count) }, { merge: true });
}
