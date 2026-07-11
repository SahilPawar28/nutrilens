import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

interface Props {
  label: string;
  value: number;
  unit: string;
  target: number;
  color: string;
  bgColor: string;
}

export default function MacroCard({ label, value, unit, target, color, bgColor }: Props) {
  const progress = Math.min((value / (target || 1)) * 100, 100);

  return (
    <View style={[styles.card, { backgroundColor: bgColor, borderTopColor: color }]}>
      <Text style={[styles.label, { color }]}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }]}>{value}</Text>
        <Text style={[styles.unit, { color }]}>{unit}</Text>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.bar, { width: `${progress}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={styles.target}>{target}{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm + 2,
    borderTopWidth: 3,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginBottom: 6,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
  },
  unit: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
  },
  barBg: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    marginBottom: 4,
  },
  bar: {
    height: 4,
    borderRadius: RADIUS.full,
  },
  target: {
    fontSize: 10,
    color: '#999',
    fontWeight: '500',
  },
});
