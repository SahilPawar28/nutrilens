import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, Alert, ScrollView,
  Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { COLORS, SPACING, RADIUS, TAB_BAR_HEIGHT } from '../constants/theme';
import { analyzeFood } from '../services/openrouter';
import { logMeal } from '../services/mealLogger';
import { lookupBarcodeProduct } from '../services/barcodeLookup';
import { db, auth } from '../services/firebase';
import NutritionResult from '../components/NutritionResult';

const { width, height } = Dimensions.get('window');

type Mode = 'I ate this' | 'Should I eat?';

export default function ScanScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>('I ate this');
  const [cameraOpen, setCameraOpen] = useState(false);
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

  const handleOpenCamera = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Permission needed', 'Camera permission is required to scan food.');
        return;
      }
    }
    barcodeHandledRef.current = false;
    setCameraOpen(true);
  };

  const handleTakePhoto = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: true });
      setImageUri(photo.uri);
      setCameraOpen(false);
    }
  };

  const handleBarcodeScanned = async (scan: { data: string }) => {
    if (barcodeHandledRef.current) return;
    barcodeHandledRef.current = true;
    setCameraOpen(false);
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
      const aiMode = mode === 'I ate this' ? 'ate' : 'should_eat';
      const analysis = await analyzeFood(imageUri, aiMode, extraDetails || undefined, dietGoal);
      setResult(analysis);
      setResultVisible(true);
    } catch (error: any) {
      console.log('Analysis error:', error);
      Alert.alert(
        'Analysis failed',
        'Could not read this image. Try a clearer photo, better lighting, or add food details using the pencil button.',
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
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Full-screen Camera Modal ── */}
      <Modal visible={cameraOpen} animationType="slide" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            ref={cameraRef}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={handleBarcodeScanned}
          />

          {/* Overlay: no dim — transparent so user sees a clean viewfinder */}
          <View style={styles.cameraOverlay}>
            {/* Close */}
            <TouchableOpacity style={styles.cameraClose} onPress={() => setCameraOpen(false)}>
              <Ionicons name="close" size={28} color={COLORS.white} />
            </TouchableOpacity>

            {/* Corner-bracket scan frame */}
            <View style={styles.scanFrame}>
              <View style={[styles.scanCorner, styles.topLeft]} />
              <View style={[styles.scanCorner, styles.topRight]} />
              <View style={[styles.scanCorner, styles.bottomLeft]} />
              <View style={[styles.scanCorner, styles.bottomRight]} />
            </View>

            <Text style={styles.cameraHint}>Point at food, a label, or a barcode</Text>

            {/* Capture button */}
            <TouchableOpacity style={styles.captureBtn} onPress={handleTakePhoto}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_HEIGHT + SPACING.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.title}>Scan Food</Text>
        <Text style={styles.subtitle}>Take a photo or upload from gallery</Text>

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
          ) : (
            /* Live camera preview inline — tapping opens full camera */
            <TouchableOpacity
              style={styles.cameraPreviewBox}
              onPress={handleOpenCamera}
              activeOpacity={0.9}
            >
              {permission?.granted ? (
                <CameraView style={StyleSheet.absoluteFillObject} facing="back" />
              ) : (
                <View style={styles.cameraPermissionBox}>
                  <Ionicons name="camera-outline" size={44} color={COLORS.textSecondary} />
                  <Text style={styles.permissionText}>Tap to enable camera</Text>
                </View>
              )}

              {/* Overlay corners on the preview */}
              <View style={styles.previewCornerTL} />
              <View style={styles.previewCornerTR} />
              <View style={styles.previewCornerBL} />
              <View style={styles.previewCornerBR} />

              <View style={styles.previewTapHint}>
                <Ionicons name="camera" size={18} color={COLORS.white} />
                <Text style={styles.previewTapText}>Tap to open camera</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Input Row: Gallery | Camera | Details ── */}
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.inputBtn} onPress={handleGallery}>
            <Ionicons name="cloud-upload-outline" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.cameraBtn} onPress={handleOpenCamera}>
            <Ionicons name="camera" size={28} color={COLORS.white} />
          </TouchableOpacity>

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
  cameraPreviewBox: {
    height: height * 0.35,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#111',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  cameraPermissionBox: {
    flex: 1,
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
    position: 'absolute', bottom: 50, left: 14,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderBottomWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH,
    borderColor: COLORS.primary, borderBottomLeftRadius: 6,
  },
  previewCornerBR: {
    position: 'absolute', bottom: 50, right: 14,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderBottomWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH,
    borderColor: COLORS.primary, borderBottomRightRadius: 6,
  },
  previewTapHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.md,
  },
  previewTapText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },

  imagePreviewWrapper: { borderRadius: RADIUS.lg, overflow: 'hidden', position: 'relative' },
  imagePreview: { width: '100%', height: height * 0.35, borderRadius: RADIUS.lg },
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

  // ── Full camera modal overlay (transparent — shows the viewfinder)
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
  },
  cameraClose: {
    alignSelf: 'flex-end', marginRight: SPACING.lg,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: RADIUS.full, padding: SPACING.sm,
  },
  scanFrame: { width: 260, height: 260, position: 'relative' },
  scanCorner: { position: 'absolute', width: 34, height: 34, borderColor: COLORS.primary },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  cameraHint: { color: COLORS.white, fontSize: 15, fontWeight: '500' },
  captureBtn: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: COLORS.white,
  },
  captureInner: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.white,
  },

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
