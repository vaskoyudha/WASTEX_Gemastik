import React, { useEffect, useState } from "react";
import { Image, ImageProps, View } from "react-native";

interface FitImageProps extends Omit<ImageProps, "source" | "onLoad"> {
  source: { uri?: string | null } | null;
  /** Maksimum tinggi dalam px (atau string Tailwind seperti "h-96") agar gambar
      tidak memakan layar untuk foto landscape yang sangat lebar. */
  maxHeight?: number;
  className?: string;
}

/** Gambar yang mengikuti rasio aspek intrinsiknya (fit, tidak terpotong).
    Selama dimensi belum diketahui, render placeholder dengan tinggi default. */
export const FitImage: React.FC<FitImageProps> = ({
  source,
  maxHeight,
  className = "",
  style,
  ...props
}) => {
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    setRatio(null);
    if (!source?.uri) return;
    Image.getSize(
      source.uri,
      (w, h) => setRatio(w / h),
      () => setRatio(null),
    );
  }, [source?.uri]);

  const base = ratio ? { width: "100%" as const, aspectRatio: ratio } : null;
  const cap = ratio && maxHeight ? { maxHeight } : null;

  return (
    <View className={className}>
      <Image
        source={source?.uri ? { uri: source.uri } : undefined}
        resizeMode="contain"
        onLoadEnd={() => {
          if (!ratio && source?.uri) {
            Image.getSize(
              source.uri,
              (w, h) => setRatio(w / h),
              () => {},
            );
          }
        }}
        style={[base, cap, style]}
        {...props}
      />
    </View>
  );
};

export default FitImage;
