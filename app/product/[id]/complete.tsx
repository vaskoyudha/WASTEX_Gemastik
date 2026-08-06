import React, { useState } from "react";
import { Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Header, StarRating } from "../../../src/components/ui";
import { apiClient } from "../../../src/services/api";
import { safeBack } from "../../../src/lib/navigation";
import { Image as ImageIcon } from "lucide-react-native";

export default function CompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [photo, setPhoto] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0].uri) setPhoto(result.assets[0].uri);
    } catch {
      Alert.alert("Gagal", "Tidak dapat membuka galeri foto.");
    }
  };

  const canSubmit = Boolean(photo) && rating >= 1 && !submitting;

  const handleSubmit = async () => {
    if (!photo || rating < 1) return;
    setSubmitting(true);
    try {
      await apiClient.completeSkill(id as string, photo, rating, comment.trim() || undefined);
      setDone(true);
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 409) {
        Alert.alert("Sudah Terkirim", "Anda sudah mengirimkan hasil untuk skill ini.");
      } else {
        Alert.alert("Gagal", "Tidak dapat mengirim hasil. Coba lagi.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <View className="flex-1 bg-slate-50">
        <Header title="Hasil Terkirim" onBack={() => safeBack(router)} />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-base font-bold text-slate-900 text-center mb-2">Terima kasih!</Text>
          <Text className="text-sm text-slate-600 text-center mb-6">
            Hasil karyamu kini tampil di galeri komunitas dan membantu user lain.
          </Text>
          <Button title="Kembali ke Detail" onPress={() => router.replace(`/product/${id}`)} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <Header title="Tandai Selesai" onBack={() => safeBack(router)} />
      <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="text-sm font-bold text-slate-900 mb-2">Foto Produk Jadi</Text>
        {photo ? (
          <Image source={{ uri: photo }} className="w-full h-48 rounded-2xl bg-slate-200 mb-3" />
        ) : (
          <TouchableOpacity
            onPress={pickImage}
            className="w-full h-48 rounded-2xl bg-slate-100 border border-dashed border-slate-300 items-center justify-center mb-3"
          >
            <ImageIcon size={32} color="#94a3b8" />
            <Text className="text-xs text-slate-500 mt-2">Pilih foto produk jadi kamu</Text>
          </TouchableOpacity>
        )}
        <Button
          title={photo ? "Ganti Foto" : "Ambil dari Galeri"}
          onPress={pickImage}
          variant="secondary"
          className="mb-6"
        />

        <Text className="text-sm font-bold text-slate-900 mb-2">Rating Skill Ini</Text>
        <View className="mb-6">
          <StarRating value={rating} onChange={setRating} size={32} />
        </View>

        <Text className="text-sm font-bold text-slate-900 mb-2">Komentar (opsional)</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          multiline
          placeholder="Ceritakan pengalamanmu mengikuti skill ini..."
          className="border border-slate-200 rounded-xl px-4 py-3 mb-6 text-sm min-h-[80px]"
        />

        <Button title="Kirim Hasil" onPress={handleSubmit} disabled={!canSubmit} loading={submitting} />
      </ScrollView>
    </View>
  );
}
