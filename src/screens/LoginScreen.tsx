import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

const FOOD_EMOJIS = ['🥑', '🍓', '🫐', '🥦', '🍎', '🥗', '🍊', '🥕'];

// The native module is fetched eagerly at import time by this package, which
// throws in Expo Go / web (no custom dev client). Load it lazily so a missing
// native module doesn't crash the whole app before React can even mount.
let GoogleSignin: any = null;
let statusCodes: any = null;
// The native library only ships a real implementation for Android/iOS dev-client
// or production builds. Its web build is an unimplemented stub (sponsor-only),
// and Expo Go throws at import time since the native module isn't linked there.
let googleSignInAvailable = Platform.OS !== 'web';
try {
  const googleSigninModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = googleSigninModule.GoogleSignin;
  statusCodes = googleSigninModule.statusCodes;
  if (googleSignInAvailable) {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });
  }
} catch (e) {
  googleSignInAvailable = false;
}

function isGmail(email: string) {
  return email.trim().toLowerCase().endsWith('@gmail.com');
}

export default function LoginScreen() {
  const { login, signup, signInWithGoogle } = useAuth();
  const [isLogin, setIsLogin] = useState(true);

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Signup-only fields
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGooglePress = async () => {
    if (!googleSignInAvailable) {
      Alert.alert('Not available', 'Google Sign-In requires a custom native build and isn\'t supported in Expo Go or on web. Please log in with email/password.');
      return;
    }
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signOut(); // clear cached account so picker always shows
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (!idToken) throw new Error('No ID token returned');
      await signInWithGoogle(idToken);
    } catch (e: any) {
      if (e.code !== statusCodes.SIGN_IN_CANCELLED && e.code !== statusCodes.IN_PROGRESS) {
        Alert.alert('Google Sign-In failed', e.message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // Floating emoji animations
  const floatAnims = useRef(FOOD_EMOJIS.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const animations = floatAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 2200 + i * 300, useNativeDriver: true, delay: i * 180 }),
          Animated.timing(anim, { toValue: 0, duration: 2200 + i * 300, useNativeDriver: true }),
        ])
      )
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please fill in all required fields.');
      return;
    }
    if (!isLogin) {
      if (!phone) {
        Alert.alert('Missing fields', 'Please enter your phone number.');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Password mismatch', 'Passwords do not match.');
        return;
      }
      if (password.length < 6) {
        Alert.alert('Weak password', 'Password must be at least 6 characters.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password, phone);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setEmail('');
    setPassword('');
    setPhone('');
    setConfirmPassword('');
  };

  const floatPositions = [
    { top: 14, left: 18 }, { top: 8, right: 28 }, { top: 40, left: 55 },
    { top: 18, right: 60 }, { bottom: 18, left: 30 }, { bottom: 12, right: 22 },
    { bottom: 28, left: 75 }, { top: 50, right: 16 },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <LinearGradient colors={['#E8F5EE', '#F9F7F0']} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          {FOOD_EMOJIS.map((emoji, i) => {
            const y = floatAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
            return (
              <Animated.Text key={i} style={[styles.floatEmoji, floatPositions[i], { transform: [{ translateY: y }] }]}>
                {emoji}
              </Animated.Text>
            );
          })}
          <View style={styles.logoWrapper}>
            <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.logoBg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.logoEmoji}>🌿</Text>
            </LinearGradient>
            <Text style={styles.logoText}>NutriLens</Text>
            <Text style={styles.logoTagline}>Your AI nutrition companion</Text>
          </View>
        </LinearGradient>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>{isLogin ? 'Welcome back' : 'Create account'}</Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'Log in with your Gmail account' : 'Sign up with your Gmail account'}
          </Text>

          {/* Gmail badge */}
          <View style={styles.gmailBadge}>
            <Text style={styles.gmailBadgeText}>🔒 Gmail accounts only</Text>
          </View>

          <View style={styles.form}>

            {/* Phone (signup only) */}
            {!isLogin && (
              <View style={styles.inputWrapper}>
                <Ionicons name="call-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Phone number"
                  placeholderTextColor={COLORS.textSecondary}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            )}

            {/* Email */}
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Gmail address"
                placeholderTextColor={COLORS.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Password */}
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={COLORS.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Confirm password (signup only) */}
            {!isLogin && (
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm password"
                  placeholderTextColor={COLORS.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirm}
                />
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
                  <Ionicons name={showConfirm ? 'eye-outline' : 'eye-off-outline'} size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryDark]}
                style={styles.submitBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>{isLogin ? 'Log In' : 'Sign Up'}</Text>
                    <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Google Sign-In — only shown when the native module is actually linked
                (i.e. a custom dev/production build, not Expo Go or web) */}
            {googleSignInAvailable && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={[styles.googleBtn, googleLoading && styles.btnDisabled]}
                  onPress={handleGooglePress}
                  disabled={googleLoading}
                  activeOpacity={0.85}
                >
                  {googleLoading ? (
                    <ActivityIndicator color={COLORS.text} />
                  ) : (
                    <>
                      <Text style={styles.googleIcon}>G</Text>
                      <Text style={styles.googleBtnText}>Continue with Google</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Switch mode */}
            <TouchableOpacity style={styles.toggleBtn} onPress={switchMode} activeOpacity={0.7}>
              <Text style={styles.toggleText}>
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <Text style={styles.toggleLink}>{isLogin ? 'Sign Up' : 'Log In'}</Text>
              </Text>
            </TouchableOpacity>

          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1 },

  hero: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  floatEmoji: { position: 'absolute', fontSize: 24, opacity: 0.6 },
  logoWrapper: { alignItems: 'center', gap: 8 },
  logoBg: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  logoEmoji: { fontSize: 32 },
  logoText: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  logoTagline: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },

  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
    marginTop: -20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500', marginBottom: SPACING.sm },

  gmailBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5EE',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    marginBottom: SPACING.lg,
  },
  gmailBadgeText: { fontSize: 12, color: COLORS.primaryDark, fontWeight: '600' },

  form: { gap: SPACING.md },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  inputIcon: { marginRight: SPACING.sm },
  input: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: '500' },
  eyeBtn: { padding: 2 },

  submitBtn: {
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  submitBtnGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },

  btnDisabled: { opacity: 0.6 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.textSecondary, fontSize: 13 },

  googleBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4285F4',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  googleBtnText: { fontSize: 15, color: COLORS.text, fontWeight: '600' },

  toggleBtn: { alignItems: 'center' },
  toggleText: { textAlign: 'center', color: COLORS.textSecondary, fontSize: 14, fontWeight: '500' },
  toggleLink: { color: COLORS.primary, fontWeight: '700' },
});
