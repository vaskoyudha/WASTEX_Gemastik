import React from "react";
import { View, Text } from "react-native";
import { Button } from "./Button";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  className = "",
}) => {
  return (
    <View className={`items-center justify-center py-12 px-6 ${className}`}>
      {icon && <View className="mb-4 p-4 rounded-full bg-slate-100">{icon}</View>}
      <Text className="text-lg font-bold text-slate-800 text-center mb-1">
        {title}
      </Text>
      {description && (
        <Text className="text-sm text-slate-500 text-center mb-6 max-w-xs leading-5">
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          size="md"
          fullWidth={false}
          className="px-6"
        />
      )}
    </View>
  );
};
