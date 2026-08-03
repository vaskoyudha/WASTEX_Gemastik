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
        setMySkills(skills);
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
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-slate-50">
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <Header title="Profil & Pengaturan" subtitle="Silakan masuk untuk mengelola akun Anda" />
          <View className="px-6 pt-6">
            <Card className="p-6 items-center mb-6">
              <User size={48} color="#94a3b8" className="mb-4" />
              <Text className="text-slate-600 text-center mb-6">
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
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-slate-50">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Header title="Profil & Pengaturan" subtitle="Kelola akun dan preferensi aplikasi" />
        
        <View className="px-6 pt-6">
          {/* Profile Card */}
          <Card className="p-5 flex-row items-center mb-6">
            <View className="w-16 h-16 rounded-full bg-brand-light items-center justify-center mr-4">
              <User size={32} color="#16a34a" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-slate-900">{user.profile.displayName}</Text>
              <Text className="text-xs text-slate-500">{user.email}</Text>
              {!editing && (
                <View className="mt-2 bg-emerald-50 px-2.5 py-0.5 rounded-md self-start">
                  <Text className="text-xs font-semibold text-brand-dark">Akun Terverifikasi</Text>
                </View>
              )}
            </View>
            {!editing && (
              <TouchableOpacity 
                onPress={() => setEditing(true)}
                activeOpacity={0.7}
                className="ml-2 p-2"
              >
                <Edit size={20} color="#16a34a" />
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
                  flex={1}
                />
                <Button 
                  title="Simpan" 
                  onPress={handleSaveProfile} 
                  loading={loading}
                  fullWidth
                  flex={1}
                />
              </View>
            </Card>
          )}

          {/* Skill Saya Section */}
          {user && mySkills.length > 0 && (
            <View className="mt-6">
              <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-6">Skill Saya</Text>
              {mySkills.map((skill) => (
                <Card key={skill.id} className="mx-6 mb-3 p-4 border border-slate-100">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-bold text-slate-900 flex-1 mr-3">{skill.title}</Text>
                    <Text className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      {statusLabel(skill.status)}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          )}

          {/* Mode Ahli Section */}
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

          {/* Privasi & Keamanan Section */}
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
    </KeyboardAvoidingView>
  );
}
