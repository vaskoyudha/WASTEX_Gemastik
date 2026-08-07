import React, { useEffect, useCallback, useState } from "react";
import { Alert, View, Text, ScrollView, Image, TouchableOpacity, Modal } from "react-native";
import { useRouter } from "expo-router";
import { Header, Button, Card, Badge } from "../../src/components/ui";
import { useScanStore } from "../../src/store/useScanStore";
import { MaterialType } from "../../src/services/types";
import type { Skill } from "../../src/services/types";
import { apiClient } from "../../src/services/api";
import { recommendation } from "../../src/services";
import { safeBack } from "../../src/lib/navigation";
import { useServiceCall } from "../../src/hooks/useServiceCall";
import { Edit3, X, MapPin, BarChart2, TrendingUp, ShieldCheck, ArrowRight, Sparkles, Check, ChevronRight } from "lucide-react-native";
import { colors, gradients, gradientStyle, shadows } from "../../src/theme";

const materialTraits: Record<string, string[]> = {
  plastik_pet: ["Ringan", "Tahan Air", "Mudah Dipotong", "Daur Ulang"],
  plastik_hdpe: ["Ringan", "Kokoh", "Tahan Bahan Kimia", "Daur Ulang"],
  kardus: ["Ringan", "Mudah Dilipat", "Biodegradable", "Daur Ulang"],
  kaleng: ["Tahan Lama", "Konduktif", "Mudah Dibentuk", "Daur Ulang"],
  kaca: ["Transparan", "Tahan Lama", "Premium", "Daur Ulang"],
  sachet: ["Lentur", "Tahan Air", "Multilayer", "Daur Ulang"],
};

interface ManualCorrectionPayload {
  materialType: MaterialType;
  materialLabel: string;
  recommendations: Awaited<ReturnType<typeof recommendation.getRecommendations>>;
}

export default function HasilScreen() {
  const router = useRouter();
  const { imageUri, scanResult, updateScanResultMaterial, setRecommendations } = useScanStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [verifiedSkills, setVerifiedSkills] = useState<Skill[]>([]);

  useEffect(() => {
    if (scanResult?.needsVerification) {
      setModalVisible(true);
    }
  }, [scanResult?.needsVerification]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const skills = (await apiClient.getSkills({
          status: 'approved',
          material: scanResult?.materialType,
        })) as Skill[];
        if (active) setVerifiedSkills(skills.slice(0, 3));
      } catch {
        if (active) setVerifiedSkills([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [scanResult?.materialType]);

  const loadManualRecommendations = useCallback(
    async (type: MaterialType, label: string, currentResult: NonNullable<typeof scanResult>) => {
      const recommendations = await recommendation.getRecommendations({
        ...currentResult,
        materialType: type,
        materialLabel: label,
        confidence: 1.0,
      });

      return {
        materialType: type,
        materialLabel: label,
        recommendations,
      };
    },
    []
  );

  const manualCorrectionCall = useServiceCall<
    ManualCorrectionPayload,
    [MaterialType, string, NonNullable<typeof scanResult>]
  >(loadManualRecommendations, {
    onSuccess: ({ materialType, materialLabel, recommendations }) => {
      updateScanResultMaterial(materialType, materialLabel);
      setRecommendations(recommendations);
      setModalVisible(false);
    },
    onError: () => {
      Alert.alert("Rekomendasi Gagal", "Material belum bisa diperbarui karena rekomendasi gagal dimuat. Coba lagi.");
    },
  });

  if (!scanResult) {
    return (
      <View className="flex-1 bg-cream-50 items-center justify-center p-6">
        <Text className="text-slate-600 mb-4">Belum ada hasil scan.</Text>
        <Button title="Kembali ke Upload" onPress={() => router.replace("/scan/upload")} fullWidth={false} />
      </View>
    );
  }

  const handleManualSelect = async (type: MaterialType, label: string) => {
    await manualCorrectionCall.execute(type, label, scanResult);
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
    <View style={{ flex: 1, backgroundColor: colors.forest900, ...gradientStyle(gradients.home) }}>
      <Header title="Hasil Analisis AI" onBack={() => safeBack(router)} />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, backgroundColor: colors.cream50, ...gradientStyle(gradients.contentSheet) }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 44, gap: 20 }}
      >
        {/* Analysis hero */}
        <Card
          className="p-0 rounded-[28px] overflow-hidden bg-mist-100 border-0"
          style={{ boxShadow: shadows.floating }}
        >
          <View style={{ position: "relative" }}>
            {imageUri && <Image source={{ uri: imageUri }} className="w-full h-[244px]" resizeMode="cover" />}
            <View style={{ position: "absolute", left: 14, top: 14, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(21,37,27,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" }}>
              <Text className="text-[10px] font-bold" style={{ color: colors.white, letterSpacing: 0.4 }}>ANALISIS SELESAI</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/scan/upload")}
              className="absolute bottom-3 right-3 px-3 py-2 rounded-full flex-row items-center"
              style={{ backgroundColor: "rgba(21,37,27,0.84)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" }}
            >
              <Edit3 size={12} color={colors.white} />
              <Text className="text-[11px] font-bold ml-1.5" style={{ color: colors.white }}>Ganti foto</Text>
            </TouchableOpacity>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              justifyContent: "space-between",
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: 20,
              backgroundColor: colors.forest900,
              ...gradientStyle(gradients.navigation),
            }}
          >
            <View style={{ flex: 1, paddingRight: 14 }}>
              <Text className="text-[11px] mb-1.5" style={{ color: "rgba(255,255,255,0.62)" }}>Material terdeteksi</Text>
              <Text className="text-[24px] font-extrabold" style={{ color: colors.white, letterSpacing: -0.8 }}>{scanResult.materialLabel}</Text>
            </View>
            <View className="items-end">
              <Text selectable className="text-[34px] font-extrabold" style={{ color: colors.lime300, fontVariant: ["tabular-nums"], letterSpacing: -1.4 }}>{confidencePct}%</Text>
              <Text className="text-[9px]" style={{ color: "rgba(255,255,255,0.58)" }}>tingkat keyakinan</Text>
            </View>
          </View>
        </Card>

        {/* Low-confidence verification banner */}
        {scanResult.needsVerification && (
          <View style={{ paddingHorizontal: 14, paddingVertical: 12, borderRadius: 17, borderCurve: "continuous", flexDirection: "row", alignItems: "center", backgroundColor: "#F8F2DE", borderWidth: 1, borderColor: "#E8D8A6" }}>
            <ShieldCheck size={16} color="#b45309" />
            <Text className="text-amber-800 text-xs font-semibold ml-2 flex-1">
              Keyakinan AI rendah. Pilih material yang benar agar rekomendasinya akurat.
            </Text>
          </View>
        )}

        {/* Detail Rows */}
        <View>
          <Text className="text-[16px] font-extrabold mb-3" style={{ color: colors.ink900, letterSpacing: -0.35 }}>Ringkasan material</Text>
          <Card className="p-0 border-0 overflow-hidden rounded-[24px]" style={{ backgroundColor: colors.surface, boxShadow: shadows.card }}>
          {detailRows.map((row, idx) => (
            <View
              key={idx}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 15,
                paddingVertical: 14,
                borderBottomWidth: idx !== detailRows.length - 1 ? 1 : 0,
                borderBottomColor: colors.mist100,
              }}
            >
              <View className="flex-row items-center" style={{ flex: 1 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.mist100 }}>
                  <row.icon size={17} color={colors.forest600} />
                </View>
                <Text className="text-sm ml-3" style={{ color: colors.ink600 }}>{row.label}</Text>
              </View>
              {row.badge ? (
                <Badge variant={scanResult.riskLevel} size="sm" className="ml-2" />
              ) : (
                <Text className="text-sm font-semibold ml-2" style={{ color: colors.ink900, maxWidth: "52%", textAlign: "right" }}>{row.value}</Text>
              )}
            </View>
          ))}
          </Card>
        </View>

        {/* Material Traits */}
        <View>
          <Text className="text-[16px] font-extrabold mb-3" style={{ color: colors.ink900, letterSpacing: -0.35 }}>Sifat material</Text>
          <View className="flex-row flex-wrap gap-2">
            {traits.map((t, idx) => (
              <View key={idx} style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.sage200 }}>
                <Text className="text-xs font-semibold" style={{ color: colors.forest600 }}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Re-scan / Manual Correction */}
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className="flex-row items-center justify-center py-3 px-4 rounded-2xl"
          style={{ backgroundColor: "rgba(255,255,255,0.66)", borderWidth: 1, borderColor: colors.sage200 }}
          activeOpacity={0.7}
        >
          <Edit3 size={16} color={colors.forest600} />
          <Text className="font-semibold text-sm ml-2" style={{ color: colors.forest800 }}>Bukan material ini? Pilih manual</Text>
        </TouchableOpacity>

        <View style={{ gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.push("/scan/skill-creator")}
            className="flex-row items-center justify-center py-3 px-4 rounded-2xl"
            style={{ backgroundColor: colors.forest700, ...gradientStyle(gradients.cameraMedallion), boxShadow: shadows.card }}
            activeOpacity={0.7}
          >
            <Sparkles size={16} color="#ffffff" />
            <Text className="text-white font-semibold text-sm ml-2">Buat Skill Baru dari Material Ini</Text>
          </TouchableOpacity>

          <Text className="text-[16px] font-extrabold mt-1" style={{ color: colors.ink900, letterSpacing: -0.35 }}>Skill terverifikasi</Text>
          {verifiedSkills.length === 0 ? (
            <Text className="text-xs" style={{ color: colors.ink600 }}>
              Belum ada skill terverifikasi untuk material ini.
            </Text>
          ) : (
            verifiedSkills.map((skill) => (
              <Card key={skill.id} className="p-4 mb-2 rounded-[20px] border-0" style={{ backgroundColor: colors.surface }}>
                <View className="flex-row items-center">
                  <View className="w-9 h-9 rounded-[14px] items-center justify-center mr-3" style={{ backgroundColor: colors.mist100 }}>
                    <Check size={16} color={colors.forest700} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-extrabold mb-1" style={{ color: colors.ink900 }}>{skill.title}</Text>
                    <Text className="text-[10px] font-semibold" style={{ color: colors.forest600 }}>{skill.difficulty}</Text>
                  </View>
                  <ChevronRight size={18} color={colors.ink400} />
                </View>
              </Card>
            ))
          )}
        </View>

        <Button
          title="Lihat Rekomendasi Produk"
          onPress={() => router.push("/scan/rekomendasi")}
          icon={<ArrowRight size={20} color="#ffffff" />}
          variant="primary"
        />
      </ScrollView>

      {/* Manual Selection Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(22,32,24,0.58)" }}>
          <View accessibilityViewIsModal style={{ maxHeight: "74%", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: colors.cream50, ...gradientStyle(gradients.contentSheet), boxShadow: shadows.floating }}>
            <View style={{ width: 42, height: 5, borderRadius: 99, backgroundColor: colors.sage300, alignSelf: "center", marginBottom: 13 }} />
            <View className="flex-row justify-between items-center mb-4 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: colors.mist100 }}>
              <Text className="text-lg font-bold" style={{ color: colors.ink900 }}>
                {scanResult.needsVerification ? "Verifikasi Material" : "Pilih Material Manual"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{ width: 38, height: 38, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.mist100 }}>
                <X size={21} color={colors.ink600} />
              </TouchableOpacity>
            </View>
            {manualCorrectionCall.loading && (
              <Text className="text-xs font-semibold text-brand-dark mb-3">Memuat rekomendasi baru...</Text>
            )}
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { type: "plastik_pet" as MaterialType, label: "Botol Plastik PET" },
                { type: "plastik_hdpe" as MaterialType, label: "Botol Plastik HDPE" },
                { type: "kardus" as MaterialType, label: "Kardus Bekas Kemasan" },
                { type: "kaleng" as MaterialType, label: "Kaleng Minuman / Susu" },
                { type: "kaca" as MaterialType, label: "Botol Kaca Bekas" },
                { type: "sachet" as MaterialType, label: "Kemasan Sachet Multilayer" },
              ].map((item) => {
                const selected = item.type === scanResult.materialType;
                return (
                <TouchableOpacity
                  key={item.type}
                  disabled={manualCorrectionCall.loading}
                  onPress={() => handleManualSelect(item.type, item.label)}
                  className={`py-3.5 px-4 rounded-2xl mb-3 ${manualCorrectionCall.loading ? "opacity-60" : ""}`}
                  style={{ backgroundColor: selected ? colors.forest900 : manualCorrectionCall.loading ? colors.mist100 : colors.surface, borderWidth: 1, borderColor: selected ? colors.forest900 : colors.mist100 }}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="font-bold text-sm" style={{ color: selected ? colors.white : colors.ink900 }}>{item.label}</Text>
                    {selected ? <Check size={17} color={colors.lime300} /> : <ChevronRight size={17} color={colors.ink400} />}
                  </View>
                </TouchableOpacity>
              );})}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
