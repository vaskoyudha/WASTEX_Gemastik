import React, { useState } from "react";
import { Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Card, Header, StarRating } from "../../../src/components/ui";
import { apiClient } from "../../../src/services/api";
import { safeBack } from "../../../src/lib/navigation";
import { Camera, CheckCircle2, Sparkles } from "lucide-react-native";
import { colors, gradients, gradientStyle, screenSheetStyle, shadows } from "../../../src/theme";

export default function CompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [photo, setPhoto] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      const completion = await apiClient.completeSkill(
        id as string,
        photo,
        rating,
        comment.trim() || undefined,
      );
      router.replace(
        `/product/${id}/selling?completionId=${encodeURIComponent(completion.id)}`,
      );
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest900, ...gradientStyle(gradients.home) }}>
      <Header title="Tandai Selesai" onBack={() => safeBack(router)} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={[screenSheetStyle, gradientStyle(gradients.contentSheet)]}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 46 }}
      >
        <View style={{ padding: 20, marginBottom: 22, borderRadius: 26, borderCurve: "continuous", ...gradientStyle(gradients.navigation), boxShadow: shadows.card }}>
          <View className="w-11 h-11 rounded-[17px] items-center justify-center mb-5" style={{ backgroundColor: "rgba(255,255,255,0.11)", borderWidth: 1, borderColor: "rgba(255,255,255,0.13)" }}>
            <Sparkles size={20} color={colors.lime300} />
          </View>
          <Text className="text-[24px] font-extrabold mb-2" style={{ color: colors.white, letterSpacing: -0.8 }}>Bagikan hasil karyamu</Text>
          <Text className="text-xs leading-5" style={{ color: "rgba(255,255,255,0.68)" }}>
            Tambahkan foto dan ulasan singkat untuk menginspirasi komunitas WASTEX.
          </Text>
        </View>

        <Text className="text-[16px] font-extrabold mb-3" style={{ color: colors.ink900, letterSpacing: -0.35 }}>Foto produk jadi</Text>
        {photo ? (
          <View className="mb-3 rounded-[24px] overflow-hidden" style={{ boxShadow: shadows.card }}>
            <Image source={{ uri: photo }} className="w-full h-[230px] bg-mist-100" />
            <View className="absolute left-3 bottom-3 flex-row items-center px-3 py-2 rounded-full" style={{ backgroundColor: "rgba(21,37,27,0.84)" }}>
              <CheckCircle2 size={14} color={colors.lime300} />
              <Text className="text-[10px] font-bold ml-1.5" style={{ color: colors.white }}>Foto siap</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={pickImage}
            className="w-full h-[230px] rounded-[24px] items-center justify-center mb-3"
            style={{ backgroundColor: colors.mist50, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.sage300 }}
          >
            <View className="w-14 h-14 rounded-[20px] items-center justify-center mb-4" style={{ backgroundColor: colors.surface, boxShadow: shadows.card }}>
              <Camera size={24} color={colors.forest700} />
            </View>
            <Text className="text-sm font-extrabold" style={{ color: colors.ink900 }}>Tambahkan foto terbaikmu</Text>
            <Text className="text-[11px] mt-1" style={{ color: colors.ink600 }}>Rasio 4:3 akan terlihat paling baik</Text>
          </TouchableOpacity>
        )}
        <Button
          title={photo ? "Ganti Foto" : "Ambil dari Galeri"}
          onPress={pickImage}
          variant="secondary"
          className="mb-7"
        />

        <Card className="border-0 p-[18px] mb-4" style={{ backgroundColor: colors.surface }}>
          <View className="flex-row items-end justify-between mb-4">
            <View>
              <Text className="text-[16px] font-extrabold" style={{ color: colors.ink900, letterSpacing: -0.35 }}>Rating pengalaman</Text>
              <Text className="text-[11px] mt-1" style={{ color: colors.ink600 }}>Seberapa mudah skill ini diikuti?</Text>
            </View>
            {rating > 0 ? <Text className="text-sm font-extrabold" style={{ color: colors.forest700 }}>{rating}/5</Text> : null}
          </View>
          <StarRating value={rating} onChange={setRating} size={34} />
        </Card>

        <Card className="border-0 p-[18px] mb-6" style={{ backgroundColor: colors.surface }}>
          <Text className="text-[16px] font-extrabold mb-2" style={{ color: colors.ink900, letterSpacing: -0.35 }}>Ceritakan prosesmu</Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            multiline
            placeholder="Apa bagian paling menyenangkan atau menantang?"
            placeholderTextColor={colors.ink400}
            style={{ minHeight: 104, padding: 14, borderRadius: 16, borderCurve: "continuous", borderWidth: 1, borderColor: colors.sage200, backgroundColor: colors.mist50, color: colors.ink900, fontFamily: "Manrope_400Regular", fontSize: 13, lineHeight: 20, textAlignVertical: "top" }}
          />
        </Card>

        <Button
          title="Kirim & Buat Konten Jual"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />
      </ScrollView>
    </View>
  );
}
