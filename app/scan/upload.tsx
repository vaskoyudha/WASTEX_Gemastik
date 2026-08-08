import React, { useCallback, useState } from "react";
import { View, Text, Image, Alert, ScrollView, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PressableScale } from "../../src/components/ui";
import { AnalysisLoadingView } from "../../src/features/scan/analysis-loading-view";
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
  SprayCan,
  Cylinder,
  BottleWine,
  Layers,
  MoreHorizontal,
  ChevronLeft,
} from "lucide-react-native";
import { colors, gradients, gradientStyle, screenSheetStyle, shadows } from "../../src/theme";

const supportedMaterials = [
  { label: "Plastik", icon: SprayCan },
  { label: "Kaleng", icon: Cylinder },
  { label: "Kaca", icon: BottleWine },
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
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

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
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <ScrollView
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
        {!image ? (
          <Image
            source={require("../../assets/images/upload-screen-bottom-bg-062031.png")}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            style={{
              position: "absolute",
              left: "3%",
              bottom: 0,
              width: "94%",
              height: screenWidth * 0.94 * (3 / 4),
              transform: [{ translateY: 32 }],
            }}
          />
        ) : !analyzeCall.loading ? (
          <Image
            source={require("../../assets/images/upload-screen-bottom-bg.png")}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            style={{
              position: "absolute",
              left: "3%",
              bottom: 0,
              width: "94%",
              height: screenWidth * 0.94 * (941 / 1672),
              transform: [{ translateY: 40 }],
            }}
          />
        ) : null}
        <View
          style={{
            paddingTop: Math.max(insets.top, 14),
            paddingHorizontal: 20,
            paddingBottom: 28,
            backgroundColor: "transparent",
            zIndex: 2,
          }}
        >
          <View style={{ height: 48, flexDirection: "row", alignItems: "center" }}>
            <PressableScale
              onPress={() => safeBack(router)}
              accessibilityLabel="Kembali"
              hitSlop={10}
              style={{
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "transparent",
              }}
            >
              <ChevronLeft size={24} color={colors.white} strokeWidth={2} />
            </PressableScale>
            <Text
              style={{
                flex: 1,
                color: colors.white,
                fontFamily: "Manrope_700Bold",
                fontSize: 17,
                textAlign: "center",
                letterSpacing: -0.35,
              }}
            >
              Upload Sampah
            </Text>
            <View style={{ width: 40 }} />
          </View>
        </View>

        {analyzeCall.loading ? (
          <View style={[screenSheetStyle, { minHeight: Math.max(screenHeight - 100, 620), backgroundColor: "#FFFFFF" }]}>
          <AnalysisLoadingView photoUri={image} />
          </View>
        ) : (
          <View style={{ marginTop: -12, paddingHorizontal: 20, paddingTop: 30, paddingBottom: 54, gap: 20 }}>
          <View style={{ alignItems: "center", paddingHorizontal: 22, gap: 7 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                selectable
                style={{
                  color: colors.ink900,
                  fontFamily: "serif",
                  fontWeight: "700",
                  fontSize: 26,
                  lineHeight: 31,
                  letterSpacing: -0.45,
                  textAlign: "center",
                }}
              >
                Pilih Foto{"\n"}
                <Text style={{ color: "#3C9A57", fontStyle: "italic" }}>Sampah Anorganik</Text>
              </Text>
            </View>
            <Text style={{ color: colors.ink600, fontFamily: "Manrope_400Regular", fontSize: 12, lineHeight: 18, textAlign: "center" }}>
              Pastikan objek terlihat jelas agar
              {"\n"}hasil pemindaian lebih akurat.
            </Text>
          </View>

          {image ? (
            <View
              style={{
                width: "100%",
                height: 280,
                borderRadius: 25,
                borderCurve: "continuous",
                overflow: "hidden",
                backgroundColor: colors.mist100,
                boxShadow: shadows.floating,
              }}
            >
              <Image source={{ uri: image }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
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
                  backgroundColor: "rgba(17,55,34,0.86)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.18)",
                }}
              >
                <RefreshCw size={16} color={colors.white} />
                <Text style={{ color: colors.white, fontFamily: "Manrope_600SemiBold", fontSize: 11 }}>Ganti foto</Text>
              </PressableScale>
            </View>
          ) : (
            <View
              style={{
                width: "100%",
                padding: 16,
                gap: 18,
                borderRadius: 25,
                borderCurve: "continuous",
                overflow: "hidden",
                backgroundColor: "#13522F",
                ...gradientStyle(gradients.uploadPanel),
                borderWidth: 1,
                borderColor: "rgba(202,235,139,0.48)",
                boxShadow: "0 8px 22px rgba(15,62,34,0.28)",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 17,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.lime300,
                    ...gradientStyle(gradients.scanButton),
                    boxShadow: "0 5px 12px rgba(9,38,20,0.24)",
                  }}
                >
                  <Upload size={24} color="#12452A" strokeWidth={2.1} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ color: colors.white, fontFamily: "serif", fontWeight: "700", fontSize: 18, letterSpacing: -0.2 }}>
                    Tambahkan foto sampah
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.76)", fontFamily: "Manrope_400Regular", fontSize: 11 }}>
                    Pilih sumber foto untuk mulai memindai
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 12 }}>
                {[
                  { mode: "camera" as const, label: "Kamera", caption: "Ambil foto sekarang", icon: Camera },
                  { mode: "gallery" as const, label: "Galeri", caption: "Pilih dari galeri", icon: ImageIcon },
                ].map((option) => (
                  <PressableScale
                    key={option.mode}
                    onPress={() => pickImage(option.mode)}
                    accessibilityLabel={option.mode === "camera" ? "Ambil foto dengan kamera" : "Pilih foto dari galeri"}
                    style={{
                      flex: 1,
                      height: 136,
                      borderRadius: 22,
                      borderCurve: "continuous",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      backgroundColor: "rgba(42,94,55,0.92)",
                      ...gradientStyle(gradients.uploadChoice),
                      borderWidth: 1,
                      borderColor: "rgba(205,239,146,0.43)",
                      boxShadow: "inset 0 1px 0 rgba(243,255,221,0.12), 0 7px 15px rgba(7,39,21,0.2)",
                    }}
                  >
                    <View
                      style={{
                        width: 58,
                        height: 58,
                        borderRadius: 29,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(91,148,80,0.5)",
                        borderWidth: 1,
                        borderColor: "rgba(217,245,166,0.34)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)",
                      }}
                    >
                      <option.icon size={25} color={colors.white} strokeWidth={1.9} />
                    </View>
                    <Text style={{ color: colors.white, fontFamily: "Manrope_700Bold", fontSize: 13 }}>{option.label}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.66)", fontFamily: "Manrope_400Regular", fontSize: 9.5 }}>
                      {option.caption}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            </View>
          )}

          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: "#173B2A", fontFamily: "Manrope_700Bold", fontSize: 14 }}>Material yang didukung</Text>
              <Text style={{ color: colors.forest600, fontFamily: "Manrope_500Medium", fontSize: 10 }}>5 kategori</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {supportedMaterials.map((material) => (
                <View
                  key={material.label}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 82,
                    borderRadius: 18,
                    borderCurve: "continuous",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    backgroundColor: "rgba(255,255,255,0.82)",
                    borderWidth: 1,
                    borderColor: "#E5EADD",
                    boxShadow: "0 5px 14px rgba(30,57,37,0.08)",
                  }}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#EAF2E5" }}>
                    <material.icon size={18} color="#3F734C" strokeWidth={1.8} />
                  </View>
                  <Text numberOfLines={1} style={{ color: colors.ink600, fontFamily: "Manrope_500Medium", fontSize: 9.5, textAlign: "center" }}>
                    {material.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View
            style={{
              minHeight: 88,
              paddingHorizontal: 14,
              paddingVertical: 13,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              borderRadius: 21,
              borderCurve: "continuous",
              overflow: "hidden",
              backgroundColor: "#F5F8EE",
              ...gradientStyle(gradients.uploadTip),
              borderWidth: 1,
              borderColor: "#DCE7CE",
              boxShadow: "0 6px 16px rgba(31,62,38,0.1)",
            }}
          >
            <View style={{ width: 46, height: 46, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#DDEBCD" }}>
              <Lightbulb size={23} color="#4B824D" fill="#78A958" strokeWidth={1.6} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: "#285A38", fontFamily: "Manrope_700Bold", fontSize: 12 }}>Tips foto terbaik</Text>
              <Text style={{ color: colors.ink600, fontFamily: "Manrope_400Regular", fontSize: 10.5, lineHeight: 15 }}>
                Pastikan objek terlihat jelas, tidak blur, dan pencahayaan cukup.
              </Text>
            </View>
          </View>

          {image ? (
            <PressableScale
              onPress={handleAnalyze}
              accessibilityLabel="Analisis sampah sekarang"
              style={{
                height: 56,
                borderRadius: 19,
                borderCurve: "continuous",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                backgroundColor: "#2B7748",
                ...gradientStyle(gradients.uploadAnalyze),
                borderWidth: 1,
                borderColor: "rgba(190,232,120,0.28)",
                boxShadow: "0 8px 18px rgba(20,69,39,0.24)",
              }}
            >
              <Sparkles size={18} color={colors.white} />
              <Text style={{ color: colors.white, fontFamily: "Manrope_700Bold", fontSize: 14 }}>
                Analisis Sampah Sekarang
              </Text>
            </PressableScale>
          ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
