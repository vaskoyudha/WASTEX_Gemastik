import React from "react";
import { View, Text, ScrollView, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Header, Button, Card, LoadingSpinner } from "../../../src/components/ui";
import { useProductData } from "../../../src/hooks/useProductData";
import { safeBack } from "../../../src/lib/navigation";
import { ArrowDown, ArrowRight } from "lucide-react-native";

export default function BeforeAfterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tutData, priceData, loading, error, refetch } = useProductData(id);

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
    <View className="flex-1 bg-cream-50">
      <Header title="Sebelum & Sesudah" onBack={() => safeBack(router)} />

      <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <Card className="p-4 border border-slate-100 mb-4 items-center">
          <Text className="text-xs font-semibold text-slate-500 mb-3">Sebelum (Sampah)</Text>
          <Image source={{ uri: tutData.beforeImageUri }} className="w-full h-48 rounded-2xl bg-slate-200" />
        </Card>

        <View className="items-center mb-4">
          <View className="w-8 h-8 rounded-full bg-emerald-100 items-center justify-center">
            <ArrowDown size={18} color="#16a34a" />
          </View>
        </View>

        <Card className="p-4 border border-slate-100 mb-6 items-center">
          <Text className="text-xs font-semibold text-brand-dark mb-3">Sesudah (Produk Bernilai)</Text>
          <Image source={{ uri: tutData.afterImageUri }} className="w-full h-48 rounded-2xl bg-slate-200" />
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
      </ScrollView>
    </View>
  );
}
