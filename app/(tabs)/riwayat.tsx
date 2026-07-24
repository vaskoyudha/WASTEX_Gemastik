import React, { useCallback, useState } from "react";
import { Alert, Image, Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { CalendarDays, Camera, ChevronRight, History, Package, Trash2 } from "lucide-react-native";
import { Badge, Button, Card, EmptyState, Header, LoadingSpinner } from "../../src/components/ui";
import { impact } from "../../src/services";
import { SavedProject } from "../../src/services/types";
import { formatRupiah } from "../../src/lib/format";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getProjectKey(project: SavedProject) {
  return project.id || `${project.savedAt}-${project.product.id}`;
}

export default function RiwayatScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<SavedProject | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await impact.getHistory();
      setHistory(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const handleDelete = async (project: SavedProject) => {
    const projectKey = getProjectKey(project);
    const previousHistory = history;

    setDeletingId(projectKey);
    setHistory((current) => current.filter((item) => getProjectKey(item) !== projectKey));
    try {
      await impact.deleteProject(project.id);
      setDeleteTarget(null);
    } catch {
      setHistory(previousHistory);
      Alert.alert("Gagal", "Riwayat tidak dapat dihapus saat ini.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <View className="flex-1 bg-slate-50">
      <Header title="Riwayat" subtitle="Proyek upcycling yang sudah kamu simpan" />

      {loading ? (
        <LoadingSpinner fullScreen message="Memuat riwayat..." />
      ) : history.length === 0 ? (
        <EmptyState
          title="Belum Ada Riwayat"
          description="Selesaikan alur scan sampai AI Selling Assistant, lalu simpan proyek untuk mencatat riwayat dan impact."
          icon={<History size={32} color="#16a34a" />}
          actionLabel="Mulai Scan"
          onAction={() => router.push("/scan/upload")}
        />
      ) : (
        <ScrollView className="flex-1 px-5 pt-5" contentContainerStyle={{ paddingBottom: 36 }}>
          <Card className="bg-emerald-50 border-emerald-100 p-5 mb-5 rounded-[28px]">
            <View className="flex-row items-center">
              <View className="w-14 h-14 rounded-full bg-brand items-center justify-center mr-4">
                <History size={28} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-black text-slate-900 tracking-tight">Riwayat Upcycling</Text>
                <Text className="text-sm text-gray-700 leading-5 mt-1">
                  {history.length} proyek tersimpan di perangkat ini.
                </Text>
              </View>
            </View>
          </Card>

          {history.map((project) => {
            const projectKey = getProjectKey(project);

            return (
            <Card key={projectKey} className="p-0 overflow-hidden border border-slate-100 mb-4">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push(`/product/${project.product.id}`)}
                className="flex-row p-4"
              >
                <Image source={{ uri: project.photoUri }} className="w-24 h-24 rounded-2xl bg-slate-200" resizeMode="cover" />
                <View className="flex-1 ml-4 justify-between">
                  <View>
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-base font-bold text-slate-900 flex-1 pr-2" numberOfLines={1}>
                        {project.product.name}
                      </Text>
                      <ChevronRight size={16} color="#16a34a" />
                    </View>
                    <Text className="text-xs text-slate-500 leading-4" numberOfLines={2}>
                      {project.product.shortDescription}
                    </Text>
                  </View>

                  <View className="flex-row flex-wrap items-center gap-2 mt-3">
                    <Badge label={project.material.materialLabel} variant="brand" size="sm" />
                    <Badge variant={project.material.riskLevel} size="sm" />
                  </View>
                </View>
              </TouchableOpacity>

              <View className="border-t border-slate-100 px-4 py-3 flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <View className="flex-row items-center mb-1">
                    <CalendarDays size={13} color="#64748b" />
                    <Text className="text-[11px] text-slate-500 ml-1">{formatDate(project.savedAt)}</Text>
                  </View>
                  <View className="flex-row items-center">
                    <Package size={13} color="#64748b" />
                    <Text className="text-[11px] font-semibold text-brand-dark ml-1">
                      Est. {formatRupiah(project.product.estimatedCost)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  disabled={deletingId === projectKey}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => setDeleteTarget(project)}
                  className={`w-11 h-11 rounded-full items-center justify-center ${
                    deletingId === projectKey ? "bg-slate-100 opacity-60" : "bg-red-50"
                  }`}
                >
                  <Trash2 size={18} color="#dc2626" />
                </TouchableOpacity>
              </View>
            </Card>
            );
          })}

          <Button
            title="Tambah Riwayat Baru"
            icon={<Camera size={18} color="#ffffff" />}
            onPress={() => router.push("/scan/upload")}
            variant="primary"
          />
        </ScrollView>
      )}

      <Modal
        visible={!!deleteTarget}
        animationType="fade"
        transparent
        onRequestClose={() => setDeleteTarget(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <View className="w-full max-w-sm rounded-3xl bg-white p-6">
            <View className="w-14 h-14 rounded-full bg-red-50 items-center justify-center mb-4 self-center">
              <Trash2 size={28} color="#dc2626" />
            </View>
            <Text className="text-lg font-bold text-slate-900 text-center mb-2">Hapus Riwayat?</Text>
            <Text className="text-sm text-slate-600 text-center leading-5 mb-6">
              Data proyek ini akan dihapus dari Riwayat dan tidak muncul lagi di perangkat ini.
            </Text>
            <View className="flex-row gap-3">
              <Button
                title="Batal"
                variant="outline"
                className="flex-1"
                disabled={!!deletingId}
                onPress={() => setDeleteTarget(null)}
              />
              <Button
                title="Hapus"
                variant="danger"
                className="flex-1"
                loading={!!deletingId}
                onPress={() => deleteTarget && handleDelete(deleteTarget)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
