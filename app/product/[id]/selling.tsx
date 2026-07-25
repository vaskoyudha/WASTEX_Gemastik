import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Share, Platform, Modal } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Header, Button, Card, LoadingSpinner } from "../../../src/components/ui";
import { useProductData } from "../../../src/hooks/useProductData";
import { useScanStore } from "../../../src/store/useScanStore";
import { impact, scanner } from "../../../src/services";
import { MaterialType } from "../../../src/services/types";
import { safeBack } from "../../../src/lib/navigation";
import { Copy, Share2, Check, BookmarkCheck } from "lucide-react-native";

type SellingTab = "deskripsi" | "caption" | "hashtag" | "tips";

function inferMaterialFromProduct(productId: string): MaterialType {
  if (productId.includes("hdpe")) return "plastik_hdpe";
  if (productId.includes("kardus")) return "kardus";
  if (productId.includes("kaleng")) return "kaleng";
  if (productId.includes("kaca")) return "kaca";
  if (productId.includes("sachet")) return "sachet";
  return "plastik_pet";
}

export default function SellingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { product, sellData, loading, error, refetch } = useProductData(id);
  const { scanResult, imageUri, resetSession } = useScanStore();

  const [sellingTab, setSellingTab] = useState<SellingTab>("deskripsi");
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  if (loading) {
    return <LoadingSpinner fullScreen message="Memuat AI Selling Assistant..." />;
  }

  if (error) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center p-6">
        <Text className="text-slate-600 text-center mb-4">AI Selling Assistant gagal dimuat.</Text>
        <Button title="Coba Lagi" onPress={() => refetch()} />
      </View>
    );
  }

  if (!product || !sellData) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center p-6">
        <Text className="text-slate-600 mb-4">Data selling assistant tidak ditemukan.</Text>
      <Button title="Kembali ke Beranda" onPress={() => router.replace("/")} />
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
        photoUri: imageUri || product.thumbnailUri,
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
    return [
      sellData.productName,
      sellData.description,
      ...sellData.captions,
      ...sellData.photoTips,
      ...sellData.packagingIdeas,
    ].join("\n\n");
  };

  const shareSellingText = async (message: string, title = "AI Selling Assistant") => {
    try {
      await Share.share({ title, message });
    } catch {
      Alert.alert("Gagal", "Konten tidak bisa dibagikan saat ini.");
    }
  };

  const copySellingText = async (message: string, title = "Konten") => {
    if (!message.trim()) {
      Alert.alert("Tidak Ada Konten", "Tidak ada teks yang bisa disalin.");
      return;
    }

    try {
      const clipboard = (globalThis as any).navigator?.clipboard;
      if (Platform.OS === "web" && clipboard?.writeText) {
        await clipboard.writeText(message);
        Alert.alert("Tersalin", `${title} berhasil disalin ke clipboard.`);
        return;
      }

      await Share.share({ title, message });
    } catch {
      Alert.alert("Gagal", "Konten tidak bisa disalin saat ini.");
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
            <Text className="text-sm font-bold text-slate-900 mb-2">Caption Instagram</Text>
            {sellData.captions.map((cap, idx) => (
              <Card key={idx} className="p-4 mb-3 border border-slate-100">
                <Text className="text-xs text-slate-700 leading-5 mb-3">{cap}</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => copySellingText(cap, "Caption Instagram")}
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
                {["#Upcycling", "#WASTEX", "#EcoFriendly", "#DaurUlang", "#ProdukLokal"].map((tag) => (
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
    <View className="flex-1 bg-slate-50">
      <Header title="AI Selling Assistant" onBack={handleBack} />

      <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="flex-row bg-white rounded-2xl p-1 border border-slate-100 mb-5">
          {(
            [
              { key: "deskripsi", label: "Deskripsi" },
              { key: "caption", label: "Caption" },
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

        {renderContent()}

        <View className="flex-row gap-3 mt-2 mb-4">
          <Button
            title="Salin Semua"
            variant="secondary"
            className="flex-1"
            onPress={() => copySellingText(getAllSellingText(), "Semua konten")}
          />
          <Button
            title="Bagikan"
            variant="primary"
            className="flex-1"
            icon={<Share2 size={18} color="#ffffff" />}
            onPress={() => shareSellingText(getAllSellingText())}
          />
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
