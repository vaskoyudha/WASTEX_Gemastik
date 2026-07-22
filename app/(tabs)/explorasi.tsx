import React from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Card, Header } from "../../src/components/ui";
import { ChevronRight, Leaf, ScanSearch, Sparkles } from "lucide-react-native";

const exploreItems = [
  {
    id: "prod_pet_1",
    title: "Pot Tanaman Gantung",
    subtitle: "Dari botol plastik PET",
    tag: "Mudah",
  },
  {
    id: "prod_kardus_1",
    title: "Organizer Meja Multifungsi",
    subtitle: "Dari kardus bekas kemasan",
    tag: "Mudah",
  },
  {
    id: "prod_kaleng_1",
    title: "Lampu Hias Perforasi",
    subtitle: "Dari kaleng minuman bekas",
    tag: "Sedang",
  },
];

const materialPills = ["Plastik PET", "Plastik HDPE", "Kardus", "Kaleng", "Kaca", "Sachet"];

export default function ExplorasiScreen() {
  const router = useRouter();

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingBottom: 36 }}>
      <Header title="Eksplorasi" subtitle="Ide upcycling dan material yang bisa kamu jelajahi" />

      <View className="px-5 pt-6">
        <Card className="bg-emerald-50 border-emerald-100 p-5 rounded-[28px]">
          <View className="flex-row items-center gap-4">
            <View className="w-14 h-14 rounded-full bg-brand items-center justify-center">
              <Sparkles size={28} color="#ffffff" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-black text-slate-900 tracking-tight mb-1">Cari Ide yang Cocok</Text>
              <Text className="text-sm text-gray-700 leading-5">
                Jelajahi material, lihat contoh produk, lalu lanjutkan ke scan saat kamu siap.
              </Text>
            </View>
          </View>
        </Card>

        <View className="mt-8">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-slate-900 tracking-tight">Material Populer</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Alert.alert("Material", materialPills.join(", "))}
              className="flex-row items-center"
            >
              <Text className="text-xs font-semibold text-brand tracking-tight">Lihat Semua</Text>
              <ChevronRight size={14} color="#16a34a" />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-5" contentContainerStyle={{ gap: 16, paddingHorizontal: 2 }}>
            {materialPills.map((pill) => (
              <View key={pill} className="bg-white border border-slate-100 px-4 py-3 rounded-2xl items-center mx-2 shadow-sm min-w-[96px]">
                <Leaf size={18} color="#16a34a" />
                <Text className="text-xs font-semibold text-gray-700 tracking-tight text-center mt-2">{pill}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View className="mt-8">
          <Text className="text-base font-bold text-slate-900 tracking-tight">Ide Produk</Text>
          <View className="mt-5 gap-4">
            {exploreItems.map((item) => (
              <TouchableOpacity key={item.id} activeOpacity={0.8} onPress={() => router.push(`/product/${item.id}`)}>
                <Card className="p-4 border border-slate-100 shadow-sm rounded-[24px]">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="text-base font-bold text-slate-900 mb-1">{item.title}</Text>
                      <Text className="text-sm text-gray-600 leading-5">{item.subtitle}</Text>
                    </View>
                    <View className="items-end">
                      <View className="bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full mb-2">
                        <Text className="text-[10px] font-bold text-brand-dark">{item.tag}</Text>
                      </View>
                      <ScanSearch size={18} color="#16a34a" />
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push("/scan/upload")}
          className="mt-8 flex-row items-center justify-center bg-brand rounded-2xl px-5 py-4 shadow-sm"
        >
          <Text className="text-white font-bold text-sm mr-2">Mulai Scan Sekarang</Text>
          <ChevronRight size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
