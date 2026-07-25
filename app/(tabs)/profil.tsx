import React from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Header, Card, Button } from "../../src/components/ui";
import { impact } from "../../src/services";
import { Award, Info, Shield, Trash2, User } from "lucide-react-native";

export default function ProfilScreen() {
  const router = useRouter();

  const handleClearData = () => {
    Alert.alert(
      "Hapus Semua Data",
      "Semua data proyek dan impact lokal akan dihapus permanen sesuai kebijakan privasi (UU PDP).",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus Semua",
          style: "destructive",
          onPress: async () => {
            try {
              await impact.clearAll();
              Alert.alert("Berhasil", "Data telah dibersihkan.");
              router.replace("/(tabs)");
            } catch {
              Alert.alert("Gagal", "Data belum bisa dibersihkan saat ini.");
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ paddingBottom: 32 }}>
      <Header title="Profil & Pengaturan" subtitle="Kelola akun dan preferensi aplikasi" />

      <View className="px-6 pt-6">
        <Card className="p-5 flex-row items-center mb-6">
          <View className="w-16 h-16 rounded-full bg-brand-light items-center justify-center mr-4">
            <User size={32} color="#16a34a" />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-slate-900">Tim WASTEX</Text>
            <Text className="text-xs text-slate-500">Upcycler Pemula • UNNES</Text>
            <View className="mt-2 bg-emerald-50 px-2.5 py-0.5 rounded-md self-start">
              <Text className="text-xs font-semibold text-brand-dark">Akun Demo (Mock-First)</Text>
            </View>
          </View>
        </Card>

        <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Mode Ahli</Text>
        <Card className="p-4 mb-6">
          <TouchableOpacity
            onPress={() => router.push("/expert-dashboard")}
            className="flex-row items-center justify-between py-2"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <Award size={20} color="#16a34a" />
              <Text className="text-slate-800 font-medium ml-3 text-sm">Expert Dashboard</Text>
            </View>
          </TouchableOpacity>
        </Card>

        <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
          Privasi & Keamanan Data
        </Text>
        <Card className="p-4 mb-6">
          <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
            <View className="flex-row items-center">
              <Shield size={20} color="#16a34a" />
              <Text className="text-slate-800 font-medium ml-3 text-sm">Enkripsi & Consent (UU PDP)</Text>
            </View>
            <Text className="text-xs text-emerald-600 font-semibold">Aktif</Text>
          </View>
          <TouchableOpacity
            onPress={handleClearData}
            className="flex-row items-center justify-between py-3"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <Trash2 size={20} color="#dc2626" />
              <Text className="text-red-600 font-medium ml-3 text-sm">Hapus Data Proyek & Reset</Text>
            </View>
          </TouchableOpacity>
        </Card>

        <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
          Tentang Aplikasi
        </Text>
        <Card className="p-4 mb-6">
          <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
            <View className="flex-row items-center">
              <Info size={20} color="#64748b" />
              <Text className="text-slate-800 font-medium ml-3 text-sm">Versi Aplikasi</Text>
            </View>
            <Text className="text-xs text-slate-500 font-medium">1.0.0 (Gemastik XVIII)</Text>
          </View>
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <User size={20} color="#64748b" />
              <Text className="text-slate-800 font-medium ml-3 text-sm">Tim Pengembang</Text>
            </View>
            <Text className="text-xs text-slate-500 font-medium">Vasco, Falih, Kiral</Text>
          </View>
        </Card>

        <Button title="Kembali ke Beranda" onPress={() => router.replace("/(tabs)")} variant="outline" />
      </View>
    </ScrollView>
  );
}
