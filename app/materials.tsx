import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Box, GlassWater, Layers, Package, Recycle } from "lucide-react-native";
import { Header, Card, Badge } from "../src/components/ui";
import { MaterialType, RiskLevel, Difficulty } from "../src/services/types";
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

const MATERIAL_INFO: Record<MaterialType, {
  label: string;
  riskLevel: RiskLevel;
  difficulty: Difficulty;
  potentialValue: string;
  potentialUses: string[];
}> = {
  plastik_pet: { label: "Botol Plastik PET", riskLevel: "aman", difficulty: "mudah", potentialValue: "sedang", potentialUses: ["Pot Tanaman Gantung", "Vas Dekoratif", "Wadah Hidroponik"] },
  plastik_hdpe: { label: "Botol Plastik HDPE", riskLevel: "aman", difficulty: "mudah", potentialValue: "sedang", potentialUses: ["Sudu Tanaman", "Tempat Pensil Karakter", "Gantungan Serbaguna"] },
  kardus: { label: "Kardus", riskLevel: "aman", difficulty: "mudah", potentialValue: "sedang", potentialUses: ["Rak Serbaguna", "Tempat Penyimpanan", "Mainan Edukasi"] },
  kaleng: { label: "Kaleng", riskLevel: "hati_hati", difficulty: "sedang", potentialValue: "tinggi", potentialUses: ["Pot Tanaman Hidroponik", "Tempat Penyimpanan", "Dekorasi Rumah"] },
  kaca: { label: "Kaca", riskLevel: "berisiko", difficulty: "sulit", potentialValue: "tinggi", potentialUses: ["Vas Bunga", "Lampu Hias", "Tempat Aroma Terapi"] },
  sachet: { label: "Sachet", riskLevel: "hati_hati", difficulty: "sedang", potentialValue: "sedang", potentialUses: ["Tas Belanja", "Dompet Kecil", "Tempat Pensil"] },
};

export default function MaterialsScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-slate-50">
      <Header title="Material Didukung" subtitle="Jenis sampah yang bisa dianalisis" onBack={() => safeBack(router)} />
      <ScrollView className="flex-1 px-5 pt-5" contentContainerStyle={{ paddingBottom: 32 }}>
        {materialOrder.map((key) => {
          const material = MATERIAL_INFO[key];
          const Icon = materialIcons[key];
          return (
            <Card key={key} className="p-4 mb-4 border border-slate-100">
              <View className="flex-row items-start">
                <View className="w-12 h-12 rounded-2xl bg-emerald-50 items-center justify-center mr-4">
                  <Icon size={23} color="#16a34a" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-base font-bold text-slate-900 flex-1 pr-3">{material.label}</Text>
                    <Badge variant={material.riskLevel} size="sm" />
                  </View>
                  <Text className="text-xs text-slate-600 leading-5 mb-3">
                    Potensi: {material.potentialUses.join(", ")}
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    <Badge label={`Kesulitan ${material.difficulty}`} variant="neutral" size="sm" />
                    <Badge label={`Nilai ${material.potentialValue}`} variant="brand" size="sm" />
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
