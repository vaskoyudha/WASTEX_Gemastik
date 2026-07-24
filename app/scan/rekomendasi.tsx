import React from "react";
import { Alert, View, Text, FlatList, Image, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Header, Badge, EmptyState } from "../../src/components/ui";
import { useScanStore } from "../../src/store/useScanStore";
import { ProductRecommendation } from "../../src/services/types";
import { bookmarks } from "../../src/services/localState";
import { safeBack } from "../../src/lib/navigation";
import { Clock, Bookmark, ChevronRight, Tag } from "lucide-react-native";

export default function RekomendasiScreen() {
  const router = useRouter();
  const { recommendations, setSelectedProduct } = useScanStore();

  const handleSelectProduct = (product: ProductRecommendation) => {
    setSelectedProduct(product);
    router.push(`/product/${product.id}`);
  };

  return (
    <View className="flex-1 bg-slate-50">
      <Header title="Rekomendasi Produk" onBack={() => safeBack(router)} />

      {recommendations.length === 0 ? (
        <EmptyState
          title="Tidak Ada Rekomendasi"
          description="Silakan ulangi proses scan material sampah terlebih dahulu."
          actionLabel="Ulangi Scan"
          onAction={() => router.push("/scan/upload")}
        />
      ) : (
        <FlatList
          data={recommendations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
          ListHeaderComponent={
            <View className="mb-4">
              <Text className="text-sm text-slate-500 leading-5">
                Berikut ide produk yang bisa kamu buat dari material ini.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleSelectProduct(item)}
              className="flex-row bg-white rounded-2xl p-3 border border-slate-100 mb-4 shadow-sm"
            >
              <Image
                source={{ uri: item.thumbnailUri }}
                className="w-24 h-24 rounded-xl bg-slate-200"
                resizeMode="cover"
              />
              <View className="flex-1 ml-4 justify-between">
                <View>
                  <View className="flex-row items-center justify-between mb-1.5">
                    <Text className="text-base font-bold text-slate-900 flex-1 pr-2" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={async () => {
                        const saved = await bookmarks.toggle(item);
                        Alert.alert(
                          saved ? "Tersimpan" : "Dihapus",
                          saved ? `${item.name} ditambahkan ke bookmark.` : `${item.name} dihapus dari bookmark.`
                        );
                      }}
                      className="p-1"
                    >
                      <Bookmark size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                  <View className="flex-row items-center mb-2">
                    <Badge variant={item.difficulty} size="sm" />
                    <View className="flex-row items-center ml-2">
                      <Clock size={13} color="#64748b" />
                      <Text className="text-xs text-slate-500 ml-1">{item.estimatedTimeMinutes} menit</Text>
                    </View>
                  </View>
                </View>
                <View className="flex-row items-end justify-between">
                  <View>
                    <View className="flex-row items-center mb-0.5">
                      <Tag size={12} color="#94a3b8" />
                      <Text className="text-[10px] text-slate-400 ml-1">Estimasi Harga</Text>
                    </View>
                    <Text className="text-sm font-extrabold text-brand-dark">
                      Rp {item.estimatedCost.toLocaleString("id-ID")}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Text className="text-xs font-semibold text-brand mr-1">Lihat</Text>
                    <ChevronRight size={14} color="#16a34a" />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListFooterComponent={
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/ideas")}
              className="flex-row items-center justify-center py-3 mt-2"
            >
              <Text className="text-sm font-bold text-brand mr-1">Lihat Semua Ide (12)</Text>
              <ChevronRight size={16} color="#16a34a" />
            </TouchableOpacity>
          }
        />
      )}
    </View>
  );
}
