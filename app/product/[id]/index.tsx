import React from "react";
import { Alert, Share, View, Text, ScrollView, Image, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Header, Button, Card, Badge, LoadingSpinner } from "../../../src/components/ui";
import { useProductData } from "../../../src/hooks/useProductData";
import { favorites } from "../../../src/services/localState";
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
} from "lucide-react-native";

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
  const { product, tutData, priceData, loading } = useProductData(id);

  if (loading) {
    return <LoadingSpinner fullScreen message="Memuat detail produk..." />;
  }

  if (!product) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center p-6">
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
        <Heart size={22} color="#1e293b" />
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => Share.share({ message: `Lihat ide upcycling WASTEX: ${product.name}` })}
        className="p-2"
      >
        <Share2 size={22} color="#1e293b" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50">
      <Header title="Detail Produk" onBack={() => safeBack(router)} rightElement={headerRight} />

      <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <Card className="rounded-3xl overflow-hidden p-0 border-0 mb-5">
          <Image source={{ uri: product.thumbnailUri }} className="w-full h-64" resizeMode="cover" />
        </Card>

        <Text className="text-2xl font-extrabold text-slate-900 mb-2">{product.name}</Text>

        <View className="flex-row items-center gap-3 mb-4">
          <Badge variant={product.difficulty} size="sm" />
          <View className="flex-row items-center">
            <Clock size={14} color="#64748b" />
            <Text className="text-xs text-slate-500 ml-1">{product.estimatedTimeMinutes} menit</Text>
          </View>
        </View>

        <Text className="text-sm text-slate-600 leading-5 mb-6">{product.shortDescription}</Text>

        <Card className="p-0 border border-slate-100 mb-6 overflow-hidden">
          {[
            { label: "Estim Biaya", value: `Rp ${product.estimatedCost.toLocaleString("id-ID")}` },
            {
              label: "Est. Harga Jual",
              value: priceData ? `Rp ${priceData.suggestedSellPrice.toLocaleString("id-ID")}` : "-",
            },
            {
              label: "Est. Keuntungan",
              value: priceData ? `Rp ${priceData.estimatedProfit.toLocaleString("id-ID")}` : "-",
            },
            {
              label: "Level Kesulitan",
              value:
                product.difficulty === "mudah" ? "Mudah" : product.difficulty === "sedang" ? "Sedang" : "Sulit",
            },
          ].map((row, idx, arr) => (
            <View
              key={idx}
              className={`flex-row items-center justify-between px-4 py-3.5 ${
                idx !== arr.length - 1 ? "border-b border-slate-100" : ""
              }`}
            >
              <Text className="text-sm text-slate-500">{row.label}</Text>
              <Text className="text-sm font-bold text-slate-900">{row.value}</Text>
            </View>
          ))}
        </Card>

        <View className="mb-6">
          <Text className="text-sm font-bold text-slate-900 mb-3">Alat & Bahan</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {tutData?.toolsAndMaterials.map((tool, idx) => {
              const Icon = getToolIcon(tool);
              return (
                <View
                  key={idx}
                  className="bg-white border border-slate-100 rounded-2xl p-3 items-center mr-3 w-24"
                >
                  <View className="w-10 h-10 rounded-full bg-emerald-50 items-center justify-center mb-2">
                    <Icon size={20} color="#16a34a" />
                  </View>
                  <Text className="text-[10px] text-slate-600 text-center leading-4" numberOfLines={2}>
                    {tool}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <Button
          title="Lihat Tutorial Langkah-langkah"
          onPress={() => router.push(`/product/${id}/tutorial`)}
          variant="primary"
        />
      </ScrollView>
    </View>
  );
}
