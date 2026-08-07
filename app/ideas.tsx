import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Image, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Clock, Tag, ChevronRight } from "lucide-react-native";
import { Header, Card, Badge, LoadingSpinner } from "../src/components/ui";
import { recommendation } from "../src/services";
import { ProductRecommendation } from "../src/services/types";
import { safeBack } from "../src/lib/navigation";

export default function IdeasScreen() {
  const router = useRouter();
  const [ideas, setIdeas] = useState<ProductRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    recommendation.getAllProducts().then((data) => {
      setIdeas(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <LoadingSpinner fullScreen message="Memuat ide produk..." />;
  }

  return (
    <View className="flex-1 bg-cream-50">
      <Header title="Semua Ide Produk" subtitle={`${ideas.length} ide upcycling siap dijelajahi`} onBack={() => safeBack(router)} />
      <FlatList
        data={ideas}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.push(`/product/${item.id}`)}>
            <Card className="flex-row p-3 mb-4 border border-slate-100">
              <Image source={{ uri: item.thumbnailUri }} className="w-24 h-24 rounded-xl bg-slate-200" resizeMode="cover" />
              <View className="flex-1 ml-4 justify-between">
                <View>
                  <Text className="text-base font-bold text-slate-900 mb-1" numberOfLines={1}>{item.name}</Text>
                  <Text className="text-xs text-slate-600 leading-4" numberOfLines={2}>{item.shortDescription}</Text>
                </View>
                <View className="flex-row items-end justify-between mt-3">
                  <View>
                    <View className="flex-row items-center mb-1">
                      <Clock size={13} color="#64748b" />
                      <Text className="text-xs text-slate-500 ml-1">{item.estimatedTimeMinutes} menit</Text>
                    </View>
                    <View className="flex-row items-center">
                      <Tag size={12} color="#94a3b8" />
                      <Text className="text-xs font-bold text-brand-dark ml-1">
                        Rp {item.estimatedCost.toLocaleString("id-ID")}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Badge variant={item.difficulty} size="sm" />
                    <View className="flex-row items-center mt-2">
                      <Text className="text-xs font-semibold text-brand mr-1">Detail</Text>
                      <ChevronRight size={14} color="#16a34a" />
                    </View>
                  </View>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
