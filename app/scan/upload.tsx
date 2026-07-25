import React, { useCallback, useState } from "react";
import { View, Text, Image, TouchableOpacity, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Header, Button, Card, LoadingSpinner } from "../../src/components/ui";
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
  };

  const handleAnalyze = async () => {
    if (!image) return;
    await analyzeCall.execute(image);
  };

  return (
    <View className="flex-1 bg-slate-50">
      <Header title="Upload Sampah" onBack={() => safeBack(router)} />

      {analyzeCall.loading ? (
        <LoadingSpinner fullScreen message="AI Upcycling Agent sedang menganalisis material & risiko keamanan..." />
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          <Text className="text-sm text-slate-500 text-center mb-6 leading-5">
            Ambil atau unggah foto sampah anorganik yang ingin kamu olah.
          </Text>

          {/* Upload Box */}
          {image ? (
            <Card className="w-full rounded-[28px] overflow-hidden p-0 border-0 bg-slate-200 mb-6">
              <Image source={{ uri: image }} className="w-full h-72" resizeMode="cover" />
              <TouchableOpacity
                onPress={() => setImage(null)}
                className="absolute top-4 right-4 bg-black/60 p-2.5 rounded-full"
              >
                <RefreshCw size={18} color="#ffffff" />
              </TouchableOpacity>
            </Card>
          ) : (
            <View className="w-full rounded-[28px] border-2 border-dashed border-slate-300 bg-white px-6 py-10 items-center mb-6">
              <View className="w-16 h-16 rounded-full bg-emerald-50 items-center justify-center mb-4">
                <Upload size={32} color="#16a34a" />
              </View>
              <Text className="text-base font-bold text-slate-900 mb-1">Drag & Drop foto di sini</Text>
              <Text className="text-xs text-slate-400 mb-5">atau</Text>
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
            <Text className="text-sm font-bold text-slate-800 mb-3">Material yang didukung:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {supportedMaterials.map((m) => (
                <View key={m.label} className="items-center mr-3 w-20">
                  <View className="w-12 h-12 rounded-2xl bg-slate-100 items-center justify-center mb-2">
                    <m.icon size={22} color="#16a34a" />
                  </View>
                  <Text className="text-[11px] text-slate-600 text-center" numberOfLines={2}>{m.label}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Tip Card */}
          <Card className="bg-emerald-50/60 border-emerald-100 p-4 flex-row items-start rounded-[22px]">
            <View className="p-2 bg-emerald-100 rounded-full mr-3">
              <Lightbulb size={18} color="#15803d" />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-bold text-brand-dark mb-1">Tips foto terbaik</Text>
              <Text className="text-xs text-slate-600 leading-4">
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
