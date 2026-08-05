import React from "react";
import { View, Text, TextInput as RNTextInput, TextInputProps } from "react-native";
import { Card } from "./Card";

type InputVariant = "default" | "error" | "success";
type InputSize = "sm" | "md" | "lg";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  variant?: InputVariant;
  size?: InputSize;
}

export function Input({ label, error, variant = "default", size = "md", ...props }: InputProps) {
  const borderColor = error ? "#dc2626" : variant === "success" ? "#16a34a" : "#e2e8f0";
  
  return (
    <View className="mb-5">
      {label && <Text className="text-sm font-semibold text-slate-700 mb-2">{label}</Text>}
      <RNTextInput
        className={`bg-white border-2 rounded-xl px-4 py-3 ${size === "sm" ? "text-xs" : size === "lg" ? "text-lg" : "text-base"}`}
        style={{ borderColor }}
        {...props}
      />
      {error && <Text className="text-xs text-red-600 mt-1">{error}</Text>}
    </View>
  );
}
