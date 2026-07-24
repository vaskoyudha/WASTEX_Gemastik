import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Box, GlassWater, Layers, Package, Recycle } from "lucide-react-native";
import { Header, Card, Badge } from "../src/components/ui";
import { MOCK_SCAN_RESULTS } from "../src/mocks/mockData";
import { MaterialType } from "../src/services/types";
import { safeBack } from "../src/lib/navigation";

const materialOrder: MaterialType[] = ["plastik_pet", "plastik_hdpe", "kardus", "kaleng", "kaca", "sachet"];

const materialIcons: Record<MaterialType, React.ComponentType<{ size?: number; color?: string }>> = {
  plastik_pet: Recycle,
  plastik_hdpe: Box,
  kardus: Package,
  kaleng: Package,
  kaca: GlassWater,
  sachet: Layers,
};

export default function MaterialsScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-slate-50">
      <Header title="Material Didukung" subtitle="Jenis sampah yang bisa dianalisis" onBack={() => safeBack(router)} />
      <ScrollView className="flex-1 px-5 pt-5" contentContainerStyle={{ paddingBottom: 32 }}>
        {materialOrder.map((key) => {
          const material = MOCK_SCAN_RESULTS[key];
          const Icon = materialIcons[key];
          return (
            <Card key={key} className="p-4 mb-4 border border-slate-100">
              <View className="flex-row items-start">
                <View className="w-12 h-12 rounded-2xl bg-emerald-50 items-center justify-center mr-4">
                  <Icon size={23} color="#16a34a" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-base font-bold text-slate-900 flex-1 pr-3">{material.materialLabel}</Text>
                    <Badge variant={material.riskLevel} size="sm" />
                  </View>
                  <Text className="text-xs text-slate-600 leading-5 mb-3">
                    Potensi: {material.potentialUses.join(", ")}
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    <Badge label={`Kesulitan ${material.difficulty || "mudah"}`} variant="neutral" size="sm" />
                    <Badge label={`Nilai ${material.potentialValue || "sedang"}`} variant="brand" size="sm" />
                  </View>
                </View>
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}
