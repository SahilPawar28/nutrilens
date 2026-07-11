import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getFoodGradient } from '../utils/foodIcons';
import { RADIUS } from '../constants/theme';

interface Props {
  foodName: string;
  emoji?: string;
  size?: number;
  borderRadius?: number;
  fontSize?: number;
}

export default function FoodIconBox({
  foodName,
  emoji = '🍽️',
  size = 52,
  borderRadius,
  fontSize,
}: Props) {
  const gradient = getFoodGradient(foodName);
  const br = borderRadius ?? RADIUS.md;
  const fs = fontSize ?? size * 0.5;

  return (
    <LinearGradient
      colors={gradient}
      style={[styles.box, { width: size, height: size, borderRadius: br }]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Text style={[styles.emoji, { fontSize: fs }]}>{emoji}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  box: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  emoji: {
    textAlign: 'center',
  },
});
