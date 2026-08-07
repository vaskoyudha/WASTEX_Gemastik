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
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightElement,
  transparent = false,
  className = "",
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      className={`flex-row items-center justify-between ${transparent ? "bg-transparent" : ""} ${className}`}
      style={[
        {
          paddingHorizontal: 16,
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: 14,
          zIndex: 10,
        },
        transparent
          ? undefined
          : {
              ...gradientStyle(gradients.pageHero),
              borderBottomLeftRadius: 26,
              borderBottomRightRadius: 26,
              borderCurve: "continuous",
              boxShadow: shadows.navigation,
            },
      ]}
    >
      <View className="w-16 flex-row items-center">
        {onBack && (
          <Pressable
            onPress={onBack}
            className="w-10 h-10 -ml-2 rounded-full items-center justify-center"
            style={({ pressed }) => ({
              backgroundColor: pressed ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)",
              transform: [{ scale: pressed ? 0.96 : 1 }],
            })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={22} color={colors.cream50} />
          </Pressable>
        )}
      </View>
      <View className="flex-1 items-center px-2">
        {title && (
          <Text
            className="text-[17px] font-bold text-center"
            style={{ color: transparent ? colors.ink900 : colors.white, letterSpacing: -0.25 }}
            numberOfLines={1}
          >
            {title}
          </Text>
        )}
        {subtitle && (
          <Text
            className="text-[11px] mt-0.5 text-center"
            style={{ color: transparent ? colors.ink600 : colors.sage200 }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
      <View className="w-16 items-end">{rightElement}</View>
    </View>
  );
};
