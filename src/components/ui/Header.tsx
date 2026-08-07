import React from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { colors, gradients, gradientStyle, shadows } from "../../theme";

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  transparent?: boolean;
  contentColor?: string;
  subtitleColor?: string;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightElement,
  transparent = false,
  contentColor,
  subtitleColor,
  className = "",
}) => {
  const insets = useSafeAreaInsets();
  const resolvedContentColor = contentColor ?? (transparent ? colors.ink900 : colors.white);
  const resolvedSubtitleColor = subtitleColor ?? (transparent ? colors.ink600 : colors.sage200);

  return (
    <View
      className={`flex-row items-center justify-between ${transparent ? "bg-transparent" : ""} ${className}`}
      style={[
        {
          paddingHorizontal: 18,
          paddingTop: Math.max(insets.top, 14),
          paddingBottom: 16,
          zIndex: 10,
        },
        transparent
          ? undefined
          : {
              ...gradientStyle(gradients.navigation),
              borderBottomLeftRadius: 30,
              borderBottomRightRadius: 30,
              borderCurve: "continuous",
              boxShadow: shadows.navigation,
            },
      ]}
    >
      <View className="w-[72px] flex-row items-center">
        {onBack && (
          <Pressable
            onPress={onBack}
            className="w-10 h-10 -ml-2 rounded-full items-center justify-center"
            style={({ pressed }) => ({
              backgroundColor: pressed ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
              transform: [{ scale: pressed ? 0.96 : 1 }],
            })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={22} color={resolvedContentColor} />
          </Pressable>
        )}
      </View>
      <View className="flex-1 items-center px-2">
        {title && (
          <Text
            className="text-[17px] font-extrabold text-center"
            style={{ color: resolvedContentColor, letterSpacing: -0.45 }}
            numberOfLines={1}
          >
            {title}
          </Text>
        )}
        {subtitle && (
          <Text
            className="text-[11px] mt-0.5 text-center"
            style={{ color: resolvedSubtitleColor }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
      <View className="w-[72px] items-end">{rightElement}</View>
    </View>
  );
};
