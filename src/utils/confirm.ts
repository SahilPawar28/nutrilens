import { Alert, Platform } from 'react-native';

// React Native Web's Alert.alert falls back to a single-button window.alert()
// for anything with custom multi-button arrays — the browser can't render
// custom button labels, so a "Cancel"/"Log Out" pair silently drops the
// onPress handler entirely. Route web through window.confirm() instead.
export function confirmAction(
  title: string,
  message: string,
  confirmText: string,
  onConfirm: () => void,
  destructive = true
) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
