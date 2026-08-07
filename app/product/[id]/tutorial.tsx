import React, { useState } from "react";
import { View, Text, ScrollView, Image, Modal } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Header, Button, Card, LoadingSpinner, FitImage } from "../../../src/components/ui";
import { useProductData } from "../../../src/hooks/useProductData";
import { safeBack } from "../../../src/lib/navigation";
import { ShieldAlert } from "lucide-react-native";

export default function TutorialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { product, tutData, loading, error, refetch } = useProductData(id);

  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [pendingWarning, setPendingWarning] = useState<string | null>(null);

  if (loading) {
    return <LoadingSpinner fullScreen message="Memuat tutorial..." />;
  }

  if (error) {
    return (
      <View className="flex-1 bg-cream-50 items-center justify-center p-6">
        <Text className="text-slate-600 text-center mb-4">Tutorial gagal dimuat.</Text>
        <Button title="Coba Lagi" onPress={() => refetch()} />
      </View>
    );
  }

  if (!product || !tutData) {
    return (
      <View className="flex-1 bg-cream-50 items-center justify-center p-6">
        <Text className="text-slate-600 mb-4">Tutorial tidak ditemukan.</Text>
        <Button title="Kembali ke Beranda" onPress={() => router.replace("/")} />
      </View>
    );
  }

  const handleStepPress = (warning?: string) => {
    if (warning) {
      setPendingWarning(warning);
      setWarningModalVisible(true);
    }
  };

  const tools = tutData.tools ?? [];
  const additionalMaterials = tutData.additionalMaterials ?? [];
  const hasPreparationPanel = Boolean(
    tutData.materialsImageUri || tools.length || additionalMaterials.length
  );

  return (
    <View className="flex-1 bg-cream-50">
      <Header title={`Tutorial: ${product.name}`} onBack={() => safeBack(router)} />

      <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="text-xs text-slate-500 mb-4">
          Langkah 1 dari {tutData.steps.length}
        </Text>

        {/* Stepper */}
        <View className="flex-row items-center mb-6">
          {tutData.steps.map((_, idx) => (
            <View key={idx} className="flex-row items-center flex-1">
              <View className="w-6 h-6 rounded-full bg-brand items-center justify-center">
                <Text className="text-[10px] font-bold text-white">{idx + 1}</Text>
              </View>
              {idx !== tutData.steps.length - 1 && (
                <View className="flex-1 h-0.5 bg-emerald-200 mx-1" />
              )}
            </View>
          ))}
        </View>

        {hasPreparationPanel ? (
          <Card className="p-4 mb-4 border border-slate-100">
            <Text className="text-xs font-semibold text-slate-500">LANGKAH 0</Text>
            <Text className="text-base font-bold text-slate-900 mt-1 mb-1">
              Siapkan Alat & Bahan
            </Text>
            <Text className="text-xs text-slate-500 leading-5 mb-3">
              Pastikan semua kebutuhan berikut sudah siap sebelum mulai membuat.
            </Text>

            {tutData.materialsImageUri ? (
              <FitImage
                source={{ uri: tutData.materialsImageUri }}
                className="rounded-2xl overflow-hidden bg-slate-200 mb-4"
                maxHeight={320}
              />
            ) : null}

            {tools.length > 0 ? (
              <View className="mb-2">
                <Text className="text-xs font-bold text-slate-900 mb-2">Alat</Text>
                {tools.map((tool, idx) => (
                  <View
                    key={`${tool.name}-${idx}`}
                    className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mb-2"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-bold text-slate-900 flex-1">{tool.name}</Text>
                      {tool.optional ? (
                        <Text className="text-[10px] font-semibold text-emerald-700 ml-2">
                          Opsional
                        </Text>
                      ) : null}
                    </View>
                    <Text className="text-[11px] text-slate-500 leading-4 mt-1">
                      {tool.description?.trim() || "Alat pendukung untuk proses pembuatan."}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {additionalMaterials.length > 0 ? (
              <View>
                <Text className="text-xs font-bold text-slate-900 mb-2">Bahan Pelengkap</Text>
                {additionalMaterials.map((material, idx) => (
                  <View
                    key={`${material.name}-${idx}`}
                    className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-2"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-bold text-slate-900 flex-1">
                        {material.name}
                      </Text>
                      <Text className="text-xs font-semibold text-amber-700 ml-2">
                        Rp {material.est_cost_idr.toLocaleString("id-ID")}
                      </Text>
                    </View>
                    <Text className="text-[11px] text-slate-500 leading-4 mt-1">
                      {material.purpose?.trim() || "Bahan pelengkap untuk proyek ini."}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        ) : null}

        {tutData.steps.map((step) => (
          <Card
            key={step.order}
            className="p-4 mb-4 border border-slate-100"
            onPress={step.safetyWarning ? () => handleStepPress(step.safetyWarning) : undefined}
          >
            <View className="flex-row items-start mb-3">
              <View className="w-7 h-7 rounded-full bg-brand items-center justify-center mr-3 mt-0.5">
                <Text className="text-[10px] font-bold text-white">{step.order}</Text>
              </View>
              <View className="flex-1">
                <Text className="font-bold text-slate-900 text-sm mb-1">{step.title}</Text>
                <Text className="text-xs text-slate-600 leading-5">{step.description}</Text>
              </View>
            </View>
            {step.safetyWarning && (
              <View className="flex-row items-center bg-red-50 px-3 py-2 rounded-xl mb-3">
                <ShieldAlert size={14} color="#dc2626" />
                <Text className="text-[10px] font-bold text-red-600 ml-2">Peringatan Keamanan</Text>
              </View>
            )}
            <FitImage
              source={{ uri: step.imageUri }}
              className="rounded-2xl overflow-hidden bg-slate-200"
              maxHeight={360}
            />
          </Card>
        ))}

        <Card className="bg-emerald-50 border-emerald-100 p-4 mb-6">
          <Text className="text-xs text-slate-600 leading-5">
            <Text className="font-bold text-brand-dark">Tips: </Text>
            Gunakan cat akrilik agar tahan lama.
          </Text>
        </Card>

        <Button
          title="Lihat Before & After"
          onPress={() => router.push(`/product/${id}/before-after`)}
          variant="primary"
        />
        <Button
          title="Saya Sudah Selesai"
          onPress={() => router.push(`/product/${id}/complete`)}
          variant="secondary"
          className="mt-3"
        />
      </ScrollView>

      {/* Safety Warning Modal */}
      <Modal visible={warningModalVisible} animationType="fade" transparent={true}>
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm items-center">
            <View className="w-14 h-14 rounded-full bg-red-100 items-center justify-center mb-4">
              <ShieldAlert size={30} color="#dc2626" />
            </View>
            <Text className="text-lg font-bold text-slate-900 text-center mb-2">
              Peringatan Keamanan Pemula
            </Text>
            <Text className="text-xs text-slate-600 text-center leading-5 mb-6">{pendingWarning}</Text>
            <Button
              title="Saya Mengerti & Pakai APD"
              onPress={() => setWarningModalVisible(false)}
              variant="primary"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
