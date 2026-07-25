import React, { useMemo } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Award, Gift, Leaf, Plus, Recycle, TrendingUp } from "lucide-react-native";
import { Header, Card, EmptyState, LoadingSpinner } from "../../src/components/ui";
import { useImpactData } from "../../src/hooks/useImpactData";

const achievementLinks = [
  { id: "green_start", title: "Hijau Awal", icon: Leaf, color: "#16a34a" },
  { id: "products_28", title: "28 Produk", icon: Award, color: "#d97706" },
  { id: "sell_value", title: "Nilai Jual", icon: Gift, color: "#0284c7" },
];

export default function ImpactScreen() {
  const router = useRouter();
  const { history, summary, loading, error, refresh } = useImpactData();

  const chartData = useMemo(
    () => [
      { label: "Sampah", value: summary.totalWasteProcessed, display: `${summary.totalWasteProcessed} kg`, color: "#16a34a" },
      { label: "Produk", value: summary.totalProductsMade, display: `${summary.totalProductsMade}`, color: "#d97706" },
      {
        label: "Nilai",
        value: summary.estimatedEconomicValue / 100000,
        display: `Rp ${summary.estimatedEconomicValue.toLocaleString("id-ID")}`,
        color: "#0284c7",
      },
    ],
    [summary]
  );

  const maxValue = Math.max(...chartData.map((item) => item.value), 1);

  if (loading) {
    return <LoadingSpinner fullScreen message="Memuat dampak WASTEX..." />;
  }

  if (error) {
    return (
      <View className="flex-1 bg-slate-50">
        <Header title="Dampak & Pencapaian" />
        <View className="flex-1 px-5 pt-6">
          <EmptyState
            title="Dampak Gagal Dimuat"
            description="Coba muat ulang data impact yang tersimpan di perangkat ini."
            actionLabel="Muat Ulang"
            onAction={refresh}
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingBottom: 36 }}>
      <Header title="Dampak & Pencapaian" />

      <View className="px-5 pt-6">
        <Card className="bg-emerald-50 border-emerald-100 p-5 rounded-[28px]">
          <View className="flex-row items-center gap-4">
            <View className="w-16 h-16 rounded-full bg-brand items-center justify-center shadow-sm">
              <Leaf size={30} color="#ffffff" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-black text-slate-900 tracking-tight mb-1">Jejak Baik WASTEX</Text>
              <Text className="text-sm text-gray-700 leading-5">
                Pantau sampah yang berhasil kamu olah, produk yang dibuat, dan nilai ekonomi dari proyek upcycling.
              </Text>
            </View>
          </View>
        </Card>

        <View className="mt-8">
          <Text className="text-base font-bold text-slate-900 tracking-tight">Ringkasan Dampak</Text>
          <View className="flex-row flex-wrap gap-4 mt-5">
            <Card className="flex-1 min-w-[45%] mx-1 p-4 items-center bg-white border border-slate-100 shadow-sm">
              <View className="w-11 h-11 rounded-full bg-emerald-50 items-center justify-center mb-3">
                <Recycle size={22} color="#16a34a" />
              </View>
              <Text className="text-xl font-black text-slate-900 tracking-tight">{summary.totalWasteProcessed} kg</Text>
              <Text className="text-[11px] font-semibold text-gray-600 text-center mt-1">Sampah Diolah</Text>
            </Card>

            <Card className="flex-1 min-w-[45%] mx-1 p-4 items-center bg-white border border-slate-100 shadow-sm">
              <View className="w-11 h-11 rounded-full bg-amber-50 items-center justify-center mb-3">
                <Award size={22} color="#d97706" />
              </View>
              <Text className="text-xl font-black text-slate-900 tracking-tight">{summary.totalProductsMade}</Text>
              <Text className="text-[11px] font-semibold text-gray-600 text-center mt-1">Produk Dibuat</Text>
            </Card>

            <Card className="flex-1 min-w-[45%] mx-1 p-4 items-center bg-white border border-slate-100 shadow-sm">
              <View className="w-11 h-11 rounded-full bg-emerald-50 items-center justify-center mb-3">
                <TrendingUp size={22} color="#16a34a" />
              </View>
              <Text className="text-base font-black text-slate-900 tracking-tight">
                Rp {summary.estimatedEconomicValue.toLocaleString("id-ID")}
              </Text>
              <Text className="text-[11px] font-semibold text-gray-600 text-center mt-1">Nilai Ekonomi</Text>
            </Card>

            <Card className="flex-1 min-w-[45%] mx-1 p-4 items-center bg-white border border-slate-100 shadow-sm">
              <View className="w-11 h-11 rounded-full bg-sky-50 items-center justify-center mb-3">
                <Leaf size={22} color="#0284c7" />
              </View>
              <Text className="text-xl font-black text-slate-900 tracking-tight">{Math.max(summary.totalProductsMade - 1, 0)}x</Text>
              <Text className="text-[11px] font-semibold text-gray-600 text-center mt-1">Siklus Upcycling</Text>
            </Card>
          </View>
        </View>

        <View className="mt-8">
          <Text className="text-base font-bold text-slate-900 tracking-tight">Grafik Dampak Aktual</Text>
          <Card className="p-5 border border-slate-100 mt-5 rounded-[24px]">
            <View className="flex-row items-end justify-between h-44 gap-4 mb-4">
              {chartData.map((item) => {
                const heightPct = Math.max(Math.round((item.value / maxValue) * 100), 12);

                return (
                  <View key={item.label} className="flex-1 items-center h-full justify-end">
                    <View className="items-center justify-end h-full w-full">
                      <View
                        testID="impact-bar"
                        accessibilityLabel={`${item.label} impact bar`}
                        className="w-full rounded-t-2xl"
                        style={{ height: `${heightPct}%`, backgroundColor: item.color }}
                      />
                    </View>
                    <Text className="text-[10px] font-semibold text-slate-600 mt-3 text-center leading-4">
                      {item.label}
                    </Text>
                    <Text className="text-[10px] text-slate-400 text-center mt-1 leading-4">{item.display}</Text>
                  </View>
                );
              })}
            </View>
          </Card>
        </View>

        <View className="mt-8">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-slate-900 tracking-tight">Pencapaian</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => router.push("/achievements")} className="flex-row items-center">
              <Text className="text-xs font-semibold text-brand tracking-tight">Lihat Semua</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-5" contentContainerStyle={{ gap: 16, paddingHorizontal: 2 }}>
            {achievementLinks.map((item) => {
              const Icon = item.icon;

              return (
                <TouchableOpacity key={item.id} activeOpacity={0.8} onPress={() => router.push(`/achievements?focus=${item.id}`)}>
                  <Card className="p-4 items-center justify-center w-24 h-24 mx-2 border border-slate-100 shadow-sm">
                    <Icon size={26} color={item.color} />
                    <Text className="text-[10px] font-semibold text-gray-700 mt-2 text-center">{item.title}</Text>
                  </Card>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity activeOpacity={0.8} onPress={() => router.push("/achievements?action=add")}>
              <Card className="p-0 items-center justify-center w-24 h-24 mx-2 border border-slate-200 border-dashed bg-white">
                <Plus size={24} color="#94a3b8" />
                <Text className="text-[10px] font-semibold text-gray-600 mt-2 text-center">Tambah</Text>
              </Card>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {history.length > 0 && (
          <View className="mt-8">
            <Text className="text-base font-bold text-slate-900 tracking-tight mb-4">Aktivitas Terbaru</Text>
            {history.slice(0, 3).map((project) => (
              <Card key={project.id} className="p-4 mb-3 border border-slate-100">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>
                      {project.product.name}
                    </Text>
                    <Text className="text-xs text-slate-500 mt-1" numberOfLines={1}>
                      {project.material.materialLabel} - Rp {project.product.estimatedCost.toLocaleString("id-ID")}
                    </Text>
                  </View>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/product/${project.product.id}`)}>
                    <Text className="text-xs font-semibold text-brand">Lihat</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
