import React, { useState } from "react";
import { View, Text, ScrollView, Image, Modal } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Header, Button, Card, LoadingSpinner } from "../../../src/components/ui";
import { useProductData } from "../../../src/hooks/useProductData";
import { ShieldAlert } from "lucide-react-native";

export default function TutorialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { product, tutData, loading } = useProductData(id);

  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [pendingWarning, setPendingWarning] = useState<string | null>(null);

  if (loading) {
    return <LoadingSpinner fullScreen message="Memuat tutorial..." />;
  }

  if (!product || !tutData) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center p-6">
        <Text className="text-slate-600 mb-4">Tutorial tidak ditemukan.</Text>
        <Button title="Kembali" onPress={() => router.back()} />
      </View>
    );
  }

  const handleStepPress = (warning?: string) => {
    if (warning) {
      setPendingWarning(warning);
      setWarningModalVisible(true);
    }
  };

  return (
    <View className="flex-1 bg-slate-50">
      <Header title={`Tutorial: ${product.name}`} onBack={() => router.back()} />

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

        {tutData.steps.map((step) => (
          <Card
            key={step.order}
            className="p-4 mb-4 border border-slate-100"
            onPress={() => handleStepPress(step.safetyWarning)}
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
            <Image source={{ uri: step.imageUri }} className="w-full h-40 rounded-2xl bg-slate-200" />
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
