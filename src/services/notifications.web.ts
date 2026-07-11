// Web stub: expo-notifications' native push-token registration chain doesn't
// bundle cleanly for web (pulls in unresolvable Node polyfills via Metro), and
// scheduled local notifications aren't meaningfully supported on web anyway.
export async function enableMealReminders(): Promise<boolean> {
  return false;
}

export async function disableMealReminders(): Promise<void> {}
