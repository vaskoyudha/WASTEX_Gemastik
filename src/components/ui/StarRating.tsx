import React from "react";
import { TouchableOpacity, View } from "react-native";
import { Star } from "lucide-react-native";

export interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readOnly?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  size = 28,
  readOnly = false,
}) => {
  return (
    <View className="flex-row">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const star = (
          <Star size={size} color={filled ? "#f59e0b" : "#cbd5e1"} fill={filled ? "#f59e0b" : "none"} />
        );
        return readOnly ? (
          <View key={n} className="mr-1">{star}</View>
        ) : (
          <TouchableOpacity key={n} onPress={() => onChange?.(n)} className="mr-1">
            {star}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
