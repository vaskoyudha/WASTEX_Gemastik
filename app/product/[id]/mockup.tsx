import React from "react";
import { View, Text, ScrollView, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Header, Button, Card, LoadingSpinner } from "../../../src/components/ui";
import { useProductData } from "../../../src/hooks/useProductData";
import { safeBack } from "../../../src/lib/navigation";
import { colors, screenSheetStyle } from "../../../src/theme";

export default function MockupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tutData, loading, error, refetch } = useProductData(id);

  if (loading) {
    return <LoadingSpinner fullScreen message="Memuat mockup produk..." />;
  }

  if (error) {
    return (
      <View className="flex-1 bg-cream-50 items-center justify-center p-6">
        <Text className="text-slate-600 text-center mb-4">Mockup produk gagal dimuat.</Text>
        <Button title="Coba Lagi" onPress={() => refetch()} />
      </View>
    );
  }

  if (!tutData) {
    return (
      <View className="flex-1 bg-cream-50 items-center justify-center p-6">
        <Text className="text-slate-600 mb-4">Mockup tidak ditemukan.</Text>
        <Button title="Kembali ke Beranda" onPress={() => router.replace("/")} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest900 }}>
      <Header title="Mockup Produk" onBack={() => safeBack(router)} />

      <ScrollView style={screenSheetStyle} className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <Card className="rounded-3xl overflow-hidden p-0 border-0 mb-5">
          <Image source={{ uri: tutData.mockupImageUri }} className="w-full h-64" resizeMode="cover" />
        </Card>

        <View className="flex-row gap-3 mb-5">
          <View className="flex-1 items-center">
            <Image source={{ uri: tutData.afterImageUri }} className="w-full h-24 rounded-2xl bg-slate-200 mb-2" />
            <Text className="text-[11px] text-slate-500">Dengan Kemasan</Text>
          </View>
          <View className="flex-1 items-center">
            <Image source={{ uri: tutData.mockupImageUri }} className="w-full h-24 rounded-2xl bg-slate-200 mb-2" />
            <Text className="text-[11px] text-slate-500">Label Produk</Text>
          </View>
          <View className="flex-1 items-center">
            <Image source={{ uri: tutData.afterImageUri }} className="w-full h-24 rounded-2xl bg-slate-200 mb-2" />
            <Text className="text-[11px] text-slate-500">Lifestyle Photo</Text>
          </View>
        </View>

        <Card className="bg-emerald-50 border-emerald-100 p-5 mb-6">
          <Text className="text-base font-bold text-brand-dark mb-1 text-center">Siap Dijual!</Text>
          <Text className="text-xs text-slate-600 text-center leading-5">
            Produk kamu terlihat lebih profesional dan menarik untuk dipasarkan.
          </Text>
        </Card>

        <Button
          title="Lanjut ke Estimasi Harga"
          onPress={() => router.push(`/product/${id}/pricing`)}
          variant="primary"
        />
      </ScrollView>
    </View>
  );
}
