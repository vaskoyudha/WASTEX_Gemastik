import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { ChevronLeft } from "lucide-react-native";

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
  return (
    <View
      className={`flex-row items-center justify-between px-4 pt-12 pb-3.5 ${
        transparent ? "bg-transparent" : "bg-white border-b border-slate-100"
      } ${className}`}
    >
      <View className="w-16 flex-row items-center">
        {onBack && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onBack}
            className="w-10 h-10 -ml-2 rounded-full items-center justify-center active:bg-slate-100"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={24} color="#1e293b" />
          </TouchableOpacity>
        )}
      </View>
      <View className="flex-1 items-center px-2">
        {title && (
          <Text className="text-[17px] font-bold text-slate-900 text-center" numberOfLines={1}>
            {title}
          </Text>
        )}
        {subtitle && (
          <Text className="text-[11px] text-slate-500 mt-0.5 text-center" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <View className="w-16 items-end">{rightElement}</View>
    </View>
  );
};
