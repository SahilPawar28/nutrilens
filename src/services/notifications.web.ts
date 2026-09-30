// Web has no equivalent of a native OS-level scheduled notification that
// fires even when the app is fully closed — that needs a real Web Push
// subscription plus a server to trigger it at the right time, which this
// project doesn't have a backend for. This is the best honest approximation:
// while NutriLens is open (foreground or a background tab), it keeps a timer
// armed for the next 8pm reminder and re-arms it on every load, so as long
// as the tab/installed PWA gets opened at least once before the target time
// each day, the reminder still fires via the service worker.
const STORAGE_KEY = 'nutrilens_reminders_enabled';
const REMINDER_HOUR = 20;

let timer: ReturnType<typeof setTimeout> | null = null;

function msUntilNextReminder(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(REMINDER_HOUR, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

async function fireReminder() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification("Don't forget to log your meals 🌿", {
        body: "Take a photo of what you've eaten today to keep your streak going.",
        icon: '/icon-192.png',
      });
    } else if (Notification.permission === 'granted') {
      new Notification("Don't forget to log your meals 🌿", {
        body: "Take a photo of what you've eaten today to keep your streak going.",
      });
    }
  } catch {
    // Notification display failing shouldn't crash the reminder loop.
  }
  armTimer();
}

function armTimer() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(fireReminder, msUntilNextReminder());
}

function disarmTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}

export async function enableMealReminders(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
    localStorage.setItem(STORAGE_KEY, 'true');
    armTimer();
    return true;
  } catch {
    return false;
  }
}

export async function disableMealReminders(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
  disarmTimer();
}

// Re-arms the reminder timer on load if it was previously enabled and
// permission is still granted — call once from the app root on web.
export function initWebReminders(): void {
  if (typeof Notification === 'undefined') return;
  if (localStorage.getItem(STORAGE_KEY) === 'true' && Notification.permission === 'granted') {
    armTimer();
  }
}
