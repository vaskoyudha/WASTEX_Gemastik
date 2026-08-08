import React, { useEffect, useState } from "react";
import { Alert, Share, View, Text, ScrollView, Image, TouchableOpacity, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Header, Button, Card, Badge, LoadingSpinner, StarRating } from "../../../src/components/ui";
import { useProductData } from "../../../src/hooks/useProductData";
import { favorites } from "../../../src/services/localState";
import { apiClient } from "../../../src/services/api";
import { MaterialThumbnail } from "../../../src/features/MaterialThumbnail";
import type { SkillCompletionsSummary } from "../../../src/services/types";
import { safeBack } from "../../../src/lib/navigation";
import {
  Heart,
  Share2,
  Clock,
  Package,
  Scissors,
  Paintbrush,
  Ruler,
  Sprout,
  Droplet,
  ArrowRight,
  TrendingUp,
  Wallet,
  Tag,
  Gauge,
} from "lucide-react-native";
import { colors, gradients, gradientStyle, shadows } from "../../../src/theme";

const toolIcons: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  botol: Package,
  plastik: Package,
  gunting: Scissors,
  cutter: Scissors,
  cat: Paintbrush,
  akrilik: Paintbrush,
  tali: Ruler,
  tanaman: Sprout,
  media: Sprout,
  air: Droplet,
  sabun: Droplet,
  default: Package,
};

function getToolIcon(name: string) {
  const key = Object.keys(toolIcons).find((k) => name.toLowerCase().includes(k));
  return toolIcons[key || "default"] || Package;
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { height: screenHeight } = useWindowDimensions();
  const { product, tutData, priceData, loading, error, refetch } = useProductData(id);

  const [completions, setCompletions] = useState<SkillCompletionsSummary | null>(null);
  useEffect(() => {
    if (!id) return;
    apiClient.getSkillCompletions(id).then(setCompletions).catch(() => setCompletions(null));
  }, [id]);

  if (loading) {
    return <LoadingSpinner fullScreen message="Memuat detail produk..." />;
  }

  if (error) {
    return (
      <View className="flex-1 bg-cream-50 items-center justify-center p-6">
        <Text className="text-slate-600 text-center mb-4">Detail produk gagal dimuat.</Text>
        <Button title="Coba Lagi" onPress={() => refetch()} />
      </View>
    );
  }

  if (!product) {
    return (
      <View className="flex-1 bg-cream-50 items-center justify-center p-6">
        <Text className="text-slate-600 mb-4">Produk tidak ditemukan.</Text>
        <Button title="Kembali ke Beranda" onPress={() => router.replace("/")} />
      </View>
    );
  }

  const headerRight = (
    <View className="flex-row items-center gap-2">
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={async () => {
          const saved = await favorites.toggle(product);
          Alert.alert(
            saved ? "Favorit" : "Favorit Dihapus",
            saved ? `${product.name} ditambahkan ke favorit.` : `${product.name} dihapus dari favorit.`
          );
        }}
        className="p-2"
      >
        <Heart size={20} color={colors.white} />
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => Share.share({ message: `Lihat ide upcycling WASTEX: ${product.name}` })}
        className="p-2"
      >
        <Share2 size={20} color={colors.white} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F8F2" }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, backgroundColor: "transparent" }}
        contentContainerStyle={{ minHeight: screenHeight }}
      >
        <Image
          source={require("../../../assets/images/upload-screen-bg.png")}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          style={{ position: "absolute", top: -128, left: 0, width: "100%", height: screenHeight }}
        />
        <Header
          title="Detail Produk"
          onBack={() => safeBack(router)}
          rightElement={headerRight}
          transparent
          contentColor={colors.white}
        />
        <View style={{ paddingHorizontal: 18, paddingTop: 32, paddingBottom: 46 }}>
        <Card className="rounded-[28px] overflow-hidden p-0 border-0 mb-6" style={{ boxShadow: shadows.floating }}>
          <MaterialThumbnail product={product} style={{ width: "100%", height: 296 }} />
        </Card>

        <Text className="text-[28px] leading-[34px] font-extrabold mb-2" style={{ color: colors.ink900, letterSpacing: -1.05 }}>{product.name}</Text>

        <View className="flex-row items-center mb-3">
          {completions && completions.count > 0 ? (
            <>
              <StarRating value={Math.round(completions.avg_rating)} size={16} readOnly />
              <Text className="text-sm font-extrabold ml-2" style={{ color: colors.ink900 }}>{completions.avg_rating}</Text>
              <Text className="text-xs ml-1" style={{ color: colors.ink600 }}>({completions.count} ulasan)</Text>
            </>
          ) : (
            <Text className="text-xs text-slate-400">Belum ada review</Text>
          )}
        </View>

        <View className="flex-row items-center gap-3 mb-5">
          <Badge variant={product.difficulty} size="sm" />
          <View className="flex-row items-center">
            <Clock size={14} color={colors.ink400} />
            <Text className="text-xs ml-1" style={{ color: colors.ink600 }}>{product.estimatedTimeMinutes} menit</Text>
          </View>
        </View>

        <Text className="text-sm leading-[22px] mb-7" style={{ color: colors.ink700 }}>{product.shortDescription}</Text>

        <Text className="text-[17px] font-extrabold mb-3" style={{ color: colors.ink900, fontFamily: "serif", letterSpacing: -0.4 }}>Nilai proyek</Text>
        <View className="flex-row flex-wrap mb-7" style={{ gap: 10 }}>
          {[
            {
              label: "Estim Biaya",
              value: priceData
                ? `Rp ${priceData.totalCost.toLocaleString("id-ID")}`
                : `Rp ${product.estimatedCost.toLocaleString("id-ID")}`,
              icon: Wallet,
            },
            {
              label: "Est. Harga Jual",
              value: priceData ? `Rp ${priceData.suggestedSellPrice.toLocaleString("id-ID")}` : "-",
              icon: Tag,
            },
            {
              label: "Est. Keuntungan",
              value: priceData ? `Rp ${priceData.estimatedProfit.toLocaleString("id-ID")}` : "-",
              icon: TrendingUp,
            },
            {
              label: "Level Kesulitan",
              value:
                product.difficulty === "mudah" ? "Mudah" : product.difficulty === "sedang" ? "Sedang" : "Sulit",
              icon: Gauge,
            },
          ].map((row, idx) => {
            const MetricIcon = row.icon;

            return (
              <View
                key={idx}
                style={{
                  width: "48.5%",
                  minHeight: 92,
                  gap: 14,
                  padding: 14,
                  borderRadius: 20,
                  borderCurve: "continuous",
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.mist100,
                  boxShadow: "0 8px 24px rgba(31,63,42,0.09)",
                }}
              >
                <Text style={{ color: colors.ink600, fontFamily: "Manrope_500Medium", fontSize: 10.5 }}>
                  {row.label}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      flexShrink: 0,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 12,
                      borderCurve: "continuous",
                      backgroundColor: colors.mist100,
                    }}
                  >
                    <MetricIcon size={16} color={colors.forest700} strokeWidth={2} />
                  </View>
                  <Text
                    selectable
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.78}
                    style={{
                      flex: 1,
                      color: colors.ink900,
                      fontFamily: "Manrope_800ExtraBold",
                      fontSize: 17,
                      fontVariant: ["tabular-nums"],
                      letterSpacing: -0.45,
                    }}
                  >
                    {row.value}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <View className="mb-7">
          <Text className="text-[17px] font-extrabold mb-3" style={{ color: colors.ink900, fontFamily: "serif", letterSpacing: -0.4 }}>Alat & bahan</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 18 }}>
            {tutData?.toolsAndMaterials.map((tool, idx) => {
              const Icon = getToolIcon(tool);
              return (
                <View
                  key={idx}
                  className="rounded-[20px] p-3 items-center mr-3 w-[104px]"
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.mist100 }}
                >
                  <View className="w-11 h-11 rounded-[16px] items-center justify-center mb-2" style={{ backgroundColor: colors.mist100 }}>
                    <Icon size={20} color={colors.forest700} />
                  </View>
                  <Text className="text-[10px] text-center leading-4 font-semibold" style={{ color: colors.ink700 }} numberOfLines={2}>
                    {tool}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {tutData?.additionalMaterials && tutData.additionalMaterials.length > 0 && (
          <View className="mb-6">
            <Text className="text-sm font-bold text-slate-900 mb-3" style={{ fontFamily: "serif" }}>Bahan Tambahan</Text>
            {tutData.additionalMaterials.map((m, idx) => (
              <View
                key={idx}
                className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-2"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold text-slate-900">{m.name}</Text>
                  <Text className="text-xs font-semibold text-amber-700">
                    Rp {m.est_cost_idr.toLocaleString('id-ID')}
                  </Text>
                </View>
                <Text className="text-[11px] text-slate-500 mt-1">{m.purpose}</Text>
              </View>
            ))}
          </View>
        )}

        {completions && completions.gallery.length > 0 && (
          <View className="mb-6">
            <Text className="text-sm font-bold text-slate-900 mb-3">Hasil Komunitas</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {completions.gallery.map((g, idx) => (
                <View key={idx} className="mr-3 w-28">
                  <Image source={{ uri: g.photo_url }} className="w-28 h-28 rounded-2xl bg-slate-200" />
                  <Text className="text-[10px] text-slate-500 mt-1" numberOfLines={1}>
                    {g.user_display_name || "Anonim"}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <TouchableOpacity
          onPress={() => router.push(`/product/${id}/tutorial`)}
          activeOpacity={0.84}
          accessibilityRole="button"
          accessibilityLabel="Mulai Tutorial"
          style={{
            minHeight: 58,
            borderRadius: 18,
            borderCurve: "continuous",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            backgroundColor: "#2B7748",
            ...gradientStyle(gradients.uploadAnalyze),
            borderWidth: 1,
            borderColor: "rgba(190,232,120,0.24)",
            boxShadow: "0 8px 20px rgba(20,69,39,0.22)",
          }}
        >
          <ArrowRight size={20} color={colors.white} />
          <Text style={{ color: colors.white, fontFamily: "Manrope_600SemiBold", fontSize: 16 }}>
            Mulai Tutorial
          </Text>
        </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
