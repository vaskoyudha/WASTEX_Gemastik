import React, { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Award, Gift, Leaf, Plus, Recycle, TrendingUp } from "lucide-react-native";
import { Header, Card, Badge } from "../src/components/ui";
import { impact } from "../src/services";
import { ImpactSummary } from "../src/services/types";
import { CustomAchievement, customAchievements } from "../src/services/localState";
import { safeBack } from "../src/lib/navigation";

const defaultSummary: ImpactSummary = {
  totalWasteProcessed: 12.8,
  totalProductsMade: 28,
  estimatedEconomicValue: 1250000,
};

const baseAchievements = [
  {
    id: "green_start",
    title: "Hijau Awal",
    description: "Mulai perjalanan upcycling dan mengenali material pertama.",
    icon: Leaf,
    color: "#16a34a",
  },
  {
    id: "products_28",
    title: "28 Produk",
    description: "Target demo menunjukkan 28 produk upcycling berhasil dibuat.",
    icon: Award,
    color: "#d97706",
  },
  {
    id: "sell_value",
    title: "Nilai Jual",
    description: "Produk upcycling sudah punya estimasi nilai ekonomi.",
    icon: Gift,
    color: "#0284c7",
  },
];

export default function AchievementsScreen() {
  const router = useRouter();
  const { focus, action } = useLocalSearchParams<{ focus?: string; action?: string }>();
  const [summary, setSummary] = useState<ImpactSummary>(defaultSummary);
  const [manualAchievements, setManualAchievements] = useState<CustomAchievement[]>([]);

  const loadData = async () => {
    const [impactSummary, savedAchievements] = await Promise.all([
      impact.getImpactSummary(),
      customAchievements.getAll(),
    ]);
    if (impactSummary.totalProductsMade > 0) {
      setSummary(impactSummary);
    }
    setManualAchievements(savedAchievements);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (action === "add") {
      customAchievements.add().then((item) => {
        setManualAchievements((current) => [item, ...current]);
        Alert.alert("Pencapaian Ditambahkan", `${item.title} berhasil dicatat.`);
      });
    }
  }, [action]);

  const handleAddAchievement = async () => {
    const item = await customAchievements.add();
    setManualAchievements((current) => [item, ...current]);
    Alert.alert("Pencapaian Ditambahkan", `${item.title} berhasil dicatat.`);
  };

  return (
    <View className="flex-1 bg-slate-50">
      <Header title="Semua Pencapaian" subtitle="Riwayat impact dan badge WASTEX" onBack={() => safeBack(router)} />
      <ScrollView className="flex-1 px-5 pt-5" contentContainerStyle={{ paddingBottom: 36 }}>
        <Card className="p-5 mb-5 bg-emerald-50 border-emerald-100">
          <Text className="text-base font-black text-slate-900 mb-4">Ringkasan Saat Ini</Text>
          <View className="flex-row justify-between">
            <View className="items-center flex-1">
              <Recycle size={22} color="#16a34a" />
              <Text className="text-lg font-black text-slate-900 mt-2">{summary.totalWasteProcessed} kg</Text>
              <Text className="text-[10px] text-slate-500 text-center">Sampah</Text>
            </View>
            <View className="items-center flex-1">
              <Award size={22} color="#d97706" />
              <Text className="text-lg font-black text-slate-900 mt-2">{summary.totalProductsMade}</Text>
              <Text className="text-[10px] text-slate-500 text-center">Produk</Text>
            </View>
            <View className="items-center flex-1">
              <TrendingUp size={22} color="#0284c7" />
              <Text className="text-sm font-black text-slate-900 mt-2">
                Rp {summary.estimatedEconomicValue.toLocaleString("id-ID")}
              </Text>
              <Text className="text-[10px] text-slate-500 text-center">Nilai</Text>
            </View>
          </View>
        </Card>

        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-base font-bold text-slate-900">Badge Utama</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={handleAddAchievement} className="flex-row items-center">
            <Plus size={16} color="#16a34a" />
            <Text className="text-xs font-bold text-brand ml-1">Tambah</Text>
          </TouchableOpacity>
        </View>

        {baseAchievements.map((item) => {
          const Icon = item.icon;
          const isFocused = focus === item.id;
          return (
            <Card key={item.id} className={`p-4 mb-4 border ${isFocused ? "border-emerald-300 bg-emerald-50" : "border-slate-100"}`}>
              <View className="flex-row items-center">
                <View className="w-12 h-12 rounded-2xl bg-white items-center justify-center mr-4 border border-slate-100">
                  <Icon size={24} color={item.color} />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center mb-1">
                    <Text className="text-sm font-bold text-slate-900 mr-2">{item.title}</Text>
                    {isFocused && <Badge label="Dipilih" variant="brand" size="sm" />}
                  </View>
                  <Text className="text-xs text-slate-600 leading-5">{item.description}</Text>
                </View>
              </View>
            </Card>
          );
        })}

        {manualAchievements.length > 0 && (
          <View className="mt-2">
            <Text className="text-base font-bold text-slate-900 mb-4">Pencapaian Manual</Text>
            {manualAchievements.map((item) => (
              <Card key={item.id} className="p-4 mb-4 border border-slate-100">
                <View className="flex-row items-center">
                  <View className="w-11 h-11 rounded-2xl bg-emerald-50 items-center justify-center mr-3">
                    <Plus size={20} color="#16a34a" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-slate-900">{item.title}</Text>
                    <Text className="text-xs text-slate-500 mt-1">{item.description}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
