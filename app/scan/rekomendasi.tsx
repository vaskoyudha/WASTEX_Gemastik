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
import { colors } from "../../src/theme";

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
        <Text
          selectable
          style={{
            color: colors.ink900,
            fontFamily: "serif",
            fontSize: 26,
            fontWeight: "700",
            letterSpacing: -0.45,
            lineHeight: 31,
            textAlign: "center",
          }}
        >
          Pilihan Terbaik Untuk{"\n"}
          <Text style={{ color: "#3C9A57", fontStyle: "italic" }}>Sampah Anorganikmu</Text>
        </Text>
        <Text
          selectable
          style={{
            color: colors.ink700,
            fontFamily: "Manrope_400Regular",
            fontSize: 12,
            lineHeight: 19,
            marginTop: 8,
            marginBottom: 26,
            textAlign: "center",
          }}
        >
          {recommendations.length} ide terpilih berdasarkan biaya, waktu, dan potensi hasil.
        </Text>
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
