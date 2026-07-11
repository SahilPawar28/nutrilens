import { Platform } from 'react-native';
import { initializeApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAWasyEA8OYuIY4HNYH7F1Q80o0FsfBPVE",
  authDomain: "nutrilens-e0de6.firebaseapp.com",
  projectId: "nutrilens-e0de6",
  storageBucket: "nutrilens-e0de6.firebasestorage.app",
  messagingSenderId: "37169980192",
  appId: "1:37169980192:web:05fab8fd4623a972652d45"
};

const app = initializeApp(firebaseConfig);

export const auth = Platform.OS === 'web'
  ? initializeAuth(app, { persistence: browserLocalPersistence })
  : initializeAuth(app, {
      persistence: require('firebase/auth').getReactNativePersistence(require('@react-native-async-storage/async-storage').default)
    });

export const db = getFirestore(app);
export const storage = getStorage(app);
