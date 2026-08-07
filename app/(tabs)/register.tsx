import React, { useState } from "react";
import { View, Text, Alert, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Header, Button, Card } from "../../src/components/ui";
import { auth } from "../../src/services/auth";
import { Input } from "../../src/components/ui/Input";

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    setError(null);
    if (!email || !password || !displayName) {
      setError("Email, kata sandi, dan nama tampilan harus diisi");
      return;
    }
    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter");
      return;
    }

    setLoading(true);
    try {
      await auth.signUp(email, password, displayName, {
        firstName: firstName || null,
        lastName: lastName || null,
        bio: bio || null,
        phone: phone || null,
      });
      Alert.alert("Berhasil", "Akun berhasil dibuat!");
      router.replace("/(tabs)");
    } catch (err: any) {
      setError(err.message || "Pendaftaran gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-cream-50">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Header title="Daftar" subtitle="Buat akun WASTEX baru" />
        <View className="px-6 pt-6">
          <Card className="p-6">
            <Input 
              label="Email" 
              placeholder="nama@example.com" 
              value={email} 
              onChangeText={setEmail} 
              keyboardType="email-address" 
              autoCapitalize="none" 
            />
            <Input 
              label="Nama Tampilan" 
              placeholder="Nama Anda" 
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
              placeholder="Ceritakan tentang Anda (opsional)" 
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
            <Input 
              label="Kata Sandi" 
              placeholder="Minimal 8 karakter" 
              secureTextEntry 
              value={password} 
              onChangeText={setPassword} 
            />
            {error && password && <Text className="text-xs text-red-600 mb-4">{error}</Text>}
            <Button 
              title="Daftar" 
              onPress={handleRegister} 
              loading={loading} 
              fullWidth 
              className="mt-4" 
            />
            <View className="flex-row justify-center mt-6">
              <Text className="text-sm text-slate-600">Sudah punya akun? </Text>
              <Text 
                className="text-sm text-brand font-semibold" 
                onPress={() => router.push("/(tabs)/login")}
              >
                Masuk
              </Text>
            </View>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
