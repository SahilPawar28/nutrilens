import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View, Text, Image, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ScanScreen from '../screens/ScanScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ChatScreen from '../screens/ChatScreen';
import { COLORS, SPACING, RADIUS, WEB_BREAKPOINT, SIDEBAR_WIDTH } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const ROUTE_ICONS: Record<string, (focused: boolean) => any> = {
  Home: (f) => (f ? 'home' : 'home-outline'),
  History: (f) => (f ? 'time' : 'time-outline'),
  Scan: () => 'scan',
  Chat: (f) => (f ? 'chatbubble' : 'chatbubble-outline'),
  Analytics: (f) => (f ? 'bar-chart' : 'bar-chart-outline'),
  Profile: (f) => (f ? 'person' : 'person-outline'),
};

function ScanButton({ onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.scanBtnContainer}>
      <View style={styles.scanButton}>
        <Ionicons name="scan" size={26} color={COLORS.white} />
      </View>
    </TouchableOpacity>
  );
}

// One custom tab bar that renders as the usual bottom bar on mobile, and as
// a left sidebar on wide desktop browsers — same navigation state driving
// both, just a different shape.
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= WEB_BREAKPOINT;

  const items = state.routes.map((route, index) => {
    const isFocused = state.index === index;
    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
    };
    const iconName = ROUTE_ICONS[route.name]?.(isFocused) ?? 'ellipse-outline';
    return { route, isFocused, onPress, iconName };
  });

  if (isDesktop) {
    return (
      <View style={[styles.sidebar, { paddingTop: insets.top + SPACING.lg }]}>
        <View style={styles.sidebarBrand}>
          <Image source={require('../../assets/icon.png')} style={styles.sidebarLogo} />
          <Text style={styles.sidebarBrandText}>NutriLens</Text>
        </View>
        <View style={styles.sidebarItems}>
          {items.map(({ route, isFocused, onPress, iconName }) => (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.8}
              style={[styles.sidebarItem, isFocused && styles.sidebarItemActive]}
            >
              <Ionicons name={iconName} size={20} color={isFocused ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[styles.sidebarItemText, isFocused && styles.sidebarItemTextActive]}>
                {route.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bottomBar, { height: 56 + insets.bottom, paddingBottom: insets.bottom + 4 }]}>
      {items.map(({ route, isFocused, onPress, iconName }) => {
        if (route.name === 'Scan') {
          return <ScanButton key={route.key} onPress={onPress} />;
        }
        return (
          <TouchableOpacity key={route.key} onPress={onPress} activeOpacity={0.7} style={styles.bottomBarItem}>
            <Ionicons name={iconName} size={22} color={isFocused ? COLORS.primary : COLORS.textSecondary} />
            <Text style={[styles.bottomBarLabel, { color: isFocused ? COLORS.primary : COLORS.textSecondary }]}>
              {route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MainTabs() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= WEB_BREAKPOINT;

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: isDesktop ? { marginLeft: SIDEBAR_WIDTH } : undefined,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Scan" component={ScanScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  // ── Mobile bottom bar ──
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopColor: COLORS.border,
    borderTopWidth: 0.5,
    paddingTop: 6,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  bottomBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  scanBtnContainer: {
    flex: 1,
    width: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  scanButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },

  // ── Desktop sidebar ──
  sidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: COLORS.white,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingHorizontal: SPACING.md,
  },
  sidebarBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.sm,
  },
  sidebarLogo: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  sidebarBrandText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  sidebarItems: {
    gap: 2,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
  },
  sidebarItemActive: {
    backgroundColor: COLORS.primaryLight,
  },
  sidebarItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  sidebarItemTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
