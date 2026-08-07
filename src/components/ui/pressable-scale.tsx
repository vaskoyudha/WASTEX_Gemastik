import React from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

type PressableScaleProps = PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
};

export function PressableScale({
  children,
  style,
  pressedScale = 0.97,
  disabled,
  ...props
}: PressableScaleProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        style,
        {
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? pressedScale : 1 }],
        },
      ]}
      {...props}
    >
      {children}
    </Pressable>
  );
}
