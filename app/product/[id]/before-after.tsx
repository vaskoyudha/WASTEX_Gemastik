import React from "react";
import { View, Text, ScrollView, Image, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Header, Button, Card, LoadingSpinner, FitImage } from "../../../src/components/ui";
import { useProductData } from "../../../src/hooks/useProductData";
import { safeBack } from "../../../src/lib/navigation";
import { ArrowRight, ImageIcon } from "lucide-react-native";
import { colors } from "../../../src/theme";

export default function BeforeAfterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tutData, priceData, loading, error, refetch } = useProductData(id);
  const { height: screenHeight } = useWindowDimensions();

  if (loading) {
    return <LoadingSpinner fullScreen message="Memuat perbandingan..." />;
  }

  if (error) {
    return (
      <View className="flex-1 bg-cream-50 items-center justify-center p-6">
        <Text className="text-slate-600 text-center mb-4">Perbandingan gagal dimuat.</Text>
        <Button title="Coba Lagi" onPress={() => refetch()} />
      </View>
    );
  }

  if (!tutData) {
    return (
      <View className="flex-1 bg-cream-50 items-center justify-center p-6">
        <Text className="text-slate-600 mb-4">Data tidak ditemukan.</Text>
        <Button title="Kembali ke Beranda" onPress={() => router.replace("/")} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, backgroundColor: "transparent" }}
        contentContainerStyle={{ minHeight: screenHeight, backgroundColor: "transparent" }}
      >
        <Image
          source={require("../../../assets/images/upload-screen-bg.png")}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          style={{
            position: "absolute",
            top: -128,
            left: 0,
            width: "100%",
            height: screenHeight + 128,
          }}
        />
        <Header title="Sebelum & Sesudah" onBack={() => safeBack(router)} transparent contentColor={colors.white} />

        <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, backgroundColor: "transparent" }}>
          <Card className="p-4 border border-slate-100 mb-4 items-center">
            <Text className="text-xs font-semibold text-slate-500 mb-3">Sebelum & Sesudah</Text>
            {tutData.beforeImageUri ? (
              <FitImage
                source={{ uri: tutData.beforeImageUri }}
                className="rounded-2xl overflow-hidden bg-slate-200"
                maxHeight={400}
              />
            ) : (
              <View className="w-full h-64 rounded-2xl items-center justify-center" style={{ backgroundColor: "#EEF2EC" }}>
                <ImageIcon size={40} color="#94A3B8" strokeWidth={1.5} />
                <Text className="text-xs text-slate-400 mt-3 text-center px-6">
                  Gambar perbandingan belum tersedia.{"\n"}Visual akan dihasilkan oleh AI.
                </Text>
              </View>
            )}
          </Card>

          <Card className="p-5 border border-slate-100 mb-6">
            <Text className="text-xs text-slate-500 text-center mb-3">Peningkatan Nilai</Text>
            <View className="flex-row items-center justify-center">
              <Text className="text-lg font-bold text-slate-500 line-through">Rp 0</Text>
              <View className="mx-3">
                <ArrowRight size={16} color="#64748b" />
              </View>
              <Text className="text-2xl font-extrabold text-brand-dark">
                Rp {priceData?.suggestedSellPrice.toLocaleString("id-ID") || "0"}
              </Text>
            </View>
            <Text className="text-xs text-emerald-600 text-center mt-2 font-semibold">Nilai Naik</Text>
          </Card>

          <Button
            title="Lihat Mockup Produk"
            onPress={() => router.push(`/product/${id}/mockup`)}
            variant="primary"
          />
        </View>
      </ScrollView>
    </View>
  );
}
