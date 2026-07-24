import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Card } from "../../src/components/ui";
import {
  Bell,
  Camera,
  ChevronRight,
  Leaf,
  Recycle,
  Sparkles,
  Store,
  TrendingUp,
  Upload,
} from "lucide-react-native";

const steps = [
  {
    icon: Upload,
    label: "Upload Sampah",
    description: "Ambil foto dari kamera atau pilih dari galeri.",
  },
  {
    icon: Sparkles,
    label: "AI Analisis & Rekomendasi",
    description: "Identifikasi material, risiko, dan ide produk yang cocok.",
  },
  {
    icon: Store,
    label: "Buat & Jual Produk",
    description: "Ikuti tutorial, lihat estimasi harga, lalu siapkan konten jualan.",
  },
];

const stats = [
  { icon: Recycle, value: "12.8 ton", label: "Sampah Diolah" },
  { icon: Store, value: "3.245", label: "Produk Dibuat" },
  { icon: TrendingUp, value: "Rp 128 jt", label: "Nilai Ekonomi" },
];

const categories = ["Plastik PET", "Plastik HDPE", "Kardus", "Kaleng", "Kaca", "Sachet"];

function HeroIllustration() {
  return (
    <View className="w-[112px] h-[136px] shrink-0 rounded-[28px] bg-emerald-50 border border-emerald-100 shadow-sm p-4 justify-between">
      <View className="flex-1 items-center justify-center">
        <View className="w-16 h-16 rounded-[24px] bg-white border border-emerald-100 items-center justify-center shadow-sm">
          <Recycle size={30} color="#16a34a" strokeWidth={2.4} />
        </View>
      </View>
      <View className="bg-white/80 border border-emerald-100 rounded-2xl px-3 py-2">
        <View className="h-2 rounded-full bg-emerald-200 w-full mb-2" />
        <View className="h-2 rounded-full bg-emerald-100 w-2/3" />
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1 bg-white"
        showsVerticalScrollIndicator={true}
        contentContainerStyle={{ paddingBottom: 132 }}
      >
        <View className="px-6 pt-5 pb-4 flex-row items-center justify-between bg-white border-b border-slate-100">
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-brand items-center justify-center mr-3">
              <Recycle size={20} color="#ffffff" />
            </View>
            <View>
              <Text className="text-lg font-bold text-slate-900 tracking-tight">WASTEX</Text>
              <Text className="text-[11px] font-medium text-gray-600 tracking-wide">AI Upcycling Agent</Text>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push("/notifications")}
            className="w-10 h-10 items-center justify-center rounded-full bg-slate-50"
          >
            <Bell size={20} color="#1e293b" />
          </TouchableOpacity>
        </View>

        <View className="bg-white px-5 pt-5 pb-8">
          <View className="flex-row items-center justify-between gap-4">
            <View className="flex-1 min-w-0 pr-1">
              <Text className="text-[28px] font-black text-slate-950 leading-[32px] tracking-tight">
                Ubah Sampah{"\n"}Menjadi Produk{"\n"}Bernilai Jual
              </Text>
              <Text className="text-sm font-normal text-gray-600 leading-6 mt-3">
                Platform AI Upcycling dengan panduan visual, estimasi harga, dan tips jual untuk semua orang.
              </Text>
            </View>

            <HeroIllustration />
          </View>

          <View className="flex-row gap-3 mt-5">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push("/scan/upload")}
              className="flex-1 flex-row items-center justify-center gap-2 bg-brand px-4 py-3.5 rounded-2xl shadow-sm"
            >
              <Camera size={18} color="#ffffff" />
              <Text className="text-white font-bold text-sm tracking-tight">Scan Sampah</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push("/scan/upload")}
              className="flex-1 flex-row items-center justify-center gap-2 border border-brand px-4 py-3.5 rounded-2xl bg-white"
            >
              <Upload size={18} color="#15803d" />
              <Text className="text-brand-dark font-bold text-sm tracking-tight">Upload Foto</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="px-5 mt-6">
          <Text className="text-base font-bold text-slate-900 tracking-tight">Bagaimana Cara Kerja?</Text>
          <View className="mt-5">
            {steps.map((step, idx) => (
              <View
                key={step.label}
                className={`flex-row items-start ${idx !== steps.length - 1 ? "pb-4 mb-4 border-b border-slate-100" : ""}`}
              >
                <View className="w-12 h-12 rounded-[20px] bg-emerald-50 items-center justify-center mr-4 border border-emerald-100">
                  <step.icon size={24} color="#16a34a" strokeWidth={2.2} />
                </View>
                <View className="flex-1 pt-0.5">
                  <Text className="text-base font-bold text-slate-900">{step.label}</Text>
                  <Text className="text-sm text-gray-600 leading-5 mt-1">{step.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className="px-5 mt-8">
          <Text className="text-base font-bold text-slate-900 tracking-tight">Dampak WASTEX</Text>
          <View className="mt-5 bg-white border border-slate-100 rounded-[24px] p-4 shadow-sm">
            {stats.map((stat, idx) => (
              <View
                key={stat.label}
                className={`flex-row items-center ${idx !== stats.length - 1 ? "pb-4 mb-4 border-b border-slate-100" : ""}`}
              >
                <View className="w-12 h-12 rounded-[20px] bg-emerald-50 items-center justify-center mr-4">
                  <stat.icon size={25} color="#16a34a" strokeWidth={2.2} />
                </View>
                <View className="flex-1">
                  <Text className="text-xl font-black text-slate-950 tracking-tight">{stat.value}</Text>
                  <Text className="text-sm font-semibold text-gray-600 mt-0.5">{stat.label}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className="px-5 mt-8">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-slate-900 tracking-tight">Kategori Material Didukung</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/materials")}
              className="flex-row items-center"
            >
              <Text className="text-xs font-semibold text-brand tracking-tight">Lihat Semua</Text>
              <ChevronRight size={14} color="#16a34a" />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-5 -mx-5"
            contentContainerStyle={{ gap: 14, paddingLeft: 20, paddingRight: 40, paddingVertical: 8 }}
          >
            {categories.map((cat) => (
              <Card
                key={cat}
                className="w-[102px] px-3 py-4 items-center border border-slate-100 shadow-sm rounded-[22px]"
              >
                <View className="w-12 h-12 rounded-[20px] bg-emerald-50 items-center justify-center mb-3">
                  <Leaf size={23} color="#16a34a" strokeWidth={2.2} />
                </View>
                <Text className="text-xs font-semibold text-gray-600 tracking-tight text-center leading-4">{cat}</Text>
              </Card>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}
