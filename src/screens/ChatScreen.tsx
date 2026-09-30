import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Platform, ActivityIndicator,
  ScrollView, KeyboardAvoidingView, Keyboard, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { collection, query, orderBy, limit, where, onSnapshot, getDocs, addDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db, auth } from '../services/firebase';
import { MODEL, imageToBase64 } from '../services/openrouter';
import { getTodayWaterCount } from '../services/waterLogger';
import { COLORS, SPACING, RADIUS, TAB_BAR_HEIGHT } from '../constants/theme';

const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
const CHAT_RETENTION_MS = 24 * 60 * 60 * 1000;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  imageUri?: string;
}

const QUICK_PROMPTS = [
  '🥗 How much protein daily?',
  '🔥 Foods for weight loss?',
  '⚖️ Is my diet balanced?',
  '🍎 Healthy snack ideas?',
];

// Strips leaked chain-of-thought (reasoning models sometimes emit a <think>
// block even with reasoning excluded) and markdown emphasis — asterisks and
// raw reasoning traces read as broken output in a plain chat bubble.
function cleanReply(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^\s*[*-]\s+/gm, '• ')
    .replace(/\*/g, '')
    .trim();
}

function summarizeMeals(meals: any[]): string {
  if (meals.length === 0) return 'Nothing logged.';
  return meals
    .map(m => `${m.food_name} (${m.calories ?? '?'} kcal, ${m.protein ?? '?'}g protein, ${m.carbs ?? '?'}g carbs, ${m.fat ?? '?'}g fat)${m.meal_type ? ` — ${m.meal_type}` : ''}`)
    .join('; ');
}

async function buildUserContext(uid: string): Promise<string> {
  const [profileSnap, mealsSnap, waterCount] = await Promise.all([
    getDoc(doc(db, 'users', uid, 'profile', 'settings')),
    getDocs(query(collection(db, 'users', uid, 'meal_logs'), orderBy('logged_at', 'desc'), limit(40))),
    getTodayWaterCount().catch(() => 0),
  ]);

  const profile = profileSnap.exists() ? profileSnap.data() : {};
  const meals = mealsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  const now = new Date();
  const todayKey = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = yesterday.toDateString();

  const mealDateKey = (m: any) => {
    if (!m.logged_at) return null;
    const d = m.logged_at.toDate ? m.logged_at.toDate() : new Date(m.logged_at);
    return d.toDateString();
  };

  const todayMeals = meals.filter(m => mealDateKey(m) === todayKey);
  const yesterdayMeals = meals.filter(m => mealDateKey(m) === yesterdayKey);

  const goalLine = profile.dietGoal
    ? `Diet goal: ${profile.dietGoal}. Daily targets: ${profile.calorieTarget || '?'} kcal, ${profile.proteinTarget || '?'}g protein, ${profile.carbTarget || '?'}g carbs, ${profile.fatTarget || '?'}g fat.`
    : 'No diet goal set yet.';

  return `USER CONTEXT (use this to personalize answers, spot allergy risks, and avoid repeating what they already know):
${goalLine}
Water intake today: ${waterCount} glasses (~${waterCount * 250}ml, target 8 glasses).
Eaten today: ${summarizeMeals(todayMeals)}
Eaten yesterday: ${summarizeMeals(yesterdayMeals)}`;
}

async function askNutriLensAI(
  messages: { role: string; content: string }[],
  userContext: string,
  imageBase64?: string
): Promise<string> {
  // Only the current turn's image matters — prior turns stay plain text.
  const apiMessages = imageBase64
    ? [
        ...messages.slice(0, -1),
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            { type: 'text', text: messages[messages.length - 1]?.content || 'What can you tell me about this food?' },
          ],
        },
      ]
    : messages;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://nutrilens.app',
      'X-Title': 'NutriLens',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `You are NutriLens AI, a friendly and knowledgeable nutrition assistant.
You help users make healthier food choices, understand nutrition, and achieve their diet goals.
Keep responses concise, practical, and encouraging. Use emojis sparingly.
Always provide actionable advice. Never diagnose medical conditions.
Write in plain conversational text only — never use markdown formatting like asterisks, bold, or italics.
Respond directly with your answer only — never narrate your reasoning, never explain your interpretation of the request, never write things like "the user is asking" or "we should respond as".

${userContext}`,
        },
        ...apiMessages,
      ],
      max_tokens: 700,
      reasoning: { effort: 'low', exclude: true },
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  const raw = data.choices?.[0]?.message?.content?.trim() || 'Sorry, I could not process that. Please try again.';
  return cleanReply(raw);
}

function AppLogo({ size = 34 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      <Image source={require('../../assets/icon.png')} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
      {!isUser && <AppLogo size={34} />}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
        {message.imageUri && (
          <Image source={{ uri: message.imageUri }} style={styles.bubbleImage} />
        )}
        {!!message.content && (
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {message.content}
          </Text>
        )}
        <Text style={[styles.bubbleTime, isUser && styles.bubbleTimeUser]}>
          {message.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

const GREETING_ID = 'greeting';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const greeting: Message = {
    id: GREETING_ID,
    role: 'assistant',
    content: `Hi ${user?.email?.split('@')[0] || 'there'}! 👋 I'm your NutriLens AI assistant. Ask me anything about food, nutrition, or your diet goals.`,
    timestamp: new Date(),
  };
  const [history, setHistory] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const handlePickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!res.canceled) {
      setAttachedImage(res.assets[0].uri);
    }
  };

  const messages = [greeting, ...history];

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const cutoff = Date.now() - CHAT_RETENTION_MS;

    // Actively delete anything past the 24h retention window — messages
    // shouldn't just linger in Firestore forever for a given user.
    getDocs(query(collection(db, 'users', currentUser.uid, 'chat_messages'), where('createdAt', '<', cutoff)))
      .then(snap => Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'users', currentUser.uid, 'chat_messages', d.id)))))
      .catch(() => {});

    const q = query(
      collection(db, 'users', currentUser.uid, 'chat_messages'),
      where('createdAt', '>=', cutoff),
      orderBy('createdAt', 'asc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded: Message[] = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          role: data.role,
          content: data.content,
          timestamp: data.createdAt ? new Date(data.createdAt) : new Date(),
        };
      });
      setHistory(loaded);
    });
    return unsubscribe;
  }, []);

  const persistMessage = (message: Message) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    addDoc(collection(db, 'users', currentUser.uid, 'chat_messages'), {
      role: message.role,
      content: message.content,
      createdAt: message.timestamp.getTime(),
    }).catch(() => {});
  };

  const handleSend = async (text?: string) => {
    const imageUri = attachedImage;
    const messageText = text || input.trim() || (imageUri ? 'What can you tell me about this food?' : '');
    if ((!messageText && !imageUri) || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      imageUri: imageUri || undefined,
    };

    setHistory(prev => [...prev, userMessage]);
    persistMessage(userMessage);
    setInput('');
    setAttachedImage(null);
    setLoading(true);

    try {
      const chatHistory = [...history, userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }));
      const currentUser = auth.currentUser;
      const userContext = currentUser ? await buildUserContext(currentUser.uid).catch(() => '') : '';
      const imageBase64 = imageUri ? await imageToBase64(imageUri) : undefined;
      const reply = await askNutriLensAI(chatHistory, userContext, imageBase64);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      };
      setHistory(prev => [...prev, aiMessage]);
      persistMessage(aiMessage);
    } catch {
      setHistory(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I had trouble connecting. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [history]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <AppLogo size={42} />
          <View>
            <Text style={styles.headerTitle}>NutriLens AI</Text>
            <View style={styles.headerStatusRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.headerSubtitle}>Your nutrition assistant</Text>
            </View>
          </View>
        </View>
        <View style={[styles.aiBadge]}>
          <Ionicons name="sparkles" size={12} color={COLORS.primary} />
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          loading ? (
            <View style={styles.typingIndicator}>
              <AppLogo size={34} />
              <View style={styles.typingBubble}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.typingText}>Thinking...</Text>
              </View>
            </View>
          ) : null
        }
      />

      {/* Quick Prompts */}
      {messages.length <= 1 && (
        <View style={styles.quickPrompts}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {QUICK_PROMPTS.map((prompt, i) => (
              <TouchableOpacity
                key={i}
                style={styles.quickPromptBtn}
                onPress={() => handleSend(prompt.slice(2))}
                activeOpacity={0.8}
              >
                <Text style={styles.quickPromptText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Input Bar */}
      <View style={[styles.inputBar, { paddingBottom: keyboardVisible ? SPACING.sm : TAB_BAR_HEIGHT }]}>
        {attachedImage && (
          <View style={styles.attachedPreviewRow}>
            <Image source={{ uri: attachedImage }} style={styles.attachedThumb} />
            <TouchableOpacity style={styles.attachedRemoveBtn} onPress={() => setAttachedImage(null)}>
              <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          <View style={styles.inputWrapper}>
            <TouchableOpacity onPress={handlePickImage}>
              <Ionicons name="image-outline" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask about any food..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
              maxLength={500}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() && !attachedImage || loading) && styles.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={(!input.trim() && !attachedImage) || loading}
            activeOpacity={0.85}
          >
            <Ionicons name="send" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  headerSubtitle: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  aiBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Messages
  messagesList: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: SPACING.sm + 2,
    gap: SPACING.sm,
  },
  messageRowUser: { flexDirection: 'row-reverse' },
  bubble: {
    maxWidth: '75%',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    gap: 4,
  },
  bubbleAI: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  bubbleUser: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  bubbleImage: { width: 180, height: 180, borderRadius: RADIUS.md, marginBottom: 4 },
  bubbleText: { fontSize: 14, color: COLORS.text, lineHeight: 21 },
  bubbleTextUser: { color: COLORS.white },
  bubbleTime: { fontSize: 10, color: COLORS.textSecondary, alignSelf: 'flex-end' },
  bubbleTimeUser: { color: 'rgba(255,255,255,0.65)' },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  typingBubble: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    elevation: 1,
  },
  typingText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },

  // Quick prompts
  quickPrompts: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  quickPromptBtn: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    elevation: 1,
  },
  quickPromptText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },

  // Input bar
  inputBar: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
  },
  attachedPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  attachedThumb: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
  },
  attachedRemoveBtn: {
    padding: 2,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    maxHeight: 100,
    fontWeight: '500',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    marginBottom: 2,
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.border,
    elevation: 0,
    shadowOpacity: 0,
  },
});
