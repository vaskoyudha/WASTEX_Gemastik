import React, { useState } from "react";
import { Alert, View, Text, ScrollView, Image, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Header, Card, Badge } from "../src/components/ui";
import { CheckCircle2, XCircle, Eye, ThumbsDown } from "lucide-react-native";

type TabKey = "menunggu" | "disetujui" | "ditolak";

interface ValidationItem {
  id: string;
  title: string;
  source: string;
  thumbnail: string;
  risk: "Rendah" | "Sedang";
  difficulty: "Mudah" | "Sedang" | "Sulit";
  status: TabKey;
}

const initialItems: ValidationItem[] = [
  {
    id: "1",
    title: "Tas Anyaman dari Plastik Bekas",
    source: "Website",
    thumbnail: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=200&auto=format&fit=crop&q=60",
    risk: "Rendah",
    difficulty: "Sedang",
    status: "menunggu",
  },
  {
    id: "2",
    title: "Tempat Tisu Minimalis dari Kaleng",
    source: "YouTube",
    thumbnail: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=200&auto=format&fit=crop&q=60",
    risk: "Rendah",
    difficulty: "Mudah",
    status: "menunggu",
  },
  {
    id: "3",
    title: "Lampu Hias dari Botol Kaca",
    source: "Blog",
    thumbnail: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=200&auto=format&fit=crop&q=60",
    risk: "Sedang",
    difficulty: "Sulit",
    status: "menunggu",
  },
];

const statusBadge = {
  menunggu: { label: "Menunggu", bg: "bg-emerald-100", text: "text-emerald-800" },
  disetujui: { label: "Disetujui", bg: "bg-blue-100", text: "text-blue-800" },
  ditolak: { label: "Ditolak", bg: "bg-red-100", text: "text-red-800" },
};

export default function ExpertDashboardScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("menunggu");
  const [items, setItems] = useState<ValidationItem[]>(initialItems);

  const filtered = items.filter((i) => i.status === activeTab);
  const tabItems = ([
    { key: "menunggu", label: "Menunggu" },
    { key: "disetujui", label: "Disetujui" },
    { key: "ditolak", label: "Ditolak" },
  ] as { key: TabKey; label: string }[]).map((tab) => ({
    ...tab,
    count: items.filter((item) => item.status === tab.key).length,
  }));

  const handleReview = (item: ValidationItem) => {
    Alert.alert(
      "Detail Validasi",
      `${item.title}\nSumber: ${item.source}\nRisiko: ${item.risk}\nKesulitan: ${item.difficulty}`
    );
  };

  const handleReject = (id: string) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, status: "ditolak" } : item))
    );
    Alert.alert("Ditolak", "Skill dipindahkan ke tab Ditolak.");
  };

  return (
    <View className="flex-1 bg-slate-50">
      <Header title="Validasi Skill Baru" subtitle="Expert Dashboard (Preview)" onBack={() => router.back()} />

      <View className="px-6 pt-6">
        {/* Tabs */}
        <View className="flex-row bg-white rounded-2xl p-1 border border-slate-100 mb-5">
          {tabItems.map((t) => {
            const active = activeTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setActiveTab(t.key)}
                className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl ${
                  active ? "bg-brand" : "bg-transparent"
                }`}
              >
                <Text className={`text-xs font-bold mr-1 ${active ? "text-white" : "text-slate-500"}`}>
                  {t.label}
                </Text>
                {t.count > 0 && (
                  <View
                    className={`min-w-[18px] h-[18px] rounded-full items-center justify-center px-1 ${
                      active ? "bg-white" : "bg-emerald-100"
                    }`}
                  >
                    <Text className={`text-[10px] font-bold ${active ? "text-brand" : "text-emerald-700"}`}>
                      {t.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {filtered.length === 0 ? (
            <Card className="p-6 items-center border border-slate-100 bg-white">
              <Text className="text-sm font-bold text-slate-900 mb-1">Tidak ada item di tab ini</Text>
              <Text className="text-xs text-gray-600 text-center leading-5">
                Coba pindah ke tab lain atau tinjau item menunggu yang tersisa.
              </Text>
            </Card>
          ) : (
            filtered.map((item) => (
            <Card key={item.id} className="p-0 overflow-hidden border border-slate-100 mb-4">
              <View className="flex-row p-4">
                <Image source={{ uri: item.thumbnail }} className="w-16 h-16 rounded-xl bg-slate-200" />
                <View className="flex-1 ml-3 justify-center">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-xs text-slate-400">Sumber: {item.source}</Text>
                    <View className={`px-2 py-0.5 rounded-full ${statusBadge[item.status].bg}`}>
                      <Text className={`text-[10px] font-bold ${statusBadge[item.status].text}`}>
                        {statusBadge[item.status].label}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-sm font-bold text-slate-900 mb-2">{item.title}</Text>
                  <View className="flex-row items-center gap-3">
                    <Badge label={`Tingkat Risiko: ${item.risk}`} variant="neutral" size="sm" />
                    <Badge label={`Kesulitan: ${item.difficulty}`} variant="neutral" size="sm" />
                  </View>
                </View>
              </View>

              {activeTab === "menunggu" && (
                <View className="flex-row border-t border-slate-100 p-3 gap-3">
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleReview(item)}
                    className="flex-1 flex-row items-center justify-center py-3 rounded-2xl bg-emerald-50 border border-emerald-100"
                  >
                    <Eye size={16} color="#15803d" />
                    <Text className="text-xs font-semibold text-brand-dark ml-2">Tinjau</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleReject(item.id)}
                    className="flex-1 flex-row items-center justify-center py-3 rounded-2xl bg-red-50 border border-red-100"
                  >
                    <ThumbsDown size={16} color="#dc2626" />
                    <Text className="text-xs font-semibold text-red-600 ml-2">Tolak</Text>
                  </TouchableOpacity>
                </View>
              )}

              {activeTab !== "menunggu" && (
                <View className="flex-row border-t border-slate-100 px-4 py-3 items-center">
                  {activeTab === "disetujui" ? (
                    <>
                      <CheckCircle2 size={16} color="#16a34a" />
                      <Text className="text-xs font-semibold text-brand-dark ml-2">Diteruskan ke pustaka tutorial</Text>
                    </>
                  ) : (
                    <>
                      <XCircle size={16} color="#dc2626" />
                      <Text className="text-xs font-semibold text-red-600 ml-2">Ditolak karena data kurang lengkap</Text>
                    </>
                  )}
                </View>
              )}
            </Card>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}
