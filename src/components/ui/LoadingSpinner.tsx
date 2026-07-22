import React from "react";
import { View, Text, ActivityIndicator } from "react-native";

export interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
  size?: "small" | "large";
  color?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = "Memproses...",
  fullScreen = false,
  size = "large",
  color = "#16a34a",
}) => {
  const content = (
    <View className="items-center justify-center p-6">
      <ActivityIndicator size={size} color={color} />
      {message ? (
        <Text className="text-slate-600 font-medium text-sm mt-3 text-center">
          {message}
        </Text>
      ) : null}
    </View>
  );

  if (fullScreen) {
    return (
      <View className="flex-1 items-center justify-center bg-white/90 px-4">
        {content}
      </View>
    );
  }

  return content;
};
