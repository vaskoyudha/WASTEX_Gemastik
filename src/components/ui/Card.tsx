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

  const containerClasses = `rounded-[24px] ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`;

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.86}
        onPress={onPress}
        className={containerClasses}
        style={[{ borderCurve: "continuous", boxShadow: "0 2px 4px rgba(21,37,27,0.04), 0 12px 30px rgba(21,37,27,0.07)" }, style]}
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View
      className={containerClasses}
      style={[{ borderCurve: "continuous", boxShadow: "0 2px 4px rgba(21,37,27,0.04), 0 12px 30px rgba(21,37,27,0.07)" }, style]}
      {...props}
    >
      {children}
    </View>
  );
};
