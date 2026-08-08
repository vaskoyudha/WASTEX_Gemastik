import React, { useState } from "react";
import { View, Text, ScrollView, Image, useWindowDimensions, Modal, Pressable, Alert, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Header, Button, Card, LoadingSpinner } from "../../../src/components/ui";
import { useProductData } from "../../../src/hooks/useProductData";
import { safeBack } from "../../../src/lib/navigation";
import { colors } from "../../../src/theme";
import { ImageIcon, Download, X, Maximize2 } from "lucide-react-native";
import { File, Paths } from "expo-file-system";

interface MockupImage {
  uri: string | null;
  label: string;
}

export default function MockupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tutData, loading, error, refetch } = useProductData(id);
  const { height: screenHeight } = useWindowDimensions();

  const [selectedImage, setSelectedImage] = useState<MockupImage | null>(null);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (loading) {
    return <LoadingSpinner fullScreen message="Memuat mockup produk..." />;
  }

  if (error) {
    return (
      <View className="flex-1 bg-cream-50 items-center justify-center p-6">
        <Text className="text-slate-600 text-center mb-4">Mockup produk gagal dimuat.</Text>
        <Button title="Coba Lagi" onPress={() => refetch()} />
      </View>
    );
  }

  if (!tutData) {
    return (
      <View className="flex-1 bg-cream-50 items-center justify-center p-6">
        <Text className="text-slate-600 mb-4">Mockup tidak ditemukan.</Text>
        <Button title="Kembali ke Beranda" onPress={() => router.replace("/")} />
      </View>
    );
  }

  // Build list of available mockup images
  const mockupImages: MockupImage[] = [
    { uri: tutData.afterImageUri, label: "Dengan Kemasan" },
    { uri: tutData.mockupImageUri, label: "Label Produk" },
    { uri: tutData.afterImageUri, label: "Lifestyle Photo" },
  ].filter((img) => img.uri !== null);

  // Default selected image is the main mockup
  const currentImage = selectedImage ?? { uri: tutData.mockupImageUri, label: "Mockup Produk" };

  const handleThumbnailPress = (image: MockupImage) => {
    setSelectedImage(image);
  };

  const handleMainImagePress = () => {
    if (currentImage.uri) {
      setFullscreenVisible(true);
    }
  };

  const handleDownload = async () => {
    if (!currentImage.uri) return;

    setDownloading(true);
    try {
      const filename = `wastex-mockup-${Date.now()}.png`;
      const destination = new File(Paths.document, filename);
      await File.downloadFileAsync(currentImage.uri, destination);

      if (Platform.OS === "web") {
        Alert.alert("Berhasil", "Gambar berhasil diunduh.");
      } else {
        Alert.alert("Berhasil", `Gambar tersimpan di: ${destination.uri}`);
      }
    } catch (e) {
      Alert.alert("Gagal", "Tidak dapat mengunduh gambar. Coba lagi.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, backgroundColor: "transparent" }}
        contentContainerStyle={{ minHeight: screenHeight, backgroundColor: "transparent" }}
      >
        <Image
          source={require("../../../assets/images/upload-screen-bg.png")}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          style={{
            position: "absolute",
            top: -128,
            left: 0,
            width: "100%",
            height: screenHeight + 128,
          }}
        />
        <Header title="Mockup Produk" onBack={() => safeBack(router)} transparent contentColor={colors.white} />

        <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, backgroundColor: "transparent" }}>
          {/* Main image - tappable to expand */}
          <Card className="rounded-3xl overflow-hidden p-0 border-0 mb-5">
            {currentImage.uri ? (
              <Pressable onPress={handleMainImagePress} android_ripple={{ color: "rgba(0,0,0,0.1)" }}>
                <Image source={{ uri: currentImage.uri }} className="w-full h-64" resizeMode="cover" />
                <View
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(0,0,0,0.5)",
                  }}
                >
                  <Maximize2 size={18} color="#fff" />
                </View>
              </Pressable>
            ) : (
              <View className="w-full h-64 items-center justify-center" style={{ backgroundColor: "#EEF2EC" }}>
                <ImageIcon size={40} color="#94A3B8" strokeWidth={1.5} />
                <Text className="text-xs text-slate-400 mt-3">Mockup belum tersedia</Text>
              </View>
            )}
          </Card>

          {/* Download button */}
          {currentImage.uri && (
            <View style={{ marginBottom: 16 }}>
              <Button
                title={downloading ? "Mengunduh..." : "Unduh Gambar"}
                onPress={handleDownload}
                variant="secondary"
                icon={<Download size={18} color="#166534" />}
                disabled={downloading}
              />
            </View>
          )}

          {/* Thumbnails - tappable to switch main image */}
          <View className="flex-row gap-3 mb-5">
            {mockupImages.length > 0 ? (
              mockupImages.map((image, index) => (
                <Pressable
                  key={index}
                  onPress={() => handleThumbnailPress(image)}
                  className="flex-1 items-center"
                  android_ripple={{ color: "rgba(0,0,0,0.1)" }}
                >
                  <View
                    style={{
                      width: "100%",
                      height: 96,
                      borderRadius: 16,
                      overflow: "hidden",
                      marginBottom: 8,
                      borderWidth: selectedImage?.label === image.label ? 2 : 0,
                      borderColor: selectedImage?.label === image.label ? "#16a34a" : "transparent",
                    }}
                  >
                    {image.uri ? (
                      <Image source={{ uri: image.uri }} className="w-full h-full" resizeMode="cover" />
                    ) : (
                      <View className="w-full h-full items-center justify-center" style={{ backgroundColor: "#EEF2EC" }}>
                        <ImageIcon size={20} color="#94A3B8" strokeWidth={1.5} />
                      </View>
                    )}
                  </View>
                  <Text className="text-[11px] text-slate-500">{image.label}</Text>
                </Pressable>
              ))
            ) : (
              <View className="flex-1 items-center py-4">
                <Text className="text-xs text-slate-400">Belum ada gambar mockup tersedia</Text>
              </View>
            )}
          </View>

          <Card className="bg-emerald-50 border-emerald-100 p-5 mb-6">
            <Text className="text-base font-bold text-brand-dark mb-1 text-center">Siap Dijual!</Text>
            <Text className="text-xs text-slate-600 text-center leading-5">
              Produk kamu terlihat lebih profesional dan menarik untuk dipasarkan.
            </Text>
          </Card>

          <Button
            title="Lanjut ke Estimasi Harga"
            onPress={() => router.push(`/product/${id}/pricing`)}
            variant="primary"
          />
        </View>
      </ScrollView>

      {/* Fullscreen image modal */}
      <Modal
        visible={fullscreenVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" }}>
          {/* Close button */}
          <Pressable
            onPress={() => setFullscreenVisible(false)}
            style={{
              position: "absolute",
              top: 50,
              right: 20,
              zIndex: 10,
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.15)",
            }}
          >
            <X size={24} color="#fff" />
          </Pressable>

          {/* Image label */}
          <Text
            style={{
              position: "absolute",
              top: 58,
              left: 20,
              color: "#fff",
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {currentImage.label}
          </Text>

          {/* Fullscreen image */}
          {currentImage.uri && (
            <Image
              source={{ uri: currentImage.uri }}
              style={{ width: "90%", height: "70%", borderRadius: 12 }}
              resizeMode="contain"
            />
          )}

          {/* Download button in fullscreen */}
          <Pressable
            onPress={handleDownload}
            style={{
              position: "absolute",
              bottom: 50,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 24,
              paddingVertical: 14,
              borderRadius: 24,
              backgroundColor: downloading ? "rgba(22,163,74,0.5)" : "#16a34a",
            }}
            disabled={downloading}
          >
            <Download size={20} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
              {downloading ? "Mengunduh..." : "Unduh Gambar"}
            </Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
