import React from "react";
import { Image, View } from "react-native";
import { Box, Coffee, CupSoda, Package, Recycle, Wine } from "lucide-react-native";
import { colors } from "../theme";

const MATERIAL_META: Record<string, { icon: React.ElementType; bg: string; fg: string }> = {
  plastik_pet: { icon: CupSoda, bg: "#E0F2FE", fg: "#0284C7" },
  plastik_hdpe: { icon: Recycle, bg: "#CCFBF1", fg: "#0D9488" },
  kardus: { icon: Box, bg: "#FEF3C7", fg: "#B45309" },
  kaleng: { icon: Coffee, bg: "#F1F5F9", fg: "#64748B" },
  kaca: { icon: Wine, bg: "#DCFCE7", fg: "#16A34A" },
  sachet: { icon: Package, bg: "#FFEDD5", fg: "#EA580C" },
};

export interface MaterialThumbnailProps {
  readonly product: { thumbnailUri: string; material: string; name: string };
  readonly style?: object;
  readonly iconSize?: number;
}

export function MaterialThumbnail({ product, style, iconSize = 28 }: MaterialThumbnailProps): React.JSX.Element {
  const meta = MATERIAL_META[product.material] ?? MATERIAL_META.plastik_pet;
  const [failed, setFailed] = React.useState(false);
  if (product.thumbnailUri && !failed) {
    return (
      <Image source={{ uri: product.thumbnailUri }} accessibilityLabel={product.name}
        style={style} resizeMode="cover" onError={() => setFailed(true)} />
    );
  }
  const Icon = meta.icon;
  return (
    <View style={[{ backgroundColor: meta.bg, alignItems: "center", justifyContent: "center" }, style]}>
      <View style={{ width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.85)" }}>
        <Icon size={iconSize} color={meta.fg} />
      </View>
    </View>
  );
}
