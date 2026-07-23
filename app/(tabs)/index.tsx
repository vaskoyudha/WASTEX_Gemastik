import React from "react";
import { Alert, View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Card } from "../../src/components/ui";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import {
  Bell,
  Camera,
  ChevronRight,
  Home,
  Recycle,
  Sparkles,
  Store,
  Upload,
} from "lucide-react-native";

const steps = [
  { icon: Upload, label: "Upload Sampah" },
  { icon: Sparkles, label: "AI Analisis & Rekomendasi" },
  { icon: Store, label: "Buat & Jual Produk" },
];

const stats = [
  { value: "12.8 ton", label: "Sampah Diolah" },
  { value: "3.245", label: "Produk Dibuat" },
  { value: "Rp 128 jt", label: "Nilai Ekonomi" },
];

const categories = ["Plastik PET", "Plastik HDPE", "Kardus", "Kaleng", "Kaca", "Sachet"];

function UpcyclingIllustration() {
  return (
    <Svg width="132" height="156" viewBox="0 0 132 156" fill="none">
      <Circle cx="68" cy="74" r="58" fill="#DCFCE7" />
      <Rect x="20" y="94" width="40" height="36" rx="8" fill="#16A34A" />
      <Path d="M24 94H56L50 130H30L24 94Z" fill="#15803D" />
      <Path d="M32 90C32 76 48 76 48 90" stroke="#0F172A" strokeWidth="5" strokeLinecap="round" />
      <Path d="M40 86C40 68 58 66 66 50" stroke="#16A34A" strokeWidth="5" strokeLinecap="round" />
      <Path d="M66 50C78 52 84 60 84 70C72 70 66 62 66 50Z" fill="#22C55E" />
      <Rect x="80" y="52" width="26" height="62" rx="13" fill="#FACC15" />
      <Rect x="86" y="40" width="14" height="20" rx="6" fill="#15803D" />
      <Path d="M93 114V132" stroke="#0F172A" strokeWidth="5" strokeLinecap="round" />
      <Path d="M76 134H110" stroke="#0F172A" strokeWidth="5" strokeLinecap="round" />
      <Circle cx="93" cy="78" r="8" fill="#FEFCE8" />
      <Path d="M16 44H44" stroke="#16A34A" strokeWidth="5" strokeLinecap="round" />
      <Path d="M26 32L16 44L26 56" stroke="#16A34A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M116 112H88" stroke="#16A34A" strokeWidth="5" strokeLinecap="round" />
      <Path d="M106 100L116 112L106 124" stroke="#16A34A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingBottom: 28 }}>
      <View className="px-6 pt-14 pb-4 flex-row items-center justify-between bg-white border-b border-slate-100">
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
          onPress={() => Alert.alert("Notifikasi", "Belum ada notifikasi baru untuk saat ini.")}
          className="w-10 h-10 items-center justify-center rounded-full bg-slate-50"
        >
          <Bell size={20} color="#1e293b" />
        </TouchableOpacity>
      </View>

      <View className="bg-white px-5 pb-8 rounded-b-[32px]">
        <View className="flex-row items-center pt-2">
          <View className="flex-1 pr-3">
            <Text className="text-[29px] font-black text-slate-900 leading-[33px] tracking-tight mb-3">
              Ubah Sampah{"\n"}Menjadi Produk{"\n"}Bernilai Jual
            </Text>
            <Text className="text-sm font-normal text-gray-600 leading-6 mb-5 max-w-[320px]">
              Platform AI Upcycling dengan panduan visual, estimasi harga, dan tips jual untuk semua orang.
            </Text>
            <View className="flex-row gap-3 mt-1">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push("/scan/upload")}
                className="flex-row items-center gap-2 bg-brand px-5 py-3.5 rounded-2xl shadow-sm"
              >
                <Camera size={18} color="#ffffff" />
                <Text className="text-white font-bold text-sm tracking-tight">Scan Sampah</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push("/scan/upload")}
                className="flex-row items-center gap-2 border border-brand px-5 py-3.5 rounded-2xl bg-white"
              >
                <Upload size={18} color="#15803d" />
                <Text className="text-brand-dark font-bold text-sm tracking-tight">Upload Foto</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="w-[148px] h-[184px] rounded-[28px] overflow-hidden bg-emerald-50 items-center justify-center p-2 border border-emerald-100">
            <UpcyclingIllustration />
          </View>
        </View>
      </View>

      <View className="px-5 mt-7">
        <Text className="text-base font-bold text-slate-900 tracking-tight">Bagaimana Cara Kerja?</Text>
        <View className="flex-row items-stretch gap-4 mt-5">
          {steps.map((step, idx) => (
            <Card key={step.label} className="flex-1 p-3 bg-white border border-slate-100 items-center">
              <View className="w-12 h-12 rounded-full bg-emerald-50 items-center justify-center mb-3 border border-emerald-100">
                <step.icon size={22} color="#16a34a" />
              </View>
              <Text className="text-[11px] font-semibold text-gray-700 text-center leading-4">{step.label}</Text>
              {idx < steps.length - 1 && (
                <View className="absolute right-[-16px] top-[38px] z-10">
                  <ChevronRight size={16} color="#94a3b8" />
                </View>
              )}
            </Card>
          ))}
        </View>
      </View>

      <View className="px-5 mt-8">
        <Text className="text-base font-bold text-slate-900 tracking-tight">Dampak WASTEX</Text>
        <View className="flex-row gap-4 mt-5">
          {stats.map((s) => (
            <View key={s.label} className="flex-1 mx-1 bg-white border border-slate-100 rounded-2xl p-4 items-center shadow-sm">
              <Text className="text-[17px] font-black text-slate-900 mb-1 tracking-tight">{s.value}</Text>
              <Text className="text-[10px] font-semibold text-gray-600 text-center leading-4 tracking-wide uppercase">
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View className="px-5 mt-8">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-bold text-slate-900 tracking-tight">Kategori Material Didukung</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => Alert.alert("Material Didukung", categories.join(", "))}
            className="flex-row items-center"
          >
            <Text className="text-xs font-semibold text-brand tracking-tight">Lihat Semua</Text>
            <ChevronRight size={14} color="#16a34a" />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-5" contentContainerStyle={{ gap: 16, paddingHorizontal: 2 }}>
          {categories.map((cat) => (
            <View key={cat} className="bg-white border border-slate-100 px-4 py-3 rounded-2xl items-center mx-2 shadow-sm min-w-[92px]">
              <View className="w-10 h-10 rounded-full bg-emerald-50 items-center justify-center mb-2">
                <Recycle size={18} color="#16a34a" />
              </View>
              <Text className="text-xs font-semibold text-gray-700 tracking-tight text-center">{cat}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}
