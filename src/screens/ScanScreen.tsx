import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, Alert, ScrollView,
  Modal, TextInput, KeyboardAvoidingView, Platform, useWindowDimensions
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { COLORS, SPACING, RADIUS, TAB_BAR_HEIGHT, WEB_BREAKPOINT, SIDEBAR_WIDTH } from '../constants/theme';
import { analyzeFood } from '../services/openrouter';
import { logMeal } from '../services/mealLogger';
import { lookupBarcodeProduct } from '../services/barcodeLookup';
import { db, auth } from '../services/firebase';
import NutritionResult from '../components/NutritionResult';

// The camera sensor's native aspect ratio is never 1:1, so a square viewfinder
// only shows a center crop of the live feed — the captured photo must be
// cropped to match, or the saved image would include stuff outside the frame.
async function cropToSquare(photo: { uri: string; width: number; height: number }) {
  const size = Math.min(photo.width, photo.height);
  const originX = Math.round((photo.width - size) / 2);
  const originY = Math.round((photo.height - size) / 2);
  return manipulateAsync(
    photo.uri,
    [{ crop: { originX, originY, width: size, height: size } }],
    { compress: 0.9, format: SaveFormat.JPEG }
  );
}

type Mode = 'I ate this' | 'Should I eat?';

export default function ScanScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && windowWidth - SIDEBAR_WIDTH >= WEB_BREAKPOINT;
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>('I ate this');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [resultVisible, setResultVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [extraDetails, setExtraDetails] = useState('');
  const [dietGoal, setDietGoal] = useState<string | undefined>(undefined);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const cameraRef = useRef<any>(null);
  const barcodeHandledRef = useRef(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    getDoc(doc(db, 'users', user.uid, 'profile', 'settings'))
      .then(snap => { if (snap.exists()) setDietGoal(snap.data().dietGoal); })
      .catch(() => {});
  }, []);

  // ── Camera ────────────────────────────────────────────────────────────────

  const handleCapture = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Permission needed', 'Camera permission is required to scan food.');
      }
      return;
    }
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      const cropped = await cropToSquare(photo);
      barcodeHandledRef.current = true;
      setImageUri(cropped.uri);
    } catch {
      Alert.alert('Capture failed', 'Could not take the photo. Please try again.');
    }
  };

  const handleBarcodeScanned = async (scan: { data: string }) => {
    if (barcodeHandledRef.current) return;
    barcodeHandledRef.current = true;
    setBarcodeLoading(true);
    try {
      const product = await lookupBarcodeProduct(scan.data);
      if (!product) {
        Alert.alert('Not found', "Couldn't find this product in the barcode database. Try taking a photo of the label instead.");
        return;
      }
      setImageUri('');
      setResult(product);
      setResultVisible(true);
    } catch {
      Alert.alert('Lookup failed', 'Could not look up this barcode. Try taking a photo of the label instead.');
    } finally {
      setBarcodeLoading(false);
    }
  };

  // ── Gallery ───────────────────────────────────────────────────────────────

  const handleGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (!res.canceled) {
      setImageUri(res.assets[0].uri);
    }
  };

  // ── Analyze ───────────────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    if (!imageUri) {
      Alert.alert('No image', 'Please take or upload a photo first.');
      return;
    }
    setLoading(true);
    try {
      const analysis = await analyzeFood(imageUri, extraDetails || undefined, dietGoal);
      setResult(analysis);
      setResultVisible(true);
    } catch (error: any) {
      console.log('Analysis error:', error);
      const notFood = typeof error?.message === 'string' && error.message.includes("doesn't look like food");
      Alert.alert(
        notFood ? 'Not food or a label' : 'Analysis failed',
        notFood
          ? error.message
          : 'Could not read this image. Try a clearer photo, better lighting, or add food details using the pencil button.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Log meal (called only from inside NutritionResult) ────────────────────

  const handleConfirmEat = async (edited: any, mealType: string) => {
    try {
      const { queued } = await logMeal(edited, imageUri!, mealType);
      setResultVisible(false);
      setImageUri(null);
      setExtraDetails('');
      setResult(null);
      if (queued) {
        Alert.alert('📶 Saved offline', `${edited.food_name} will sync to your diary once you're back online.`);
      } else {
        Alert.alert('✅ Logged!', `${edited.food_name} added to your diary.`);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not log meal.');
    }
  };

  const handleReset = () => {
    setImageUri(null);
    setExtraDetails('');
    setResult(null);
    barcodeHandledRef.current = false;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Barcode Lookup Loading ── */}
      <Modal visible={barcodeLoading} transparent animationType="fade">
        <View style={styles.barcodeLoadingOverlay}>
          <View style={styles.barcodeLoadingCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.barcodeLoadingText}>Looking up product...</Text>
          </View>
        </View>
      </Modal>

      {/* ── Extra Details Modal (pencil button) ── */}
      <Modal
        visible={detailsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.detailsOverlay}
        >
          <View style={styles.detailsSheet}>
            <View style={styles.detailsHandle} />
            <Text style={styles.detailsTitle}>Add Food Details</Text>
            <Text style={styles.detailsSubtitle}>
              Describe the food, portion size, or any extras to improve accuracy
            </Text>
            <TextInput
              style={styles.detailsInput}
              value={extraDetails}
              onChangeText={setExtraDetails}
              placeholder="e.g. 1 cup of rice, add 2 boiled eggs, dal portion is small..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
              numberOfLines={4}
              autoFocus
            />
            <View style={styles.detailsActions}>
              <TouchableOpacity
                style={styles.detailsCancelBtn}
                onPress={() => setDetailsModalVisible(false)}
              >
                <Text style={styles.detailsCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.detailsDoneBtn}
                onPress={() => setDetailsModalVisible(false)}
              >
                <Text style={styles.detailsDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Nutrition Result Sheet ── */}
      <NutritionResult
        visible={resultVisible}
        result={result}
        mode={mode === 'I ate this' ? 'ate' : 'should_eat'}
        onClose={() => setResultVisible(false)}
        onConfirmEat={handleConfirmEat}
      />

      {/* ── Main UI ── */}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          isDesktop && styles.desktopContent,
          { paddingBottom: isDesktop ? SPACING.xl : TAB_BAR_HEIGHT + SPACING.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.title}>Scan Food</Text>
        <Text style={styles.subtitle}>{isDesktop ? 'Upload a photo' : 'Take a photo or upload from gallery'}</Text>

        {/* Mode Toggle */}
        <View style={styles.toggleContainer}>
          {(['I ate this', 'Should I eat?'] as Mode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.toggleBtn, mode === m && styles.toggleBtnActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
                {m}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Image / Camera Area */}
        <View style={styles.imageArea}>
          {imageUri ? (
            <View style={styles.imagePreviewWrapper}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <TouchableOpacity style={styles.retakeBtn} onPress={handleReset}>
                <Ionicons name="refresh" size={18} color={COLORS.white} />
                <Text style={styles.retakeText}>Retake</Text>
              </TouchableOpacity>
            </View>
          ) : isDesktop ? (
            /* Desktop: a webcam photo isn't a realistic path here, so this is
               a plain upload dropzone instead of a live camera preview. */
            <TouchableOpacity
              style={styles.uploadBox}
              onPress={handleGallery}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-upload-outline" size={48} color={COLORS.primary} />
              <Text style={styles.uploadBoxTitle}>Click to upload a photo</Text>
              <Text style={styles.uploadBoxSubtitle}>A meal photo, or a packaged food's nutrition label</Text>
            </TouchableOpacity>
          ) : (
            /* Live camera preview inline, cropped to a square — only this
               square region is what actually gets captured. */
            <View style={styles.cameraPreviewBox}>
              {permission?.granted ? (
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  ref={cameraRef}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
                  onBarcodeScanned={handleBarcodeScanned}
                />
              ) : (
                <TouchableOpacity
                  style={styles.cameraPermissionBox}
                  onPress={requestPermission}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera-outline" size={44} color={COLORS.textSecondary} />
                  <Text style={styles.permissionText}>Tap to enable camera</Text>
                </TouchableOpacity>
              )}

              {/* Overlay corners on the preview */}
              <View style={styles.previewCornerTL} />
              <View style={styles.previewCornerTR} />
              <View style={styles.previewCornerBL} />
              <View style={styles.previewCornerBR} />
            </View>
          )}
        </View>

        {/* ── Input Row: Gallery | Camera (mobile only) | Details ── */}
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.inputBtn} onPress={handleGallery}>
            <Ionicons name="cloud-upload-outline" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>

          {!isDesktop && (
            <TouchableOpacity style={styles.cameraBtn} onPress={handleCapture}>
              <Ionicons name="camera" size={28} color={COLORS.white} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.inputBtn, extraDetails.length > 0 && styles.inputBtnActive]}
            onPress={() => setDetailsModalVisible(true)}
          >
            <Ionicons
              name="pencil-outline"
              size={22}
              color={extraDetails.length > 0 ? COLORS.primary : COLORS.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Extra details badge */}
        {extraDetails.length > 0 && (
          <View style={styles.detailsBadge}>
            <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />
            <Text style={styles.detailsBadgeText} numberOfLines={1}>
              Details: {extraDetails}
            </Text>
            <TouchableOpacity onPress={() => setExtraDetails('')}>
              <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Analyze Button */}
        {imageUri && (
          <TouchableOpacity
            style={styles.analyzeBtn}
            onPress={handleAnalyze}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="sparkles-outline" size={20} color={COLORS.white} />
                <Text style={styles.analyzeBtnText}>
                  {mode === 'I ate this' ? 'Analyze Food' : 'Should I Eat This?'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Mode Info Card */}
        <View style={styles.infoCard}>
          <Ionicons
            name={mode === 'I ate this' ? 'checkmark-circle-outline' : 'help-circle-outline'}
            size={20}
            color={COLORS.primary}
          />
          <Text style={styles.infoText}>
            {mode === 'I ate this'
              ? 'AI will identify the food and show nutrition — you confirm before logging'
              : 'AI will analyze ingredients and give a health recommendation'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const CORNER_SIZE = 22;
const CORNER_WIDTH = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },
  desktopContent: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },

  title: { fontSize: 26, fontWeight: 'bold', color: COLORS.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.md },

  // ── Mode toggle
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    padding: 4,
    marginBottom: SPACING.md,
    elevation: 2,
  },
  toggleBtn: {
    flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: COLORS.primary,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  toggleText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  toggleTextActive: { color: COLORS.white, fontWeight: 'bold' },

  // ── Image area
  imageArea: { marginBottom: SPACING.md },
  uploadBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.lg,
  },
  uploadBoxTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: SPACING.xs },
  uploadBoxSubtitle: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  cameraPreviewBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cameraPermissionBox: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  permissionText: { color: COLORS.textSecondary, fontSize: 14 },

  // Corner brackets on preview
  previewCornerTL: {
    position: 'absolute', top: 14, left: 14,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderTopWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH,
    borderColor: COLORS.primary, borderTopLeftRadius: 6,
  },
  previewCornerTR: {
    position: 'absolute', top: 14, right: 14,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderTopWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH,
    borderColor: COLORS.primary, borderTopRightRadius: 6,
  },
  previewCornerBL: {
    position: 'absolute', bottom: 14, left: 14,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderBottomWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH,
    borderColor: COLORS.primary, borderBottomLeftRadius: 6,
  },
  previewCornerBR: {
    position: 'absolute', bottom: 14, right: 14,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderBottomWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH,
    borderColor: COLORS.primary, borderBottomRightRadius: 6,
  },

  imagePreviewWrapper: { borderRadius: RADIUS.lg, overflow: 'hidden', position: 'relative' },
  imagePreview: { width: '100%', aspectRatio: 1, borderRadius: RADIUS.lg },
  retakeBtn: {
    position: 'absolute', bottom: SPACING.md, right: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full,
  },
  retakeText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },

  // ── Input row
  inputRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: SPACING.lg, marginBottom: SPACING.sm,
  },
  inputBtn: {
    width: 50, height: 50, borderRadius: RADIUS.full,
    backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center', elevation: 2,
  },
  inputBtnActive: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  cameraBtn: {
    width: 68, height: 68, borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', elevation: 6,
  },

  // ── Details badge
  detailsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: 6,
    marginBottom: SPACING.sm,
  },
  detailsBadgeText: { flex: 1, fontSize: 12, color: COLORS.primaryDark },

  // ── Analyze button
  analyzeBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full, paddingVertical: SPACING.md,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: SPACING.sm, marginBottom: SPACING.md, elevation: 4,
  },
  analyzeBtnText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },

  // ── Info card
  infoCard: {
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md,
    padding: SPACING.md, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
  },
  infoText: { flex: 1, fontSize: 13, color: COLORS.primaryDark, lineHeight: 18 },

  // ── Barcode loading overlay
  barcodeLoadingOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  barcodeLoadingCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    padding: SPACING.xl, alignItems: 'center', gap: SPACING.sm,
  },
  barcodeLoadingText: { fontSize: 14, color: COLORS.text, fontWeight: '600' },

  // ── Details modal
  detailsOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)',
  },
  detailsSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.lg, paddingBottom: SPACING.xl,
  },
  detailsHandle: {
    width: 40, height: 4, backgroundColor: COLORS.border,
    borderRadius: RADIUS.full, alignSelf: 'center', marginBottom: SPACING.md,
  },
  detailsTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginBottom: 4 },
  detailsSubtitle: { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.md },
  detailsInput: {
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    padding: SPACING.md, fontSize: 15, color: COLORS.text,
    textAlignVertical: 'top', minHeight: 100,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  detailsActions: { flexDirection: 'row', gap: SPACING.sm },
  detailsCancelBtn: {
    flex: 1, borderRadius: RADIUS.full, paddingVertical: SPACING.md,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  detailsCancelText: { color: COLORS.textSecondary, fontWeight: '600' },
  detailsDoneBtn: {
    flex: 1, borderRadius: RADIUS.full, paddingVertical: SPACING.md,
    alignItems: 'center', backgroundColor: COLORS.primary,
  },
  detailsDoneText: { color: COLORS.white, fontWeight: 'bold' },
});
