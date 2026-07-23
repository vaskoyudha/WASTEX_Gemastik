import React from "react";
import { View, TouchableOpacity, TouchableOpacityProps } from "react-native";

export interface CardProps extends TouchableOpacityProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: "default" | "outlined" | "elevated";
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  variant = "default",
  padding = "md",
  className = "",
  ...props
}) => {
  const paddingStyles = {
    none: "p-0",
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  const variantStyles = {
    default: "bg-white border border-slate-100 shadow-sm",
    outlined: "bg-white border border-slate-200",
    elevated: "bg-white shadow-md border-0",
  };

  const containerClasses = `rounded-2xl ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`;

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        className={containerClasses}
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View className={containerClasses} {...props}>
      {children}
    </View>
  );
};
