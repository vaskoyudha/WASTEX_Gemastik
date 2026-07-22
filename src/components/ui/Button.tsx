import React from "react";
import {
  TouchableOpacity,
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
    primary: "bg-brand active:bg-brand-dark border-transparent",
    secondary: "bg-white active:bg-emerald-50 border-slate-200",
    outline: "bg-transparent border-slate-300 active:bg-slate-100",
    danger: "bg-risk-bahaya active:bg-red-700 border-transparent",
  };

  const textVariantStyles = {
    primary: "text-white font-semibold",
    secondary: "text-brand-dark font-semibold",
    outline: "text-slate-700 font-medium",
    danger: "text-white font-semibold",
  };

  const sizeStyles = {
    sm: "py-2 px-3 rounded-xl",
    md: "py-3.5 px-5 rounded-2xl",
    lg: "py-4 px-6 rounded-2xl",
  };

  const textSizeStyles = {
    sm: "text-xs",
    md: "text-base",
    lg: "text-lg",
  };

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={isDisabled}
      className={`flex-row items-center justify-center border ${
        variantStyles[variant]
      } ${sizeStyles[size]} ${fullWidth ? "w-full" : "self-start"} ${
        isDisabled ? "opacity-50" : ""
      } ${className}`}
      {...props}
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
    </TouchableOpacity>
  );
};
