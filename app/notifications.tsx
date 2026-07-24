import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Bell, CheckCircle2, Leaf, Sparkles } from "lucide-react-native";
import { Header, Card, Badge } from "../src/components/ui";
import { safeBack } from "../src/lib/navigation";

const notifications = [
  {
    id: "scan-ready",
    title: "Scan siap digunakan",
    body: "Kamera dan galeri sudah bisa dipakai untuk memulai alur upcycling.",
    icon: Sparkles,
    status: "Aktif",
  },
  {
    id: "impact-local",
    title: "Impact tersimpan lokal",
    body: "Proyek yang disimpan akan masuk ke Impact Tracker di perangkat ini.",
    icon: Leaf,
    status: "Lokal",
  },
  {
    id: "bookmark-ready",
    title: "Bookmark dan favorit aktif",
    body: "Produk yang kamu simpan sekarang tercatat di penyimpanan lokal aplikasi.",
    icon: CheckCircle2,
    status: "Baru",
  },
];

export default function NotificationsScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-slate-50">
      <Header title="Notifikasi" subtitle="Kabar terbaru dari WASTEX" onBack={() => safeBack(router)} />
      <ScrollView className="flex-1 px-5 pt-5" contentContainerStyle={{ paddingBottom: 32 }}>
        <Card className="bg-emerald-50 border-emerald-100 p-5 mb-5">
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-full bg-brand items-center justify-center mr-4">
              <Bell size={24} color="#ffffff" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-black text-slate-900">Pusat Notifikasi</Text>
              <Text className="text-xs text-slate-600 leading-5 mt-1">
                Semua status penting aplikasi ditampilkan di sini.
              </Text>
            </View>
          </View>
        </Card>

        {notifications.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.id} className="p-4 mb-4 border border-slate-100">
              <View className="flex-row items-start">
                <View className="w-10 h-10 rounded-2xl bg-emerald-50 items-center justify-center mr-3">
                  <Icon size={20} color="#16a34a" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-sm font-bold text-slate-900 flex-1 pr-3">{item.title}</Text>
                    <Badge label={item.status} variant="brand" size="sm" />
                  </View>
                  <Text className="text-xs text-slate-600 leading-5">{item.body}</Text>
                </View>
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}
