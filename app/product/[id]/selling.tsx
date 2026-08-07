import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Header, Button, Card, FitImage, LoadingSpinner } from "../../../src/components/ui";
import { useProductData } from "../../../src/hooks/useProductData";
import { useScanStore } from "../../../src/store/useScanStore";
import { impact, scanner } from "../../../src/services";
import { apiClient } from "../../../src/services/api";
import {
  buildSocialCaption,
  InstagramShareConfigurationError,
  isShareCancellation,
  NativeInstagramShareUnavailableError,
  shareToInstagramFeed,
  shareToInstagramStory,
  shareToOtherApps,
} from "../../../src/services/socialSharing";
import { MaterialType } from "../../../src/services/types";
import { safeBack } from "../../../src/lib/navigation";
import { Copy, Share2, Check, BookmarkCheck } from "lucide-react-native";
import { colors, screenSheetStyle } from "../../../src/theme";

type SellingTab = "deskripsi" | "caption" | "hashtag" | "tips";
type ShareTarget = "story" | "feed" | "other";

const META_APP_ID = process.env.EXPO_PUBLIC_META_APP_ID;

function inferMaterialFromProduct(productId: string): MaterialType {
  if (productId.includes("hdpe")) return "plastik_hdpe";
  if (productId.includes("kardus")) return "kardus";
  if (productId.includes("kaleng")) return "kaleng";
  if (productId.includes("kaca")) return "kaca";
  if (productId.includes("sachet")) return "sachet";
  return "plastik_pet";
}

export default function SellingScreen() {
  const { id, completionId } = useLocalSearchParams<{ id: string; completionId?: string }>();
  const router = useRouter();
  const {
    product,
    tutData,
    sellData,
    loading,
    error,
    refetch,
    sellingLoading,
    sellingError,
  } = useProductData(id, completionId);
  const { scanResult, imageUri, resetSession } = useScanStore();

  const [sellingTab, setSellingTab] = useState<SellingTab>("deskripsi");
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharingTarget, setSharingTarget] = useState<ShareTarget | null>(null);

  if (loading) {
    return <LoadingSpinner fullScreen message="Memuat AI Selling Assistant..." />;
  }

  if (error) {
    return (
      <View className="flex-1 bg-cream-50 items-center justify-center p-6">
        <Text className="text-slate-600 text-center mb-4">AI Selling Assistant gagal dimuat.</Text>
        <Button title="Coba Lagi" onPress={() => refetch()} />
      </View>
    );
  }

  if (!product) {
    return (
      <View className="flex-1 bg-cream-50 items-center justify-center p-6">
        <Text className="text-slate-600 mb-4">Data selling assistant tidak ditemukan.</Text>
        <Button title="Kembali ke Beranda" onPress={() => router.replace("/")} />
      </View>
    );
  }

  // Selling kit dihasilkan LLM di latar belakang; halaman lain tidak ikut
  // terblokir, tapi layar ini menunggu hasilnya siap dulu.
  if (sellingLoading) {
    return <LoadingSpinner fullScreen message="Menyiapkan materi promosi produk..." />;
  }

  if (sellingError || !sellData) {
    return (
      <View className="flex-1 bg-cream-50 items-center justify-center p-6">
        <Text className="text-slate-600 text-center mb-4">
          Materi promosi belum bisa dibuat untuk produk ini.
        </Text>
        <Button title="Coba Lagi" onPress={() => refetch()} />
      </View>
    );
  }

  const goHome = () => {
    router.replace("/");
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      safeBack(router);
      return;
    }

    goHome();
  };

  const handleSaveProject = () => {
    setConfirmVisible(true);
  };

  const handleConfirmSave = async () => {
    const material = scanResult || await scanner.getMaterialInfo(inferMaterialFromProduct(product.id));

    setSaving(true);
    try {
      await impact.saveProject({
        id: Date.now().toString(),
        savedAt: new Date().toISOString(),
        material,
        product,
        photoUri: sellData.promoImageUri || imageUri || product.thumbnailUri,
      });
      setConfirmVisible(false);
      resetSession();
      goHome();
    } catch (e) {
      Alert.alert("Gagal", "Tidak dapat menyimpan proyek.");
    } finally {
      setSaving(false);
    }
  };

  const getAllSellingText = () => {
    if (!sellData) return "";
    const promoImageUri = sellData.promoImageUri || tutData?.mockupImageUri;
    return [
      sellData.productName,
      sellData.description,
      ...sellData.captions,
      ...(sellData.hashtags ?? []),
      ...sellData.photoTips,
      ...sellData.packagingIdeas,
      ...(promoImageUri ? [`Poster produk: ${promoImageUri}`] : []),
    ].join("\n\n");
  };

  const copySellingText = async (message: string, title = "Konten") => {
    if (!message.trim()) {
      Alert.alert("Tidak Ada Konten", "Tidak ada teks yang bisa disalin.");
      return;
    }

    try {
      await Clipboard.setStringAsync(message);
      Alert.alert("Tersalin", `${title} berhasil disalin ke clipboard.`);
    } catch {
      Alert.alert("Gagal", "Konten tidak bisa disalin saat ini.");
    }
  };

  const posterImageUri = sellData.promoImageUri || tutData?.mockupImageUri;
  const socialCaption = buildSocialCaption(sellData);

  const showShareError = (error: unknown, target: ShareTarget) => {
    if (isShareCancellation(error)) return;
    if (error instanceof InstagramShareConfigurationError) {
      Alert.alert(
        "Meta App ID Belum Diatur",
        "Tambahkan EXPO_PUBLIC_META_APP_ID lalu rebuild aplikasi. Sementara gunakan Aplikasi Lain.",
      );
      return;
    }
    if (error instanceof NativeInstagramShareUnavailableError) {
      Alert.alert(
        "Build Native Diperlukan",
        "Bagikan langsung ke Instagram tersedia pada development/production build, bukan Expo Go.",
      );
      return;
    }
    Alert.alert(
      "Tidak Dapat Membuka Instagram",
      target === "story"
        ? "Template Story belum dapat dibagikan. Pastikan Instagram terpasang lalu coba lagi."
        : "Poster belum dapat dibagikan. Pastikan aplikasi tujuan terpasang lalu coba lagi.",
    );
  };

  const handleInstagramStory = async () => {
    if (!posterImageUri) return;
    setSharingTarget("story");
    try {
      const storyImageUri = completionId
        ? (await apiClient.getCompletionStoryAsset(id, completionId)).story_image_url
        : posterImageUri;
      await shareToInstagramStory(storyImageUri, socialCaption, META_APP_ID);
    } catch (error) {
      showShareError(error, "story");
    } finally {
      setSharingTarget(null);
    }
  };

  const handleInstagramFeed = async () => {
    if (!posterImageUri) return;
    setSharingTarget("feed");
    try {
      await shareToInstagramFeed(posterImageUri, socialCaption);
    } catch (error) {
      showShareError(error, "feed");
    } finally {
      setSharingTarget(null);
    }
  };

  const handleOtherApps = async () => {
    if (!posterImageUri) return;
    setSharingTarget("other");
    try {
      await shareToOtherApps(posterImageUri, socialCaption);
    } catch (error) {
      showShareError(error, "other");
    } finally {
      setSharingTarget(null);
    }
  };

  const renderContent = () => {
    switch (sellingTab) {
      case "deskripsi":
        return (
          <View>
            <Text className="text-sm font-bold text-slate-900 mb-2">Deskripsi Produk</Text>
            <Card className="p-4 mb-4 border border-slate-100">
              <Text className="text-xs text-slate-700 leading-5">{sellData.description}</Text>
            </Card>
          </View>
        );
      case "caption":
        return (
          <View>
            <Text className="text-sm font-bold text-slate-900 mb-2">Caption Media Sosial</Text>
            {sellData.captions.map((cap, idx) => (
              <Card key={idx} className="p-4 mb-3 border border-slate-100">
                <Text className="text-xs text-slate-700 leading-5 mb-3">{cap}</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => copySellingText(cap, "Caption Media Sosial")}
                  className="flex-row items-center self-start bg-slate-100 px-3 py-1.5 rounded-lg"
                >
                  <Copy size={14} color="#64748b" />
                  <Text className="text-[10px] font-bold text-slate-600 ml-1">Salin</Text>
                </TouchableOpacity>
              </Card>
            ))}
          </View>
        );
      case "hashtag":
        return (
          <View>
            <Text className="text-sm font-bold text-slate-900 mb-2">Rekomendasi Hashtag</Text>
            <Card className="p-4 mb-4 border border-slate-100">
              <View className="flex-row flex-wrap gap-2">
                {(sellData.hashtags?.length
                  ? sellData.hashtags
                  : ["#Upcycling", "#WASTEX", "#EcoFriendly", "#DaurUlang", "#ProdukLokal"]
                ).map((tag) => (
                  <View key={tag} className="bg-emerald-50 px-3 py-1.5 rounded-full">
                    <Text className="text-xs font-semibold text-brand-dark">{tag}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        );
      case "tips":
      default:
        return (
          <View>
            <Text className="text-sm font-bold text-slate-900 mb-2">Tips Foto & Kemasan</Text>
            <Card className="p-4 border border-slate-100">
              {sellData.photoTips.map((tip, idx) => (
                <View key={idx} className="flex-row items-start mb-3">
                  <View className="mt-0.5 mr-2">
                    <Check size={14} color="#16a34a" />
                  </View>
                  <Text className="text-xs text-slate-700 leading-5 flex-1">{tip}</Text>
                </View>
              ))}
            </Card>
          </View>
        );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest900 }}>
      <Header title="AI Selling Assistant" onBack={handleBack} />

      <ScrollView style={screenSheetStyle} className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="flex-row bg-white rounded-2xl p-1 border border-slate-100 mb-5">
          {(
            [
              { key: "deskripsi", label: "Deskripsi" },
              { key: "caption", label: "Sosmed" },
              { key: "hashtag", label: "Hashtag" },
              { key: "tips", label: "Tips Foto" },
            ] as { key: SellingTab; label: string }[]
          ).map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setSellingTab(t.key)}
              className={`flex-1 py-2 rounded-xl ${sellingTab === t.key ? "bg-brand" : "bg-transparent"}`}
            >
              <Text
                className={`text-[11px] font-bold text-center ${
                  sellingTab === t.key ? "text-white" : "text-slate-500"
                }`}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Card className="p-4 border border-slate-100 mb-4">
          <Text className="text-xs text-slate-400 mb-1">Saran Nama Produk</Text>
          <Text className="font-bold text-slate-900 text-base">{sellData.productName}</Text>
        </Card>

        {sellData.promoImageUri || tutData?.mockupImageUri ? (
          <Card className="p-4 border border-slate-100 mb-4">
            <Text className="text-sm font-bold text-slate-900 mb-1">Poster Promosi AI</Text>
            <Text className="text-xs text-slate-500 leading-5 mb-3">
              Siap dibagikan bersama deskripsi dan caption ke Instagram, Facebook, WhatsApp,
              atau platform lain.
            </Text>
            <FitImage
              source={{ uri: sellData.promoImageUri || tutData?.mockupImageUri }}
              className="rounded-2xl overflow-hidden bg-slate-100"
              maxHeight={420}
            />
          </Card>
        ) : completionId ? (
          <Card className="p-4 border border-amber-100 bg-amber-50 mb-4">
            <Text className="text-xs text-amber-800 leading-5 mb-3">
              Teks promosi sudah siap, tetapi poster AI belum berhasil dibuat.
            </Text>
            <Button title="Coba Buat Poster Lagi" variant="secondary" onPress={() => refetch()} />
          </Card>
        ) : null}

        {renderContent()}

        <View className="mt-2 mb-4">
          <Button
            title="Salin Semua"
            variant="secondary"
            className="mb-3"
            onPress={() => copySellingText(getAllSellingText(), "Semua konten")}
          />
          {posterImageUri ? (
            <Card className="p-4 border border-emerald-100 bg-emerald-50">
              <View className="flex-row items-center mb-2">
                <Share2 size={18} color="#166534" />
                <Text className="text-sm font-bold text-slate-900 ml-2">Bagikan Poster</Text>
              </View>
              <Text className="text-xs text-slate-600 leading-5 mb-4">
                Caption dan hashtag otomatis disalin. Di Instagram kamu tinggal menempelkan
                caption dan menekan Bagikan.
              </Text>
              <Button
                title="Instagram Story"
                variant="primary"
                className="mb-2"
                onPress={handleInstagramStory}
                loading={sharingTarget === "story"}
                disabled={sharingTarget !== null}
              />
              <Button
                title="Instagram Feed"
                variant="secondary"
                className="mb-2"
                onPress={handleInstagramFeed}
                loading={sharingTarget === "feed"}
                disabled={sharingTarget !== null}
              />
              <Button
                title="Aplikasi Lain"
                variant="outline"
                icon={<Share2 size={18} color="#166534" />}
                onPress={handleOtherApps}
                loading={sharingTarget === "other"}
                disabled={sharingTarget !== null}
              />
            </Card>
          ) : null}
        </View>

        <Button
          title="Simpan & Catat Dampak"
          onPress={handleSaveProject}
          icon={<BookmarkCheck size={20} color="#ffffff" />}
          variant="primary"
        />
      </ScrollView>

      <Modal visible={confirmVisible} animationType="fade" transparent onRequestClose={() => setConfirmVisible(false)}>
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <View className="w-full max-w-sm rounded-3xl bg-white p-6">
            <View className="w-14 h-14 rounded-full bg-emerald-50 items-center justify-center mb-4 self-center">
              <BookmarkCheck size={28} color="#16a34a" />
            </View>
            <Text className="text-lg font-bold text-slate-900 text-center mb-2">Simpan Proyek?</Text>
            <Text className="text-sm text-slate-600 text-center leading-5 mb-6">
              Proyek akan dicatat ke Riwayat dan Impact Tracker, lalu kamu akan kembali ke Beranda.
            </Text>
            <View className="flex-row gap-3">
              <Button
                title="Batal"
                variant="outline"
                className="flex-1"
                onPress={() => setConfirmVisible(false)}
                disabled={saving}
              />
              <Button
                title="Simpan"
                variant="primary"
                className="flex-1"
                onPress={handleConfirmSave}
                loading={saving}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
