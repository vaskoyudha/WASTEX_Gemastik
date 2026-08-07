import React from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
  View,
} from "react-native";

export interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: "primary" | "secondary" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
  textClassName?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  fullWidth = true,
  className = "",
  textClassName = "",
  ...props
}) => {
  // Base Container Styles
  const variantStyles = {
    primary: "bg-forest-900 border-transparent",
    secondary: "bg-white border-sage-200",
    outline: "bg-transparent border-sage-300",
    danger: "bg-risk-bahaya active:bg-red-700 border-transparent",
  };

  const textVariantStyles = {
    primary: "text-white font-semibold",
    secondary: "text-forest-900 font-bold",
    outline: "text-forest-800 font-semibold",
    danger: "text-white font-semibold",
  };

  const sizeStyles = {
    sm: "py-2.5 px-4 rounded-xl",
    md: "py-4 px-5 rounded-2xl",
    lg: "py-[18px] px-6 rounded-2xl",
  };

  const textSizeStyles = {
    sm: "text-xs",
    md: "text-base",
    lg: "text-lg",
  };

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`flex-row items-center justify-center border ${
        variantStyles[variant]
      } ${sizeStyles[size]} ${fullWidth ? "w-full" : "self-start"} ${
        isDisabled ? "opacity-50" : ""
      } ${className}`}
      style={({ pressed }) => ({
        borderCurve: "continuous",
        boxShadow: variant === "primary" && !isDisabled ? "0 8px 20px rgba(29,51,38,0.22)" : undefined,
        transform: [{ scale: pressed && !isDisabled ? 0.985 : 1 }],
      })}
      {...props as any}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" || variant === "danger" ? "#ffffff" : "#15803d"}
        />
      ) : (
        <View className="flex-row items-center justify-center space-x-2">
          {icon && <View className="mr-2">{icon}</View>}
          <Text
            className={`${textVariantStyles[variant]} ${textSizeStyles[size]} ${textClassName}`}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
};
