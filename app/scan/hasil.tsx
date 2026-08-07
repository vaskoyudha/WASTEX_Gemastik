import React, { useEffect, useCallback, useState } from "react";
import { Alert, View, Text, ScrollView, Image, TouchableOpacity, Modal, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Header, Button } from "../../src/components/ui";
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
  const { height: screenHeight } = useWindowDimensions();
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

  const difficultyLabel =
    scanResult.difficulty === "sulit"
      ? "Sulit"
      : scanResult.difficulty === "sedang"
        ? "Sedang"
        : "Mudah";
  const potentialLabel =
    scanResult.potentialValue === "rendah"
      ? "Rendah"
      : scanResult.potentialValue === "tinggi"
        ? "Tinggi"
        : "Sedang";

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F8F2" }}>
      <ScrollView
        testID="analysis-results-scroll"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, backgroundColor: "transparent" }}
        contentContainerStyle={{ minHeight: screenHeight }}
      >
        <Image
          source={require("../../assets/images/upload-screen-bg.png")}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          style={{ position: "absolute", top: -128, left: 0, width: "100%", height: screenHeight }}
        />
        <Header title="Hasil Analisis AI" onBack={() => safeBack(router)} transparent contentColor={colors.white} />
        <View style={{ paddingHorizontal: 24, paddingTop: 48, paddingBottom: 48, gap: 24 }}>
        {/* Full-bleed analysis portrait */}
        <View
          style={{
            height: 384,
            marginHorizontal: -12,
            borderRadius: 30,
            borderCurve: "continuous",
            overflow: "hidden",
            backgroundColor: colors.forest900,
            boxShadow: shadows.floating,
          }}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, ...gradientStyle(gradients.navigation) }} />
          )}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              inset: 0,
              ...gradientStyle(
                "linear-gradient(180deg, rgba(7,16,11,0.36) 0%, rgba(7,16,11,0.02) 32%, rgba(0,0,0,0.08) 45%, rgba(0,0,0,0.48) 72%, rgba(0,0,0,0.98) 100%)",
              ),
            }}
          />

          <View style={{ position: "absolute", left: 16, top: 16, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(21,37,27,0.72)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}>
            <View className="flex-row items-center">
              <Check size={12} color={colors.lime300} />
              <Text className="text-[10px] font-bold ml-1.5" style={{ color: colors.white, letterSpacing: 0.25 }}>Analisis selesai</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.push("/scan/upload")}
            className="absolute top-4 right-4 px-3 py-2 rounded-full flex-row items-center"
            style={{ backgroundColor: "rgba(21,37,27,0.72)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}
            activeOpacity={0.82}
          >
            <Edit3 size={12} color={colors.white} />
            <Text className="text-[11px] font-bold ml-1.5" style={{ color: colors.white }}>Ganti foto</Text>
          </TouchableOpacity>

          <View style={{ position: "absolute", left: 20, right: 20, bottom: 20 }}>
            <Text className="text-[11px] font-semibold mb-2" style={{ color: "rgba(255,255,255,0.64)", letterSpacing: 0.2 }}>Material terdeteksi</Text>
            <View className="flex-row items-end justify-between">
              <Text
                selectable
                className="text-[27px] leading-[32px] font-extrabold"
                style={{ color: colors.white, letterSpacing: -1, flex: 1, paddingRight: 18 }}
              >
                {scanResult.materialLabel}
              </Text>
              <View className="items-end" style={{ paddingBottom: 2 }}>
                <Text selectable className="text-[42px] leading-[44px] font-extrabold" style={{ color: colors.lime300, fontVariant: ["tabular-nums"], letterSpacing: -2 }}>{confidencePct}%</Text>
                <Text className="text-[9px] font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>keyakinan AI</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Low-confidence verification banner */}
        {scanResult.needsVerification && (
          <View style={{ paddingHorizontal: 14, paddingVertical: 12, borderRadius: 17, borderCurve: "continuous", flexDirection: "row", alignItems: "center", backgroundColor: "#F8F2DE", borderWidth: 1, borderColor: "#E8D8A6" }}>
            <ShieldCheck size={16} color="#b45309" />
            <Text className="text-amber-800 text-xs font-semibold ml-2 flex-1">
              Keyakinan AI rendah. Pilih material yang benar agar rekomendasinya akurat.
            </Text>
          </View>
        )}

        {/* Editorial material summary */}
        <View style={{ gap: 12 }}>
          <Text className="text-[19px] font-extrabold" style={{ color: colors.ink900, letterSpacing: -0.55 }}>Tentang material ini</Text>
          <View
            style={{
              padding: 18,
              borderRadius: 22,
              borderCurve: "continuous",
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: "rgba(41,73,54,0.08)",
              boxShadow: "0 8px 24px rgba(31,63,42,0.09)",
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
            }}
          >
            <View style={{ width: 48, height: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.mist100 }}>
              <MapPin size={24} color={colors.forest700} />
            </View>
            <View style={{ flex: 1, gap: 9 }}>
              <Text className="text-[11px] font-bold" style={{ color: colors.forest600 }}>Kondisi terdeteksi</Text>
              <Text selectable className="text-[15px] leading-[22px] font-semibold" style={{ color: colors.ink900, letterSpacing: -0.16 }}>
                {scanResult.condition}
              </Text>
            </View>
          </View>

          <View className="flex-row" style={{ gap: 10 }}>
            <View style={{ flex: 1, minHeight: 112, padding: 14, borderRadius: 21, borderCurve: "continuous", flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.mist100, boxShadow: "0 8px 24px rgba(31,63,42,0.09)" }}>
              <View style={{ width: 48, height: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.mist100 }}>
                <BarChart2 size={25} color={colors.forest700} />
              </View>
              <View style={{ flex: 1 }}>
                <Text className="text-[10px] font-semibold mb-1" style={{ color: colors.ink400 }}>Kesulitan</Text>
                <Text selectable className="text-[18px] font-extrabold" style={{ color: colors.ink900, letterSpacing: -0.4 }}>{difficultyLabel}</Text>
              </View>
            </View>
            <View style={{ flex: 1, minHeight: 112, padding: 14, borderRadius: 21, borderCurve: "continuous", flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.mist100, boxShadow: "0 8px 24px rgba(31,63,42,0.09)" }}>
              <View style={{ width: 48, height: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.mist100 }}>
                <TrendingUp size={25} color={colors.forest700} />
              </View>
              <View style={{ flex: 1 }}>
                <Text className="text-[10px] font-semibold mb-1" style={{ color: colors.ink400 }}>Potensi nilai</Text>
                <Text selectable className="text-[18px] font-extrabold" style={{ color: colors.ink900, letterSpacing: -0.4 }}>{potentialLabel}</Text>
              </View>
            </View>
          </View>

          <View style={{ minHeight: 64, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 19, borderCurve: "continuous", flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.mist100, boxShadow: "0 8px 24px rgba(31,63,42,0.09)" }}>
            <View style={{ width: 44, height: 44, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.mist100 }}>
              <ShieldCheck size={22} color={scanResult.riskLevel === "aman" ? colors.forest700 : "#A46212"} />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-[10px] font-semibold" style={{ color: colors.ink600 }}>Risiko pengolahan</Text>
              <Text selectable className="text-sm font-extrabold mt-0.5" style={{ color: scanResult.riskLevel === "aman" ? colors.forest900 : "#8A4E0B" }}>{riskLabel}</Text>
            </View>
            <Text className="text-[10px] font-semibold" style={{ color: colors.ink400 }}>Ikuti panduan</Text>
          </View>
        </View>

        {/* Material Traits */}
        <View>
          <Text className="text-[19px] font-extrabold mb-3" style={{ color: colors.ink900, letterSpacing: -0.55 }}>Karakter material</Text>
          <View className="flex-row flex-wrap gap-2">
            {traits.map((t, idx) => (
              <View key={idx} style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: "transparent", borderWidth: 1, borderColor: colors.sage300 }}>
                <Text className="text-xs font-bold" style={{ color: colors.forest700 }}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Correction is intentionally quiet so it does not compete with the next action. */}
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className="flex-row items-center justify-center py-2 px-4"
          activeOpacity={0.72}
        >
          <Edit3 size={15} color={colors.forest600} />
          <Text className="font-bold text-xs ml-2" style={{ color: colors.forest700 }}>Bukan material ini? Koreksi hasil</Text>
        </TouchableOpacity>

        <View style={{ gap: 14 }}>
          <TouchableOpacity
            onPress={() => router.push("/scan/skill-creator")}
            style={{ minHeight: 92, flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 23, borderCurve: "continuous", backgroundColor: "#2B7748", ...gradientStyle(gradients.uploadAnalyze), borderWidth: 1, borderColor: "rgba(190,232,120,0.24)", boxShadow: "0 9px 22px rgba(20,69,39,0.22)" }}
            activeOpacity={0.84}
          >
            <View style={{ width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.lime300 }}>
              <Sparkles size={19} color={colors.forest900} />
            </View>
            <View className="flex-1 ml-3.5">
              <Text className="font-extrabold text-[15px]" style={{ color: colors.white, letterSpacing: -0.25 }}>Buat skill baru</Text>
              <Text className="text-[11px] leading-4 mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>Kembangkan ide lain bersama AI</Text>
            </View>
            <ChevronRight size={20} color={colors.lime300} />
          </TouchableOpacity>

          <Text className="text-[19px] font-extrabold mt-2" style={{ color: colors.ink900, letterSpacing: -0.55 }}>Skill terverifikasi</Text>
          {verifiedSkills.length === 0 ? (
            <Text className="text-xs" style={{ color: colors.ink600 }}>
              Belum ada skill terverifikasi untuk material ini.
            </Text>
          ) : (
            <View style={{ borderRadius: 23, borderCurve: "continuous", overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.mist100 }}>
              {verifiedSkills.map((skill, index) => (
                <View key={skill.id} className="flex-row items-center px-4 py-3.5" style={{ borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.mist100 }}>
                  <View className="w-9 h-9 rounded-[14px] items-center justify-center mr-3" style={{ backgroundColor: colors.mist100 }}>
                    <Check size={15} color={colors.forest700} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[13px] font-extrabold" style={{ color: colors.ink900 }}>{skill.title}</Text>
                    <Text className="text-[10px] font-semibold mt-0.5" style={{ color: colors.forest600 }}>{skill.difficulty}</Text>
                  </View>
                  <ChevronRight size={18} color={colors.ink400} />
                </View>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={() => router.push("/scan/rekomendasi")}
          activeOpacity={0.84}
          accessibilityRole="button"
          accessibilityLabel="Lihat Rekomendasi Produk"
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
            Lihat Rekomendasi Produk
          </Text>
        </TouchableOpacity>
        </View>
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
