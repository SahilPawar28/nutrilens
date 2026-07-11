import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS } from '../constants/theme';

interface Props {
  size?: number;
  strokeWidth?: number;
  progress: number;
  remaining: number;
}

export default function ProgressRing({ size = 160, strokeWidth = 14, progress, remaining }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(progress, 0), 1));
  const center = size / 2;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={center} cy={center} r={radius}
          stroke={COLORS.primaryLight} strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center} cy={center} r={radius}
          stroke={COLORS.primary} strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${center},${center}`}
        />
      </Svg>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 36, fontWeight: 'bold', color: COLORS.text, fontVariant: ['tabular-nums'] }}>
          {remaining}
        </Text>
        <Text style={{ fontSize: 10, color: COLORS.textSecondary, letterSpacing: 1.5, fontWeight: '600' }}>
          CAL LEFT
        </Text>
      </View>
    </View>
  );
}
