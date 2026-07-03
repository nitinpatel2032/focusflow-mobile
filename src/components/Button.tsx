import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../constants/colors';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'quiet' | 'danger' | 'danger-quiet';
};

export function Button({ title, onPress, disabled, icon, variant = 'primary' }: Props) {
  const getIconColor = () => {
    if (variant === 'quiet') return colors.primary;
    if (variant === 'danger-quiet') return colors.danger;
    return colors.background;
  };

  const getTextColorStyle = () => {
    if (variant === 'quiet') return styles.quietText;
    if (variant === 'danger-quiet') return styles.dangerQuietText;
    return undefined;
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !disabled ? styles.pressed : undefined,
        disabled ? styles.disabled : undefined
      ]}
    >
      {icon ? <Ionicons name={icon} size={20} color={getIconColor()} /> : null}
      <Text style={[styles.text, getTextColorStyle()]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18
  },
  primary: {
    backgroundColor: colors.primary
  },
  quiet: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  danger: {
    backgroundColor: colors.danger
  },
  'danger-quiet': {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  pressed: {
    opacity: 0.85
  },
  disabled: {
    opacity: 0.45
  },
  text: {
    color: colors.background,
    fontWeight: '800',
    fontSize: 16
  },
  quietText: {
    color: colors.primary
  },
  dangerQuietText: {
    color: colors.danger
  }
});
