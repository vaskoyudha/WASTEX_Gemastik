import React from "react";
import { View, Text } from "react-native";
import { RiskLevel, Difficulty } from "../../services/types";

export interface BadgeProps {
  label?: string;
  variant?: RiskLevel | Difficulty | "neutral" | "brand";
  size?: "sm" | "md";
  icon?: React.ReactNode;
  className?: string;
  textClassName?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = "neutral",
  size = "md",
  icon,
  className = "",
  textClassName = "",
}) => {
  // Styles according to risk or difficulty variant
  const variantStyles = {
    aman: "bg-emerald-100 border-emerald-300 text-emerald-800",
    hati_hati: "bg-amber-100 border-amber-300 text-amber-800",
    berisiko: "bg-red-100 border-red-300 text-red-800",
    mudah: "bg-emerald-50 border-emerald-200 text-emerald-700",
    sedang: "bg-amber-50 border-amber-200 text-amber-700",
    sulit: "bg-slate-100 border-slate-300 text-slate-800",
    neutral: "bg-slate-100 border-slate-200 text-slate-700",
    brand: "bg-brand-light border-emerald-300 text-brand-dark",
  };

  const textStyles = {
    aman: "text-emerald-800 font-semibold",
    hati_hati: "text-amber-800 font-semibold",
    berisiko: "text-red-800 font-semibold",
    mudah: "text-emerald-700 font-medium",
    sedang: "text-amber-700 font-medium",
    sulit: "text-slate-800 font-semibold",
    neutral: "text-slate-700 font-medium",
    brand: "text-brand-dark font-semibold",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 rounded-full text-xs",
    md: "px-3 py-1 rounded-full text-sm",
  };

  const displayLabel =
    label ||
    (variant === "aman"
      ? "Aman"
      : variant === "hati_hati"
      ? "Hati-hati"
      : variant === "berisiko"
      ? "Berisiko"
      : variant === "mudah"
      ? "Mudah"
      : variant === "sedang"
      ? "Sedang"
      : variant === "sulit"
      ? "Sulit"
      : "");

  return (
    <View
      className={`flex-row items-center self-start border ${
        variantStyles[variant] || variantStyles.neutral
      } ${sizeStyles[size]} ${className}`}
    >
      {icon && <View className="mr-1">{icon}</View>}
      <Text
        className={`text-center ${
          textStyles[variant] || textStyles.neutral
        } ${textClassName}`}
      >
        {displayLabel}
      </Text>
    </View>
  );
};
