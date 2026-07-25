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
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        ListHeaderComponent={
          <Text className="mb-4 text-sm leading-5 text-slate-500">
            Berikut ide produk yang bisa kamu buat dari material ini.
          </Text>
        }
        renderItem={({ item }) => (
          <ProductCard product={item} onPress={() => handleSelectProduct(item)} />
        )}
      />
    );
  };

  return (
    <View className="flex-1 bg-slate-50">
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
