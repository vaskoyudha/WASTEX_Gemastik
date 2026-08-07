import React, { useCallback, useState } from "react";
import { View, Text, Image, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Header, Button, Card, LoadingSpinner, PressableScale } from "../../src/components/ui";
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
          contentContainerStyle={{ padding: 20, paddingTop: 24, paddingBottom: 48 }}
        >
          <Text className="text-sm text-center mb-6 leading-5" style={{ color: colors.ink600 }}>
            Ambil atau unggah foto sampah anorganik yang ingin kamu olah.
          </Text>

          {/* Upload Box */}
          {image ? (
            <Card className="w-full rounded-[24px] overflow-hidden p-0 border-0 bg-mist-100 mb-6">
              <Image source={{ uri: image }} className="w-full h-72" resizeMode="cover" />
              <PressableScale
                onPress={() => setImage(null)}
                style={{ position: "absolute", top: 14, right: 14, width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(38,54,42,0.78)" }}
              >
                <RefreshCw size={18} color="#ffffff" />
              </PressableScale>
            </Card>
          ) : (
            <View
              style={{
                width: "100%",
                borderRadius: 26,
                borderCurve: "continuous",
                borderWidth: 1.5,
                borderStyle: "dashed",
                borderColor: colors.sage300,
                backgroundColor: "rgba(255,255,255,0.72)",
                paddingHorizontal: 24,
                paddingVertical: 32,
                alignItems: "center",
                marginBottom: 24,
                boxShadow: shadows.card,
              }}
            >
              <View style={{ width: 62, height: 62, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 15, backgroundColor: colors.forest700, ...gradientStyle(gradients.cameraMedallion) }}>
                <Upload size={28} color={colors.cream50} />
              </View>
              <Text className="text-base font-bold mb-1" style={{ color: colors.ink900 }}>Tambahkan foto sampah</Text>
              <Text className="text-xs mb-5" style={{ color: colors.ink400 }}>gunakan kamera atau galeri</Text>
              <Button
                title="Ambil Foto"
                onPress={() => pickImage("camera")}
                icon={<Camera size={18} color="#ffffff" />}
                variant="primary"
              />
              <View className="h-3" />
              <Button
                title="Pilih dari Galeri"
                onPress={() => pickImage("gallery")}
                icon={<ImageIcon size={18} color="#15803d" />}
                variant="secondary"
              />
            </View>
          )}

          {/* Supported Materials */}
          <View className="mb-6">
            <Text className="text-sm font-bold mb-3" style={{ color: colors.ink900 }}>Material yang didukung</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
              {supportedMaterials.map((m) => (
                <View key={m.label} className="items-center w-16">
                  <View style={{ width: 50, height: 50, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 7, backgroundColor: colors.mist100 }}>
                    <m.icon size={20} color={colors.forest600} />
                  </View>
                  <Text className="text-[10px] text-center" style={{ color: colors.ink600 }} numberOfLines={2}>{m.label}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Tip Card */}
          <Card className="p-4 flex-row items-start rounded-[22px]" style={{ backgroundColor: colors.mist50 }}>
            <View style={{ width: 36, height: 36, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 12, backgroundColor: colors.sage200 }}>
              <Lightbulb size={18} color={colors.forest600} />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-bold mb-1" style={{ color: colors.forest800 }}>Tips foto terbaik</Text>
              <Text className="text-xs leading-4" style={{ color: colors.ink600 }}>
                Pastikan objek terlihat jelas, tidak blur, dan pencahayaan cukup.
              </Text>
            </View>
          </Card>

          {image && (
            <View className="mt-6">
              <Button
                title="Analisis Sampah Sekarang"
                onPress={handleAnalyze}
                icon={<Sparkles size={20} color="#ffffff" />}
                variant="primary"
              />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
