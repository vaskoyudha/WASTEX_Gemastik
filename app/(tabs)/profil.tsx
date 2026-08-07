import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Header, Card, Button } from "../../src/components/ui";
import { auth } from "../../src/services/auth";
import { impact } from "../../src/services";
import { Award, Info, Shield, Trash2, User, LogOut, Edit, Save } from "lucide-react-native";
import { Input } from "../../src/components/ui/Input";
import { apiClient } from "../../src/services/api";
import type { Skill } from "../../src/services/types";
import { colors, gradients, gradientStyle, radii } from "../../src/theme";

export default function ProfilScreen() {
  const router = useRouter();
  const user = auth.getUser();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.profile?.displayName ?? "");
  const [firstName, setFirstName] = useState(user?.profile?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.profile?.lastName ?? "");
  const [bio, setBio] = useState(user?.profile?.bio ?? "");
  const [phone, setPhone] = useState(user?.profile?.phone ?? "");
  const [loading, setLoading] = useState(false);
  const [mySkills, setMySkills] = useState<Skill[]>([]);

  useEffect(() => {
    if (user?.profile) {
      setDisplayName(user.profile.displayName);
      setFirstName(user.profile.firstName ?? "");
      setLastName(user.profile.lastName ?? "");
      setBio(user.profile.bio ?? "");
      setPhone(user.profile.phone ?? "");
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const skills = (await apiClient.getSkills({ mine: true })) as Skill[];
        setMySkills(Array.isArray(skills) ? skills : []);
      } catch {
        setMySkills([]);
      }
    })();
  }, [user]);

  const statusLabel = (status: string): string =>
    status === "pending"
      ? "Menunggu"
      : status === "approved"
      ? "Disetujui"
      : status === "rejected"
      ? "Ditolak"
      : "Perlu Revisi";

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await auth.updateProfile({
        displayName,
        firstName: firstName || null,
        lastName: lastName || null,
        bio: bio || null,
        phone: phone || null,
      });
      setEditing(false);
      Alert.alert("Berhasil", "Profil diperbarui.");
    } catch {
      Alert.alert("Gagal", "Perubahan profil gagal disimpan.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Keluar", "Apakah Anda yakin ingin keluar?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Keluar",
        style: "destructive",
        onPress: async () => {
          try {
            await auth.signOut();
            Alert.alert("Berhasil", "Anda telah keluar.");
            router.replace("/(tabs)/login");
          } catch {
            Alert.alert("Gagal", "Logout gagal.");
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Hapus Akun",
      "Semua data Anda termasuk profile, riwayat scan, dan proyek akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus Akun",
          style: "destructive",
          onPress: async () => {
            try {
              await auth.deleteAccount();
              Alert.alert("Berhasil", "Akun telah dihapus.");
              router.replace("/(tabs)/login");
            } catch {
              Alert.alert("Gagal", "Penghapusan akun gagal.");
            }
          },
        },
      ]
    );
  };

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
            } catch {
              Alert.alert("Gagal", "Data belum bisa dibersihkan saat ini.");
            }
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: colors.forest900, ...gradientStyle(gradients.home) }}
      >
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, paddingBottom: 76 }}>
          <Header title="Profil & Pengaturan" subtitle="Silakan masuk untuk mengelola akun Anda" />
          <View style={{ flex: 1, minHeight: 640, paddingHorizontal: 20, paddingTop: 26, backgroundColor: colors.cream50, ...gradientStyle(gradients.contentSheet), borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}>
            <Card className="p-6 items-center mb-6 rounded-[24px]">
              <View style={{ width: 66, height: 66, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.mist100, marginBottom: 16 }}>
                <User size={32} color={colors.forest600} />
              </View>
              <Text className="text-center mb-6" style={{ color: colors.ink600 }}>
                Silakan masuk untuk melihat dan mengelola profil Anda
              </Text>
              <Button 
                title="Masuk Sekarang" 
                onPress={() => router.push("/(tabs)/login")} 
                fullWidth
              />
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.forest900, ...gradientStyle(gradients.home) }}
    >
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, paddingBottom: 76 }}>
        <Header title="Profil & Pengaturan" subtitle="Kelola akun dan preferensi aplikasi" />
        
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 22, backgroundColor: colors.cream50, ...gradientStyle(gradients.contentSheet), borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}>
          {/* Profile Card */}
          <Card
            className="p-5 flex-row items-center mb-6 rounded-[24px] border-0 overflow-hidden"
            style={{ backgroundColor: colors.forest700, ...gradientStyle(gradients.impact) }}
          >
            <View style={{ width: 62, height: 62, borderRadius: 22, alignItems: "center", justifyContent: "center", marginRight: 14, backgroundColor: colors.lime300, ...gradientStyle(gradients.scanButton) }}>
              <User size={29} color={colors.forest900} />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold" style={{ color: colors.white }}>{user.profile?.displayName}</Text>
              <Text className="text-xs" style={{ color: "rgba(255,255,255,0.68)" }}>{user.email}</Text>
              {!editing && (
                <View className="mt-2 px-2.5 py-0.5 rounded-md self-start" style={{ backgroundColor: "rgba(220,245,167,0.2)" }}>
                  <Text className="text-xs font-semibold" style={{ color: colors.lime300 }}>Akun Terverifikasi</Text>
                </View>
              )}
            </View>
            {!editing && (
              <TouchableOpacity 
                onPress={() => setEditing(true)}
                activeOpacity={0.7}
                className="ml-2 p-2"
              >
                <Edit size={20} color={colors.cream50} />
              </TouchableOpacity>
            )}
          </Card>

          {/* Edit Form */}
          {editing && (
            <Card className="p-5 mb-6">
              <Input 
                label="Nama Tampilan" 
                placeholder="Nama tampilan Anda" 
                value={displayName} 
                onChangeText={setDisplayName} 
              />
              <Input 
                label="Nama Depan" 
                placeholder="Opsional" 
                value={firstName} 
                onChangeText={setFirstName} 
              />
              <Input 
                label="Nama Belakang" 
                placeholder="Opsional" 
                value={lastName} 
                onChangeText={setLastName} 
              />
              <Input 
                label="Bio" 
                placeholder="Ceritakan tentang Anda" 
                value={bio} 
                onChangeText={setBio} 
                multiline 
                numberOfLines={3} 
              />
              <Input 
                label="Nomor Telepon" 
                placeholder="+62..." 
                value={phone} 
                onChangeText={setPhone} 
                keyboardType="phone-pad" 
              />
              <View className="flex-row gap-3 mt-4">
                <Button 
                  title="Batal" 
                  onPress={() => {
                    setEditing(false);
                    if (user?.profile) {
                      setDisplayName(user.profile.displayName);
                      setFirstName(user.profile.firstName ?? "");
                      setLastName(user.profile.lastName ?? "");
                      setBio(user.profile.bio ?? "");
                      setPhone(user.profile.phone ?? "");
                    }
                  }} 
                  variant="outline"
                  className="flex-1"
                />
                <Button 
                  title="Simpan" 
                  onPress={handleSaveProfile} 
                  loading={loading}
                  fullWidth
                  className="flex-1"
                />
              </View>
            </Card>
          )}

          {/* Skill Saya Section */}
          {user && mySkills.length > 0 && (
            <View className="mt-6">
              <Text className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: colors.forest600 }}>Skill Saya</Text>
              {mySkills.map((skill) => (
                <Card key={skill.id} className="mb-3 p-4">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-bold flex-1 mr-3" style={{ color: colors.ink900 }}>{skill.title}</Text>
                    <Text className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: colors.forest800, backgroundColor: colors.sage200 }}>
                      {statusLabel(skill.status)}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          )}

          {/* Mode Ahli Section */}
          <Text className="text-xs font-bold uppercase tracking-wider mb-3 px-1" style={{ color: colors.forest600 }}>Mode Ahli</Text>
          <Card className="p-4 mb-6">
            <TouchableOpacity
              onPress={() => router.push("/expert-dashboard")}
              className="flex-row items-center justify-between py-2"
              activeOpacity={0.7}
            >
              <View className="flex-row items-center">
                <Award size={20} color={colors.forest600} />
                <Text className="font-medium ml-3 text-sm" style={{ color: colors.ink900 }}>Expert Dashboard</Text>
              </View>
            </TouchableOpacity>
          </Card>

          {/* Privasi & Keamanan Section */}
          <Text className="text-xs font-bold uppercase tracking-wider mb-3 px-1" style={{ color: colors.forest600 }}>
            Privasi & Keamanan Data
          </Text>
          <Card className="p-4 mb-6">
            <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
              <View className="flex-row items-center">
                <Shield size={20} color={colors.forest600} />
                <Text className="font-medium ml-3 text-sm" style={{ color: colors.ink900 }}>Enkripsi & Consent (UU PDP)</Text>
              </View>
              <Text className="text-xs font-semibold" style={{ color: colors.forest600 }}>Aktif</Text>
            </View>
            <TouchableOpacity
              onPress={handleClearData}
              className="flex-row items-center justify-between py-3 border-b border-slate-100"
              activeOpacity={0.7}
            >
              <View className="flex-row items-center">
                <Trash2 size={20} color="#dc2626" />
                <Text className="text-red-600 font-medium ml-3 text-sm">Hapus Data Proyek & Reset</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogout}
              className="flex-row items-center justify-between py-3 border-b border-slate-100"
              activeOpacity={0.7}
            >
              <View className="flex-row items-center">
                <LogOut size={20} color="#f59e0b" />
                <Text className="text-orange-600 font-medium ml-3 text-sm">Keluar dari Akun</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDeleteAccount}
              className="flex-row items-center justify-between py-3"
              activeOpacity={0.7}
            >
              <View className="flex-row items-center">
                <Trash2 size={20} color="#ef4444" />
                <Text className="text-red-600 font-medium ml-3 text-sm">Hapus Akun Permanen</Text>
              </View>
            </TouchableOpacity>
          </Card>

          {/* Tentang Aplikasi Section */}
          <Text className="text-xs font-bold uppercase tracking-wider mb-3 px-1" style={{ color: colors.forest600 }}>
            Tentang Aplikasi
          </Text>
          <Card className="p-4 mb-6">
            <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
              <View className="flex-row items-center">
                <Info size={20} color={colors.forest600} />
                <Text className="font-medium ml-3 text-sm" style={{ color: colors.ink900 }}>Versi Aplikasi</Text>
              </View>
              <Text className="text-xs text-slate-500 font-medium">1.0.0 (Gemastik XVIII)</Text>
            </View>
            <View className="flex-row items-center justify-between py-3">
              <View className="flex-row items-center">
                <User size={20} color={colors.forest600} />
                <Text className="font-medium ml-3 text-sm" style={{ color: colors.ink900 }}>Tim Pengembang</Text>
              </View>
              <Text className="text-xs text-slate-500 font-medium">Vasco, Falih, Kiral</Text>
            </View>
          </Card>

          <Button title="Kembali ke Beranda" onPress={() => router.replace("/(tabs)")} variant="outline" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
