import React, { useCallback, useEffect, useState } from "react";
import { Alert, View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Header, Card, Badge } from "../src/components/ui";
import { auth } from "../src/services/auth";
import { apiClient } from "../src/services/api";
import type { Skill, SkillStatus } from "../src/services/types";
import { safeBack } from "../src/lib/navigation";
import { CheckCircle2, XCircle, Eye, ThumbsDown } from "lucide-react-native";

type TabKey = "pending" | "approved" | "rejected";

const TABS: { key: TabKey; label: string }[] = [
  { key: "pending", label: "Menunggu" },
  { key: "approved", label: "Disetujui" },
  { key: "rejected", label: "Ditolak" },
];

const statusBadge: Record<TabKey, { label: string; bg: string; text: string }> = {
  pending: { label: "Menunggu", bg: "bg-emerald-100", text: "text-emerald-800" },
  approved: { label: "Disetujui", bg: "bg-blue-100", text: "text-blue-800" },
  rejected: { label: "Ditolak", bg: "bg-red-100", text: "text-red-800" },
};

export default function ExpertDashboardScreen() {
  const router = useRouter();
  const user = auth.getUser();
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [items, setItems] = useState<Record<TabKey, Skill[]>>({ pending: [], approved: [], rejected: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pending, approved, rejected] = (await Promise.all([
        apiClient.getSkills({ status: "pending" }),
        apiClient.getSkills({ status: "approved" }),
        apiClient.getSkills({ status: "rejected" }),
      ])) as [Skill[], Skill[], Skill[]];
      setItems({ pending, approved, rejected });
    } catch {
      Alert.alert("Gagal", "Skill belum bisa dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, status: SkillStatus) => {
    console.log("DEBUG setStatus entered", id, status, typeof apiClient.updateSkillStatus);
    try {
      await apiClient.updateSkillStatus(id, { status, reviewed_by: user?.id });
      await load();
    } catch {
      Alert.alert("Gagal", "Status skill belum bisa diperbarui.");
    }
  };

  const handleReview = (item: Skill) => {
    Alert.alert(
      "Detail Validasi",
      `${item.title}\nMaterial: ${item.material}\nKesulitan: ${item.difficulty}`,
      [
        { text: "Tutup", style: "cancel" },
        {
          text: "Tolak",
          style: "destructive",
          onPress: () => setStatus(item.id, "rejected"),
        },
        {
          text: "Setujui",
          onPress: () => setStatus(item.id, "approved"),
        },
      ]
    );
  };

  const filtered = items[activeTab];

  return (
    <View className="flex-1 bg-slate-50">
      <Header title="Validasi Skill Baru" subtitle="Expert Dashboard" onBack={() => safeBack(router)} />

      <View className="px-6 pt-6">
        <View className="flex-row bg-white rounded-2xl p-1 border border-slate-100 mb-5">
          {TABS.map((t) => {
            const active = activeTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setActiveTab(t.key)}
                className={`flex-1 items-center justify-center py-2.5 rounded-xl ${
                  active ? "bg-brand" : "bg-transparent"
                }`}
              >
                <Text className={`text-xs font-bold ${active ? "text-white" : "text-slate-500"}`}>
                  {t.label} ({items[t.key].length})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {loading ? (
            <Text className="text-xs text-slate-500 text-center py-8">Memuat skill...</Text>
          ) : filtered.length === 0 ? (
            <Card className="p-6 items-center border border-slate-100 bg-white">
              <Text className="text-sm font-bold text-slate-900 mb-1">Tidak ada item di tab ini</Text>
            </Card>
          ) : (
            filtered.map((item) => (
              <Card key={item.id} className="p-0 overflow-hidden border border-slate-100 mb-4">
                <View className="flex-row p-4">
                  <View className="flex-1 ml-3 justify-center">
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-xs text-slate-400">Material: {item.material}</Text>
                      <View className={`px-2 py-0.5 rounded-full ${statusBadge[activeTab].bg}`}>
                        <Text className={`text-[10px] font-bold ${statusBadge[activeTab].text}`}>
                          {statusBadge[activeTab].label}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-sm font-bold text-slate-900 mb-2">{item.title}</Text>
                    <View className="flex-row items-center gap-3">
                      <Badge label={`Kesulitan: ${item.difficulty}`} variant="neutral" size="sm" />
                    </View>
                  </View>
                </View>

                {activeTab === "pending" && (
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
                      onPress={() => setStatus(item.id, "rejected")}
                      className="flex-1 flex-row items-center justify-center py-3 rounded-2xl bg-red-50 border border-red-100"
                    >
                      <ThumbsDown size={16} color="#dc2626" />
                      <Text className="text-xs font-semibold text-red-600 ml-2">Tolak</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {activeTab !== "pending" && (
                  <View className="flex-row border-t border-slate-100 px-4 py-3 items-center">
                    {activeTab === "approved" ? (
                      <>
                        <CheckCircle2 size={16} color="#16a34a" />
                        <Text className="text-xs font-semibold text-brand-dark ml-2">
                          Disetujui — tersedia di pustaka skill
                        </Text>
                      </>
                    ) : (
                      <>
                        <XCircle size={16} color="#dc2626" />
                        <Text className="text-xs font-semibold text-red-600 ml-2">Ditolak oleh expert</Text>
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