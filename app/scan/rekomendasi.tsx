import React, { useCallback } from "react";
import { Image, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { Header, EmptyState, LoadingSpinner } from "../../src/components/ui";
import { ProductCard } from "../../src/features";
import { useServiceCall } from "../../src/hooks/useServiceCall";
import { recommendation } from "../../src/services";
import { useScanStore } from "../../src/store/useScanStore";
import type { ProductRecommendation, ScanResult } from "../../src/services/types";
import { safeBack } from "../../src/lib/navigation";
import { Leaf, Sparkles } from "lucide-react-native";
import { colors, gradients, gradientStyle } from "../../src/theme";

export default function RekomendasiScreen(): React.JSX.Element {
  const router = useRouter();
  const { height: screenHeight } = useWindowDimensions();
  const scanResult = useScanStore((state) => state.scanResult);
  const setSelectedProduct = useScanStore((state) => state.setSelectedProduct);

  const loadRecommendations = useCallback(
    (result: ScanResult): Promise<ProductRecommendation[]> =>
      recommendation.getRecommendations(result),
    [],
  );
  const recommendationsCall = useServiceCall<ProductRecommendation[], [ScanResult]>(
    loadRecommendations,
    {
      autoCall: scanResult !== null,
      initialArgs: scanResult ? [scanResult] : undefined,
    },
  );

  const handleSelectProduct = (product: ProductRecommendation): void => {
    setSelectedProduct(product);
    router.push(`../product/${product.id}`);
  };

  const renderContent = (): React.JSX.Element => {
    if (recommendationsCall.loading) {
      return (
        <View style={{ minHeight: Math.max(screenHeight - 100, 620) }}>
          <LoadingSpinner fullScreen message="Memuat rekomendasi..." />
        </View>
      );
    }

    if (recommendationsCall.error) {
      return (
        <EmptyState
          title="Rekomendasi Gagal Dimuat"
          description="Coba muat ulang rekomendasi produk untuk material ini."
          actionLabel="Coba Lagi"
          onAction={recommendationsCall.refetch}
        />
      );
    }

    const recommendations = recommendationsCall.data ?? [];
    if (recommendations.length === 0) {
      return (
        <EmptyState
          title="Tidak Ada Rekomendasi"
          description="Silakan ulangi proses scan material sampah terlebih dahulu."
          actionLabel="Ulangi Scan"
          onAction={() => router.push("../upload")}
        />
      );
    }

    return (
      <View style={{ paddingHorizontal: 18, paddingTop: 30, paddingBottom: 44 }}>
        <View
          style={{
            minHeight: 156,
            padding: 20,
            marginBottom: 20,
            borderRadius: 26,
            borderCurve: "continuous",
            overflow: "hidden",
            backgroundColor: "#2B7748",
            ...gradientStyle(gradients.uploadAnalyze),
            borderWidth: 1,
            borderColor: "rgba(190,232,120,0.24)",
            boxShadow: "0 9px 22px rgba(20,69,39,0.22)",
          }}
        >
          <View className="w-10 h-10 rounded-2xl items-center justify-center mb-5" style={{ backgroundColor: colors.forest900 }}>
            <Sparkles size={18} color={colors.lime300} />
          </View>
          <Text className="text-[22px] font-extrabold" style={{ color: colors.white, letterSpacing: -0.7 }}>
            Pilihan terbaik untuk materialmu
          </Text>
          <View className="flex-row items-center mt-2">
            <Leaf size={14} color={colors.lime300} />
            <Text className="ml-2 text-xs leading-5 flex-1" style={{ color: "rgba(255,255,255,0.74)" }}>
              {recommendations.length} ide terpilih berdasarkan biaya, waktu, dan potensi hasil.
            </Text>
          </View>
        </View>
        {recommendations.map((item) => (
          <ProductCard key={item.id} product={item} onPress={() => handleSelectProduct(item)} />
        ))}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F8F2" }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, backgroundColor: "transparent" }}
        contentContainerStyle={{ minHeight: screenHeight }}
      >
        <Image
          source={require("../../assets/images/upload-screen-bg.png")}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          style={{ position: "absolute", top: -128, left: 0, width: "100%", height: screenHeight }}
        />
        <Header
          title="Rekomendasi Produk"
          onBack={() => safeBack(router)}
          transparent
          contentColor={colors.white}
        />
        {scanResult ? renderContent() : (
          <View style={{ minHeight: Math.max(screenHeight - 100, 620) }}>
            <EmptyState
              title="Belum Ada Hasil Scan"
              description="Scan material terlebih dahulu untuk mendapatkan rekomendasi."
              actionLabel="Mulai Scan"
              onAction={() => router.push("../upload")}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
