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
  style,
  ...props
}) => {
  const paddingStyles = {
    none: "p-0",
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  const variantStyles = {
    default: "bg-cream-50 border border-mist-100",
    outlined: "bg-cream-50 border border-sage-200",
    elevated: "bg-cream-50 border-0",
  };

  const containerClasses = `rounded-2xl ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`;

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        className={containerClasses}
        style={[{ borderCurve: "continuous", boxShadow: "0 4px 14px rgba(37,52,39,0.07)" }, style]}
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View
      className={containerClasses}
      style={[{ borderCurve: "continuous", boxShadow: "0 4px 14px rgba(37,52,39,0.07)" }, style]}
      {...props}
    >
      {children}
    </View>
  );
};
