import React, { useCallback, useState } from "react";
import { View, Text, Image, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Header, Card, LoadingSpinner, PressableScale } from "../../src/components/ui";
import { scanner, recommendation } from "../../src/services";
import { useScanStore } from "../../src/store/useScanStore";
import { safeBack } from "../../src/lib/navigation";
import { useServiceCall } from "../../src/hooks/useServiceCall";
import { ProductRecommendation, ScanResult } from "../../src/services/types";
import {
  Camera,
  Image as ImageIcon,
  Upload,
  Sparkles,
  RefreshCw,
  Lightbulb,
  Box,
  Package,
  GlassWater,
  Layers,
  MoreHorizontal,
} from "lucide-react-native";
import { colors, gradients, gradientStyle, radii, shadows } from "../../src/theme";

const supportedMaterials = [
  { label: "Plastik", icon: Box },
  { label: "Kaleng", icon: Package },
  { label: "Kaca", icon: GlassWater },
  { label: "Sachet", icon: Layers },
  { label: "Dll", icon: MoreHorizontal },
];

interface AnalyzePayload {
  photoUri: string;
  scanResult: ScanResult;
  recommendations: ProductRecommendation[];
}

export default function UploadScreen() {
  const [image, setImage] = useState<string | null>(null);
  const router = useRouter();

  const { setImageUri, setScanResult, setRecommendations } = useScanStore();

  const analyzePhoto = useCallback(async (photoUri: string): Promise<AnalyzePayload> => {
    const scanResult = await scanner.scan(photoUri);
    const recommendations = await recommendation.getRecommendations(scanResult);

    return {
      photoUri,
      scanResult,
      recommendations,
    };
  }, []);

  const analyzeCall = useServiceCall<AnalyzePayload, [string]>(analyzePhoto, {
    onSuccess: (payload) => {
      setImageUri(payload.photoUri);
      setScanResult(payload.scanResult);
      setRecommendations(payload.recommendations);
      router.push("/scan/hasil");
    },
    onError: () => {
      Alert.alert("Analisis Gagal", "Terjadi kesalahan saat memindai foto. Silakan coba lagi.");
    },
  });

  const pickImage = async (mode: "camera" | "gallery") => {
    try {
      let result;
      if (mode === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Izin Ditolak", "Butuh izin akses kamera untuk mengambil foto sampah.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0].uri) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("ImagePicker failed:", error);
      Alert.alert("Gagal Membuka Galeri", "Tidak dapat membuka pemilih foto. Coba lagi.");
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;
    await analyzeCall.execute(image);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest900, ...gradientStyle(gradients.home) }}>
      <Header title="Upload Sampah" onBack={() => safeBack(router)} />

      {analyzeCall.loading ? (
        <LoadingSpinner fullScreen message="AI Upcycling Agent sedang menganalisis material & risiko keamanan..." />
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          style={{ flex: 1, backgroundColor: colors.cream50, ...gradientStyle(gradients.contentSheet), borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
          contentContainerStyle={{ padding: 20, paddingTop: 24, paddingBottom: 48, gap: 24 }}
        >
          <View style={{ alignItems: "center", paddingHorizontal: 16, gap: 5 }}>
            <Text style={{ color: colors.ink900, fontFamily: "Inter_700Bold", fontSize: 17, letterSpacing: -0.25 }}>
              Mulai dari satu foto
            </Text>
            <Text className="text-xs text-center leading-5" style={{ color: colors.ink600 }}>
              Pastikan material terlihat jelas agar hasil analisis lebih akurat.
            </Text>
          </View>

          {/* Upload Box */}
          {image ? (
            <Card
              className="w-full rounded-[26px] overflow-hidden p-0 border-0 bg-mist-100"
              style={{ boxShadow: shadows.floating }}
            >
              <Image source={{ uri: image }} className="w-full h-72" resizeMode="cover" />
              <PressableScale
                onPress={() => setImage(null)}
                accessibilityLabel="Ganti foto"
                style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  height: 42,
                  paddingHorizontal: 13,
                  borderRadius: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  backgroundColor: "rgba(38,54,42,0.78)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.16)",
                }}
              >
                <RefreshCw size={16} color="#ffffff" />
                <Text style={{ color: colors.white, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>Ganti foto</Text>
              </PressableScale>
            </Card>
          ) : (
            <View
              style={{
                width: "100%",
                borderRadius: 26,
                borderCurve: "continuous",
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.11)",
                backgroundColor: colors.forest700,
                ...gradientStyle(gradients.impact),
                padding: 18,
                gap: 18,
                boxShadow: shadows.floating,
              }}
            >
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  width: 154,
                  height: 154,
                  borderRadius: 77,
                  right: -54,
                  top: -65,
                  backgroundColor: "rgba(220,245,167,0.12)",
                }}
              />

              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 17,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.lime300,
                    ...gradientStyle(gradients.scanButton),
                    boxShadow: "0 5px 13px rgba(42,63,43,0.16)",
                  }}
                >
                  <Upload size={22} color={colors.forest900} strokeWidth={2} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ color: colors.white, fontFamily: "Inter_700Bold", fontSize: 17, letterSpacing: -0.25 }}>
                    Tambahkan foto sampah
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.68)", fontSize: 11 }}>
                    Pilih sumber foto untuk mulai memindai
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <PressableScale
                  onPress={() => pickImage("camera")}
                  accessibilityLabel="Ambil foto dengan kamera"
                  style={{
                    flex: 1,
                    height: 92,
                    borderRadius: 19,
                    borderCurve: "continuous",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 9,
                    backgroundColor: "rgba(211,225,204,0.14)",
                    ...gradientStyle(gradients.actionTile),
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.1)",
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(222,235,215,0.14)",
                      ...gradientStyle(gradients.actionIcon),
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    <Camera size={18} color={colors.cream50} strokeWidth={1.8} />
                  </View>
                  <Text style={{ color: colors.cream50, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>Kamera</Text>
                </PressableScale>

                <PressableScale
                  onPress={() => pickImage("gallery")}
                  accessibilityLabel="Pilih foto dari galeri"
                  style={{
                    flex: 1,
                    height: 92,
                    borderRadius: 19,
                    borderCurve: "continuous",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 9,
                    backgroundColor: "rgba(211,225,204,0.14)",
                    ...gradientStyle(gradients.actionTile),
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.1)",
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(222,235,215,0.14)",
                      ...gradientStyle(gradients.actionIcon),
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    <ImageIcon size={18} color={colors.cream50} strokeWidth={1.8} />
                  </View>
                  <Text style={{ color: colors.cream50, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>Galeri</Text>
                </PressableScale>
              </View>
            </View>
          )}

          {/* Supported Materials */}
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text className="text-sm font-bold" style={{ color: colors.ink900 }}>Material yang didukung</Text>
              <Text style={{ color: colors.ink400, fontSize: 10 }}>5 kategori</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
              {supportedMaterials.map((m) => (
                <View
                  key={m.label}
                  style={{
                    width: 66,
                    height: 78,
                    borderRadius: 19,
                    borderCurve: "continuous",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    backgroundColor: "rgba(255,255,255,0.66)",
                    borderWidth: 1,
                    borderColor: colors.mist100,
                  }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.mist100 }}>
                    <m.icon size={17} color={colors.forest600} strokeWidth={1.8} />
                  </View>
                  <Text className="text-[10px] text-center" style={{ color: colors.ink600 }} numberOfLines={1}>{m.label}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Tip Card */}
          <Card
            className="p-4 flex-row items-start rounded-[22px] border-0"
            style={{ backgroundColor: "rgba(255,255,255,0.68)", boxShadow: shadows.card }}
          >
            <View style={{ width: 38, height: 38, borderRadius: 15, alignItems: "center", justifyContent: "center", marginRight: 12, backgroundColor: colors.sage200 }}>
              <Lightbulb size={18} color={colors.forest600} strokeWidth={1.8} />
            </View>
            <View className="flex-1" style={{ gap: 3 }}>
              <Text className="text-xs font-bold" style={{ color: colors.forest800 }}>Tips foto terbaik</Text>
              <Text className="text-[11px] leading-4" style={{ color: colors.ink600 }}>
                Pastikan objek terlihat jelas, tidak blur, dan pencahayaan cukup.
              </Text>
            </View>
          </Card>

          {image && (
            <PressableScale
                onPress={handleAnalyze}
                accessibilityLabel="Analisis sampah sekarang"
                style={{
                  height: 54,
                  borderRadius: 18,
                  borderCurve: "continuous",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 9,
                  backgroundColor: colors.forest700,
                  ...gradientStyle(gradients.cameraMedallion),
                  boxShadow: shadows.card,
                }}
              >
                <Sparkles size={18} color={colors.white} />
                <Text style={{ color: colors.white, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                  Analisis Sampah Sekarang
                </Text>
              </PressableScale>
          )}
        </ScrollView>
      )}
    </View>
  );
}
