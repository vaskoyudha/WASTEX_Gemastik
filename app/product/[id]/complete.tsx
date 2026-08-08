import React, { useState } from "react";
import { Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Card, Header, StarRating } from "../../../src/components/ui";
import { apiClient } from "../../../src/services/api";
import { safeBack } from "../../../src/lib/navigation";
import { Camera, CheckCircle2, Sparkles } from "lucide-react-native";
import { colors, gradients, gradientStyle, shadows } from "../../../src/theme";

export default function CompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { height: screenHeight } = useWindowDimensions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
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
        <Header title="Tandai Selesai" onBack={() => safeBack(router)} transparent contentColor={colors.white} />

        <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 46, backgroundColor: colors.cream50, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderCurve: "continuous" }}>
          {/* Centered heading */}
          <View style={{ alignItems: "center", gap: 8, marginBottom: 26 }}>
            <Text
              selectable
              style={{
                color: colors.ink900,
                fontFamily: "serif",
                fontSize: 26,
                fontWeight: "700",
                letterSpacing: -0.45,
                lineHeight: 31,
                textAlign: "center",
              }}
            >
              Bagikan{"\n"}
              <Text style={{ color: "#3C9A57", fontStyle: "italic" }}>Hasil Karyamu</Text>
            </Text>
            <Text
              selectable
              style={{
                color: colors.ink700,
                fontFamily: "Manrope_400Regular",
                fontSize: 12,
                lineHeight: 19,
                textAlign: "center",
              }}
            >
              Tambahkan foto dan ulasan singkat untuk menginspirasi komunitas WASTEX.
            </Text>
          </View>

          {/* Photo section */}
          <Text style={{ color: colors.ink900, fontFamily: "Manrope_700Bold", fontSize: 14, marginBottom: 12 }}>
            Foto produk jadi
          </Text>
          {photo ? (
            <View
              style={{
                marginBottom: 12,
                borderRadius: 24,
                borderCurve: "continuous",
                overflow: "hidden",
                boxShadow: shadows.floating,
              }}
            >
              <Image source={{ uri: photo }} style={{ width: "100%", height: 230 }} resizeMode="cover" />
              <View
                style={{
                  position: "absolute",
                  left: 12,
                  bottom: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: "rgba(21,37,27,0.84)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.18)",
                }}
              >
                <CheckCircle2 size={14} color={colors.lime300} />
                <Text style={{ color: colors.white, fontFamily: "Manrope_700Bold", fontSize: 10, marginLeft: 6 }}>Foto siap</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={pickImage}
              activeOpacity={0.85}
              style={{
                width: "100%",
                height: 230,
                borderRadius: 24,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
                backgroundColor: "rgba(255,255,255,0.14)",
                borderWidth: 1.5,
                borderStyle: "dashed",
                borderColor: "rgba(220,247,170,0.5)",
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                  backgroundColor: colors.lime300,
                  ...gradientStyle(gradients.scanButton),
                  boxShadow: "0 5px 12px rgba(9,38,20,0.24)",
                }}
              >
                <Camera size={24} color="#12452A" strokeWidth={2.1} />
              </View>
              <Text style={{ color: colors.white, fontFamily: "Manrope_700Bold", fontSize: 14 }}>Tambahkan foto terbaikmu</Text>
              <Text style={{ color: "rgba(255,255,255,0.68)", fontFamily: "Manrope_400Regular", fontSize: 11, marginTop: 4 }}>
                Rasio 4:3 akan terlihat paling baik
              </Text>
            </TouchableOpacity>
          )}
          <Button
            title={photo ? "Ganti Foto" : "Ambil dari Galeri"}
            onPress={pickImage}
            variant="secondary"
            style={{ marginBottom: 24 }}
          />

          {/* Rating card */}
          <View
            style={{
              padding: 18,
              borderRadius: 22,
              borderCurve: "continuous",
              marginBottom: 16,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: "rgba(220,247,170,0.4)",
              boxShadow: shadows.card,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
              <View>
                <Text style={{ color: colors.ink900, fontFamily: "Manrope_700Bold", fontSize: 16, letterSpacing: -0.35 }}>
                  Rating pengalaman
                </Text>
                <Text style={{ color: colors.ink600, fontFamily: "Manrope_400Regular", fontSize: 11, marginTop: 3 }}>
                  Seberapa mudah skill ini diikuti?
                </Text>
              </View>
              {rating > 0 && (
                <Text style={{ color: colors.forest700, fontFamily: "Manrope_700Bold", fontSize: 14 }}>{rating}/5</Text>
              )}
            </View>
            <StarRating value={rating} onChange={setRating} size={34} />
          </View>

          {/* Comment card */}
          <View
            style={{
              padding: 18,
              borderRadius: 22,
              borderCurve: "continuous",
              marginBottom: 24,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: "rgba(220,247,170,0.4)",
              boxShadow: shadows.card,
            }}
          >
            <Text style={{ color: colors.ink900, fontFamily: "Manrope_700Bold", fontSize: 16, letterSpacing: -0.35, marginBottom: 10 }}>
              Ceritakan prosesmu
            </Text>
            <TextInput
              value={comment}
              onChangeText={setComment}
              multiline
              placeholder="Apa bagian paling menyenangkan atau menantang?"
              placeholderTextColor={colors.ink400}
              style={{
                minHeight: 104,
                padding: 14,
                borderRadius: 16,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: colors.sage200,
                backgroundColor: colors.mist50,
                color: colors.ink900,
                fontFamily: "Manrope_400Regular",
                fontSize: 13,
                lineHeight: 20,
                textAlignVertical: "top",
              }}
            />
          </View>

          <Button
            title="Kirim & Buat Konten Jual"
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={submitting}
          />
        </View>
      </ScrollView>
    </View>
  );
}
