import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Header, Button, Card, LoadingSpinner } from "../../../src/components/ui";
import { useProductData } from "../../../src/hooks/useProductData";
import { TrendingUp } from "lucide-react-native";
import { safeBack } from "../../../src/lib/navigation";
import { colors, screenSheetStyle } from "../../../src/theme";

export default function PricingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { priceData, loading, error, refetch } = useProductData(id);

  if (loading) {
    return <LoadingSpinner fullScreen message="Memuat estimasi harga..." />;
  }

  if (error) {
    return (
      <View className="flex-1 bg-cream-50 items-center justify-center p-6">
        <Text className="text-slate-600 text-center mb-4">Estimasi harga gagal dimuat.</Text>
        <Button title="Coba Lagi" onPress={() => refetch()} />
      </View>
    );
  }

  if (!priceData) {
    return (
      <View className="flex-1 bg-cream-50 items-center justify-center p-6">
        <Text className="text-slate-600 mb-4">Estimasi harga tidak ditemukan.</Text>
        <Button title="Kembali ke Beranda" onPress={() => router.replace("/")} />
      </View>
    );
  }

  const profitPct = priceData.suggestedSellPrice
    ? Math.round((priceData.estimatedProfit / priceData.suggestedSellPrice) * 100)
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest900 }}>
      <Header title="Estimasi Harga" onBack={() => safeBack(router)} />

      <ScrollView style={screenSheetStyle} className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <Card className="p-0 border border-slate-100 mb-5 overflow-hidden">
          {[
            { label: "Biaya Material", value: priceData.materialCost },
            { label: "Aksesoris & Tambahan", value: priceData.additionalCost },
            { label: "Waktu Pengerjaan (45 mnt)", value: 10000 },
            { label: "Biaya Lain-lain", value: 2000 },
          ].map((row, idx, arr) => (
            <View
              key={idx}
              className={`flex-row items-center justify-between px-4 py-3.5 ${
                idx !== arr.length - 1 ? "border-b border-slate-100" : ""
              }`}
            >
              <Text className="text-sm text-slate-500">{row.label}</Text>
              <Text className="text-sm font-bold text-slate-900">
                Rp {row.value.toLocaleString("id-ID")}
              </Text>
            </View>
          ))}
        </Card>

        <Card className="bg-emerald-50 border-emerald-100 p-5 mb-4 items-center">
          <Text className="text-xs text-slate-500 mb-1">Harga Jual yang Disarankan</Text>
          <Text className="text-3xl font-extrabold text-brand-dark">
            Rp {priceData.suggestedSellPrice.toLocaleString("id-ID")}
          </Text>
        </Card>

        <Card className="bg-emerald-50/60 border-emerald-100 p-5 mb-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs text-slate-500 mb-1">Keuntungan Estimasi</Text>
              <Text className="text-2xl font-extrabold text-brand-dark">
                Rp {priceData.estimatedProfit.toLocaleString("id-ID")} ({profitPct}%)
              </Text>
            </View>
            <TrendingUp size={32} color="#16a34a" />
          </View>
        </Card>

        <Text className="text-[11px] text-slate-400 leading-4 mb-6">
          Harga dapat disesuaikan dengan kondisi pasar dan kualitas produk.
        </Text>

        <Button
          title="Lanjut ke AI Selling Assistant"
          onPress={() => router.push(`/product/${id}/selling`)}
          variant="primary"
        />
      </ScrollView>
    </View>
  );
}
