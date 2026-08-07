import React, { useCallback } from "react";
import { FlatList, Text, View } from "react-native";
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
      return <LoadingSpinner fullScreen message="Memuat rekomendasi..." />;
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
      <FlatList
        data={recommendations}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 44 }}
        ListHeaderComponent={
          <View
            style={{
              minHeight: 156,
              padding: 20,
              marginBottom: 20,
              borderRadius: 26,
              borderCurve: "continuous",
              overflow: "hidden",
              ...gradientStyle(gradients.limeWash),
            }}
          >
            <View className="w-10 h-10 rounded-2xl items-center justify-center mb-5" style={{ backgroundColor: colors.forest900 }}>
              <Sparkles size={18} color={colors.lime300} />
            </View>
            <Text className="text-[22px] font-extrabold" style={{ color: colors.ink900, letterSpacing: -0.7 }}>
              Pilihan terbaik untuk materialmu
            </Text>
            <View className="flex-row items-center mt-2">
              <Leaf size={14} color={colors.forest600} />
              <Text className="ml-2 text-xs leading-5 flex-1" style={{ color: colors.ink700 }}>
                {recommendations.length} ide terpilih berdasarkan biaya, waktu, dan potensi hasil.
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <ProductCard product={item} onPress={() => handleSelectProduct(item)} />
        )}
      />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream50, ...gradientStyle(gradients.contentSheet) }}>
      <Header title="Rekomendasi Produk" onBack={() => safeBack(router)} />
      {scanResult ? renderContent() : (
        <EmptyState
          title="Belum Ada Hasil Scan"
          description="Scan material terlebih dahulu untuk mendapatkan rekomendasi."
          actionLabel="Mulai Scan"
          onAction={() => router.push("../upload")}
        />
      )}
    </View>
  );
}
