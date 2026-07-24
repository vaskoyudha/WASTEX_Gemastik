import React, { useState } from "react";
import { View, Text, ScrollView, Image, TouchableOpacity, Modal } from "react-native";
import { useRouter } from "expo-router";
import { Header, Button, Card, Badge } from "../../src/components/ui";
import { useScanStore } from "../../src/store/useScanStore";
import { MaterialType } from "../../src/services/types";
import { recommendation } from "../../src/services";
import { safeBack } from "../../src/lib/navigation";
import { Edit3, X, MapPin, BarChart2, TrendingUp, ShieldCheck, ArrowRight } from "lucide-react-native";

const materialTraits: Record<string, string[]> = {
  plastik_pet: ["Ringan", "Tahan Air", "Mudah Dipotong", "Daur Ulang"],
  plastik_hdpe: ["Ringan", "Kokoh", "Tahan Bahan Kimia", "Daur Ulang"],
  kardus: ["Ringan", "Mudah Dilipat", "Biodegradable", "Daur Ulang"],
  kaleng: ["Tahan Lama", "Konduktif", "Mudah Dibentuk", "Daur Ulang"],
  kaca: ["Transparan", "Tahan Lama", "Premium", "Daur Ulang"],
  sachet: ["Lentur", "Tahan Air", "Multilayer", "Daur Ulang"],
};

export default function HasilScreen() {
  const router = useRouter();
  const { imageUri, scanResult, updateScanResultMaterial, setRecommendations } = useScanStore();
  const [modalVisible, setModalVisible] = useState(false);

  if (!scanResult) {
    return (
      <View className="flex-1 bg-white items-center justify-center p-6">
        <Text className="text-slate-600 mb-4">Belum ada hasil scan.</Text>
        <Button title="Kembali ke Upload" onPress={() => router.replace("/scan/upload")} fullWidth={false} />
      </View>
    );
  }

  const handleManualSelect = async (type: MaterialType, label: string) => {
    updateScanResultMaterial(type, label);
    setModalVisible(false);
    const newRecs = await recommendation.getRecommendations({
      ...scanResult,
      materialType: type,
      materialLabel: label,
      confidence: 1.0,
    });
    setRecommendations(newRecs);
  };

  const confidencePct = Math.round(scanResult.confidence * 100);
  const riskLabel =
    scanResult.riskLevel === "aman" ? "Aman" : scanResult.riskLevel === "hati_hati" ? "Hati-hati" : "Berisiko";
  const traits = materialTraits[scanResult.materialType] || materialTraits.plastik_pet;

  const detailRows = [
    { icon: MapPin, label: "Kondisi", value: scanResult.condition },
    { icon: BarChart2, label: "Tingkat Kesulitan", value: scanResult.difficulty || "Mudah" },
    {
      icon: TrendingUp,
      label: "Potensi Nilai",
      value:
        scanResult.potentialValue === "rendah"
          ? "Rendah"
          : scanResult.potentialValue === "tinggi"
          ? "Tinggi"
          : "Sedang",
    },
    { icon: ShieldCheck, label: "Risiko Pengolahan", value: riskLabel, badge: scanResult.riskLevel },
  ];

  return (
    <View className="flex-1 bg-slate-50">
      <Header title="Hasil Analisis AI" onBack={() => safeBack(router)} />

      <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Photo Preview */}
        <Card className="p-0 rounded-3xl overflow-hidden bg-slate-200 mb-5 border-0">
          {imageUri && <Image source={{ uri: imageUri }} className="w-full h-56" resizeMode="cover" />}
          <TouchableOpacity
            onPress={() => router.push("/scan/upload")}
            className="absolute bottom-4 right-4 bg-black/60 px-3 py-1.5 rounded-full flex-row items-center"
          >
            <Edit3 size={12} color="#ffffff" />
            <Text className="text-white text-xs font-semibold ml-1">Edit Foto</Text>
          </TouchableOpacity>
        </Card>

        {/* Material Header */}
        <View className="flex-row items-end justify-between mb-5">
          <View>
            <Text className="text-xs text-slate-500 mb-1">Jenis Material</Text>
            <Text className="text-2xl font-extrabold text-slate-900">{scanResult.materialLabel}</Text>
          </View>
          <View className="items-end">
            <Text className="text-3xl font-extrabold text-brand">{confidencePct}%</Text>
            <Text className="text-[10px] text-slate-400">Tingkat Keyakinan</Text>
          </View>
        </View>

        {/* Detail Rows */}
        <Card className="p-0 mb-5 border border-slate-100 overflow-hidden">
          {detailRows.map((row, idx) => (
            <View
              key={idx}
              className={`flex-row items-center justify-between px-4 py-3.5 ${
                idx !== detailRows.length - 1 ? "border-b border-slate-100" : ""
              }`}
            >
              <View className="flex-row items-center">
                <row.icon size={18} color="#64748b" />
                <Text className="text-sm text-slate-600 ml-3">{row.label}</Text>
              </View>
              {row.badge ? (
                <Badge variant={scanResult.riskLevel} size="sm" className="ml-2" />
              ) : (
                <Text className="text-sm font-semibold text-slate-900 ml-2">{row.value}</Text>
              )}
            </View>
          ))}
        </Card>

        {/* Material Traits */}
        <View className="mb-6">
          <Text className="text-sm font-bold text-slate-900 mb-3">Sifat Material</Text>
          <View className="flex-row flex-wrap gap-2">
            {traits.map((t, idx) => (
              <View key={idx} className="bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                <Text className="text-xs font-semibold text-brand-dark">{t}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Re-scan / Manual Correction */}
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className="flex-row items-center justify-center py-3 px-4 rounded-xl bg-white border border-slate-200 mb-6"
          activeOpacity={0.7}
        >
          <Edit3 size={16} color="#16a34a" />
          <Text className="text-brand-dark font-semibold text-sm ml-2">Bukan material ini? Pilih manual</Text>
        </TouchableOpacity>

        <Button
          title="Lihat Rekomendasi Produk"
          onPress={() => router.push("/scan/rekomendasi")}
          icon={<ArrowRight size={20} color="#ffffff" />}
          variant="primary"
        />
      </ScrollView>

      {/* Manual Selection Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-[32px] p-6 max-h-[70%]">
            <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <Text className="text-lg font-bold text-slate-900">Pilih Material Manual</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} className="p-1">
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { type: "plastik_pet" as MaterialType, label: "Botol Plastik PET" },
                { type: "plastik_hdpe" as MaterialType, label: "Botol Plastik HDPE" },
                { type: "kardus" as MaterialType, label: "Kardus Bekas Kemasan" },
                { type: "kaleng" as MaterialType, label: "Kaleng Minuman / Susu" },
                { type: "kaca" as MaterialType, label: "Botol Kaca Bekas" },
                { type: "sachet" as MaterialType, label: "Kemasan Sachet Multilayer" },
              ].map((item) => (
                <TouchableOpacity
                  key={item.type}
                  onPress={() => handleManualSelect(item.type, item.label)}
                  className="py-3.5 px-4 rounded-xl border border-slate-100 bg-slate-50 mb-3 active:bg-emerald-50"
                  activeOpacity={0.7}
                >
                  <Text className="font-semibold text-slate-800 text-sm">{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
