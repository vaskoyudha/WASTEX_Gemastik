import React, { useState } from "react";
import { View, Text, ScrollView, Modal, TouchableOpacity, Image, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Header, Button, Card, LoadingSpinner, FitImage } from "../../../src/components/ui";
import { useProductData } from "../../../src/hooks/useProductData";
import { safeBack } from "../../../src/lib/navigation";
import { ArrowRight, Check, PackageOpen, ShieldAlert, Wrench } from "lucide-react-native";
import { colors, gradients, gradientStyle, shadows } from "../../../src/theme";

export default function TutorialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { height: screenHeight } = useWindowDimensions();
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
    <View style={{ flex: 1, backgroundColor: "#F8F8F2" }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, backgroundColor: "transparent" }}
        contentContainerStyle={{ minHeight: screenHeight }}
      >
        <Image
          source={require("../../../assets/images/upload-screen-bg.png")}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          style={{ position: "absolute", top: -128, left: 0, width: "100%", height: screenHeight }}
        />
        <Header
          title={`Tutorial: ${product.name}`}
          onBack={() => safeBack(router)}
          transparent
          contentColor={colors.white}
        />

        <View
          style={{
            paddingHorizontal: 18,
            paddingTop: 18,
            paddingBottom: 46,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderCurve: "continuous",
            backgroundColor: colors.cream50,
            ...gradientStyle(gradients.contentSheet),
          }}
        >
        <View
          style={{
            padding: 18,
            borderRadius: 24,
            borderCurve: "continuous",
            marginBottom: 18,
            backgroundColor: "#2B7748",
            ...gradientStyle(gradients.uploadAnalyze),
            borderWidth: 1,
            borderColor: "rgba(190,232,120,0.24)",
            boxShadow: "0 9px 22px rgba(20,69,39,0.22)",
          }}
        >
          <View className="flex-row items-end justify-between mb-4">
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text className="text-[11px] mb-1" style={{ color: "rgba(255,255,255,0.62)" }}>Panduan membuat</Text>
              <Text className="text-[19px] font-extrabold" numberOfLines={2} style={{ color: colors.white, letterSpacing: -0.55 }}>{product.name}</Text>
            </View>
            <Text className="text-xs font-bold" style={{ color: colors.lime300 }}>{tutData.steps.length} tahap</Text>
          </View>
          <View className="flex-row items-center">
            {tutData.steps.map((_, idx) => (
              <View key={idx} className="flex-row items-center flex-1">
                <View
                  className="w-7 h-7 rounded-full items-center justify-center"
                  style={{ backgroundColor: idx === 0 ? colors.lime300 : "rgba(255,255,255,0.13)", borderWidth: 1, borderColor: idx === 0 ? colors.lime300 : "rgba(255,255,255,0.18)" }}
                >
                  <Text className="text-[10px] font-extrabold" style={{ color: idx === 0 ? colors.forest950 : colors.white }}>{idx + 1}</Text>
                </View>
                {idx !== tutData.steps.length - 1 && <View className="flex-1 h-px mx-1" style={{ backgroundColor: "rgba(255,255,255,0.20)" }} />}
              </View>
            ))}
          </View>
        </View>

        {hasPreparationPanel ? (
          <Card className="p-0 mb-6 border-0 overflow-hidden" style={{ backgroundColor: colors.surface, boxShadow: shadows.floating }}>
            <View style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14 }}>
            <View className="w-10 h-10 rounded-[16px] items-center justify-center mb-4" style={{ backgroundColor: colors.mist100 }}>
              <PackageOpen size={19} color={colors.forest700} />
            </View>
            <Text className="text-[20px] font-extrabold mb-1" style={{ color: colors.ink900, letterSpacing: -0.55 }}>
              Siapkan Alat & Bahan
            </Text>
            <Text className="text-xs leading-5" style={{ color: colors.ink600 }}>
              Pastikan semua kebutuhan berikut sudah siap sebelum mulai membuat.
            </Text>
            </View>

            {tutData.materialsImageUri ? (
              <FitImage
                source={{ uri: tutData.materialsImageUri }}
                className="overflow-hidden bg-mist-100"
                maxHeight={320}
              />
            ) : null}

            {tools.length > 0 ? (
              <View style={{ padding: 18 }}>
                <View className="flex-row items-center mb-3">
                  <Wrench size={15} color={colors.forest700} />
                  <Text className="text-xs font-extrabold ml-2" style={{ color: colors.ink900 }}>Alat yang dibutuhkan</Text>
                </View>
                {tools.map((tool, idx) => (
                  <View
                    key={`${tool.name}-${idx}`}
                    className="flex-row items-start py-3"
                    style={{ borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: colors.mist100 }}
                  >
                    <View className="w-7 h-7 rounded-full items-center justify-center mr-3 mt-0.5" style={{ backgroundColor: colors.mist100 }}>
                      <Text className="text-[10px] font-extrabold" style={{ color: colors.forest700 }}>{idx + 1}</Text>
                    </View>
                    <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-extrabold flex-1" style={{ color: colors.ink900 }}>{tool.name}</Text>
                      {tool.optional ? (
                        <Text className="text-[10px] font-semibold ml-2" style={{ color: colors.forest600 }}>
                          Opsional
                        </Text>
                      ) : null}
                    </View>
                    <Text className="text-[11px] leading-4 mt-1" style={{ color: colors.ink600 }}>
                      {tool.description?.trim() || "Alat pendukung untuk proses pembuatan."}
                    </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {additionalMaterials.length > 0 ? (
              <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}>
                <Text className="text-xs font-extrabold mb-2" style={{ color: colors.ink900 }}>Bahan pelengkap</Text>
                {additionalMaterials.map((material, idx) => (
                  <View
                    key={`${material.name}-${idx}`}
                    className="rounded-[16px] px-4 py-3 mb-2"
                    style={{ backgroundColor: colors.mist50, borderWidth: 1, borderColor: colors.mist100 }}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-extrabold flex-1" style={{ color: colors.ink900 }}>
                        {material.name}
                      </Text>
                      <Text className="text-xs font-bold ml-2" style={{ color: colors.forest700 }}>
                        Rp {material.est_cost_idr.toLocaleString("id-ID")}
                      </Text>
                    </View>
                    <Text className="text-[11px] leading-4 mt-1" style={{ color: colors.ink600 }}>
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
            className="p-0 mb-5 border-0 overflow-hidden"
            style={{ backgroundColor: colors.surface, boxShadow: shadows.card }}
            onPress={step.safetyWarning ? () => handleStepPress(step.safetyWarning) : undefined}
          >
            <View className="flex-row items-start p-[18px]">
              <View className="w-9 h-9 rounded-[14px] items-center justify-center mr-3 mt-0.5" style={{ backgroundColor: colors.forest900 }}>
                <Text className="text-xs font-extrabold" style={{ color: colors.lime300 }}>{step.order}</Text>
              </View>
              <View className="flex-1">
                <Text className="font-extrabold text-[15px] mb-1" style={{ color: colors.ink900, letterSpacing: -0.25 }}>{step.title}</Text>
                <Text className="text-xs leading-5" style={{ color: colors.ink600 }}>{step.description}</Text>
              </View>
            </View>
            {step.safetyWarning && (
              <View className="flex-row items-center mx-[18px] mb-4 px-3 py-2.5 rounded-[14px]" style={{ backgroundColor: "#FFF3EB", borderWidth: 1, borderColor: "#F4D5BE" }}>
                <ShieldAlert size={14} color="#dc2626" />
                <Text className="text-[10px] font-bold text-red-600 ml-2">Peringatan Keamanan</Text>
              </View>
            )}
            <FitImage
              source={{ uri: step.imageUri }}
              className="overflow-hidden bg-mist-100"
              maxHeight={360}
            />
          </Card>
        ))}

        <Card className="border-0 p-4 mb-6" style={{ backgroundColor: colors.mist100 }}>
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.surface }}>
              <Check size={15} color={colors.forest700} />
            </View>
          <Text className="text-xs leading-5 flex-1" style={{ color: colors.ink700 }}>
            <Text className="font-extrabold" style={{ color: colors.forest900 }}>Tips: </Text>
            Gunakan cat akrilik agar tahan lama.
          </Text>
          </View>
        </Card>

        <TouchableOpacity
          onPress={() => router.push(`/product/${id}/before-after`)}
          activeOpacity={0.84}
          accessibilityRole="button"
          accessibilityLabel="Lihat Before & After"
          style={{
            minHeight: 58,
            borderRadius: 18,
            borderCurve: "continuous",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            backgroundColor: "#2B7748",
            ...gradientStyle(gradients.uploadAnalyze),
            borderWidth: 1,
            borderColor: "rgba(190,232,120,0.24)",
            boxShadow: "0 8px 20px rgba(20,69,39,0.22)",
          }}
        >
          <ArrowRight size={20} color={colors.white} />
          <Text style={{ color: colors.white, fontFamily: "Manrope_600SemiBold", fontSize: 16 }}>
            Lihat Before & After
          </Text>
        </TouchableOpacity>
        <Button
          title="Saya Sudah Selesai"
          onPress={() => router.push(`/product/${id}/complete`)}
          variant="secondary"
          className="mt-3"
        />
        </View>
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
