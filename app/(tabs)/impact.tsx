import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Header, Card } from "../../src/components/ui";
import { impact } from "../../src/services";
import { ImpactSummary } from "../../src/services/types";
import { Award, Gift, Leaf, Plus, Recycle, TrendingUp } from "lucide-react-native";

const defaultSummary: ImpactSummary = {
  totalWasteProcessed: 12.8,
  totalProductsMade: 28,
  estimatedEconomicValue: 1250000,
};

const monthlyData = [
  { month: "Jan", waste: 8, value: 42 },
  { month: "Feb", waste: 12, value: 56 },
  { month: "Mar", waste: 15, value: 68 },
  { month: "Apr", waste: 10, value: 48 },
  { month: "Mei", waste: 17, value: 74 },
  { month: "Jun", waste: 14, value: 62 },
];

const maxWaste = Math.max(...monthlyData.map((d) => d.waste));
const maxValue = Math.max(...monthlyData.map((d) => d.value));

export default function ImpactScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<ImpactSummary>(defaultSummary);

  useFocusEffect(
    useCallback(() => {
      impact.getImpactSummary().then((s) => {
        if (s.totalProductsMade > 0) {
          setSummary(s);
        }
      });
    }, [])
  );

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
              <Text className="text-xl font-black text-slate-900 tracking-tight">15 kg</Text>
              <Text className="text-[11px] font-semibold text-gray-600 text-center mt-1">CO2 Dihemat</Text>
            </Card>
          </View>
        </View>

        <View className="mt-8">
          <Text className="text-base font-bold text-slate-900 tracking-tight">Grafik Bulanan</Text>
          <Card className="p-5 border border-slate-100 mt-5 rounded-[24px]">
            <View className="flex-row items-start justify-between mb-6">
              <View>
                <Text className="text-sm font-bold text-slate-900 mb-1">Jan-Jun 2026</Text>
                <Text className="text-[11px] font-semibold text-gray-600">Sampah dan nilai ekonomi</Text>
              </View>
              <View className="items-end">
                <View className="flex-row items-center mb-1">
                  <View className="w-2.5 h-2.5 rounded-full bg-brand mr-1.5" />
                  <Text className="text-[10px] font-semibold text-gray-600">Sampah (kg)</Text>
                </View>
                <View className="flex-row items-center">
                  <View className="w-2.5 h-2.5 rounded-full bg-emerald-200 mr-1.5" />
                  <Text className="text-[10px] font-semibold text-gray-600">Nilai (Rp)</Text>
                </View>
              </View>
            </View>

            <View className="flex-row items-end justify-between gap-4 h-40 mb-3">
              {monthlyData.map((d) => {
                const wasteHeight = maxWaste ? (d.waste / maxWaste) * 100 : 0;
                const valueHeight = maxValue ? (d.value / maxValue) * 100 : 0;

                return (
                  <View key={d.month} className="flex-1 items-center h-full">
                    <View className="flex-row items-end gap-1 h-full">
                      <View className="w-3 bg-brand rounded-t-xl" style={{ height: `${wasteHeight}%` }} />
                      <View className="w-3 bg-emerald-200 rounded-t-xl" style={{ height: `${valueHeight}%` }} />
                    </View>
                  </View>
                );
              })}
            </View>
            <View className="flex-row justify-between gap-4">
              {monthlyData.map((d) => (
                <Text key={d.month} className="text-[10px] font-semibold text-gray-600 flex-1 text-center">
                  {d.month}
                </Text>
              ))}
            </View>
          </Card>
        </View>

        <View className="mt-8">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-slate-900 tracking-tight">Pencapaian</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/achievements")}
              className="flex-row items-center"
            >
              <Text className="text-xs font-semibold text-brand tracking-tight">Lihat Semua</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-5" contentContainerStyle={{ gap: 16, paddingHorizontal: 2 }}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => router.push("/achievements?focus=green_start") }>
              <Card className="p-4 items-center justify-center w-24 h-24 mx-2 border border-slate-100 shadow-sm">
                <Leaf size={26} color="#16a34a" />
                <Text className="text-[10px] font-semibold text-gray-700 mt-2 text-center">Hijau Awal</Text>
              </Card>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} onPress={() => router.push("/achievements?focus=products_28") }>
              <Card className="p-4 items-center justify-center w-24 h-24 mx-2 border border-slate-100 shadow-sm">
                <Award size={26} color="#d97706" />
                <Text className="text-[10px] font-semibold text-gray-700 mt-2 text-center">28 Produk</Text>
              </Card>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} onPress={() => router.push("/achievements?focus=sell_value") }>
              <Card className="p-4 items-center justify-center w-24 h-24 mx-2 border border-slate-100 shadow-sm">
                <Gift size={26} color="#0284c7" />
                <Text className="text-[10px] font-semibold text-gray-700 mt-2 text-center">Nilai Jual</Text>
              </Card>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} onPress={() => router.push("/achievements?action=add") }>
              <Card className="p-0 items-center justify-center w-24 h-24 mx-2 border border-slate-200 border-dashed bg-white">
                <Plus size={24} color="#94a3b8" />
                <Text className="text-[10px] font-semibold text-gray-600 mt-2 text-center">Tambah</Text>
              </Card>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </ScrollView>
  );
}
