import React, { useState } from "react";
import { Alert, Image, Modal, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { CalendarDays, Camera, ChevronRight, History, Package, Trash2 } from "lucide-react-native";
import { Button, EmptyState, Header, LoadingSpinner, PressableScale } from "../../src/components/ui";
import { SavedProject } from "../../src/services/types";
import { formatRupiah } from "../../src/lib/format";
import { useImpactData } from "../../src/hooks/useImpactData";
import { colors, gradients, gradientStyle, radii, shadows } from "../../src/theme";

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
  const [deleteTarget, setDeleteTarget] = useState<SavedProject | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { history, loading, error, deleteProject, refresh } = useImpactData();

  const handleDelete = async (project: SavedProject) => {
    const projectKey = getProjectKey(project);

    setDeletingId(projectKey);
    try {
      await deleteProject(project.id);
      setDeleteTarget(null);
    } catch {
      Alert.alert("Gagal", "Riwayat tidak dapat dihapus saat ini.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest900, ...gradientStyle(gradients.home) }}>
      <Header title="Riwayat" subtitle="Proyek upcycling yang sudah kamu simpan" />

      <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18 }}>
        <View
          style={{
            padding: 18,
            borderRadius: radii.xl,
            borderCurve: "continuous",
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            backgroundColor: colors.forest700,
            ...gradientStyle(gradients.impact),
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.11)",
            boxShadow: shadows.floating,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(220,245,167,0.28)",
            }}
          >
            <History size={23} color={colors.lime300} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: colors.white, fontFamily: "Inter_700Bold", fontSize: 16, letterSpacing: -0.3 }}>
              Riwayat Upcycling
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 11, lineHeight: 16 }}>
              {history.length} proyek tersimpan di perangkat ini
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text selectable style={{ color: colors.white, fontFamily: "Inter_700Bold", fontSize: 24, fontVariant: ["tabular-nums"] }}>
              {history.length}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.62)", fontSize: 9 }}>proyek</Text>
          </View>
        </View>
      </View>

      <View
        style={{
          flex: 1,
          borderTopLeftRadius: radii.sheet,
          borderTopRightRadius: radii.sheet,
          borderCurve: "continuous",
          overflow: "hidden",
          backgroundColor: colors.cream50,
          ...gradientStyle(gradients.contentSheet),
          boxShadow: "0 -8px 26px rgba(43,59,44,0.1)",
        }}
      >
        <View style={{ alignSelf: "center", width: 34, height: 6, borderRadius: 3, backgroundColor: "rgba(54,74,55,0.48)" }} />
        {loading ? (
          <LoadingSpinner fullScreen message="Memuat riwayat..." />
        ) : error ? (
          <EmptyState
            title="Riwayat Gagal Dimuat"
            description="Coba muat ulang data riwayat pada perangkat ini."
            actionLabel="Muat Ulang"
            onAction={refresh}
          />
        ) : history.length === 0 ? (
          <EmptyState
            title="Belum Ada Riwayat"
            description="Pindai sampah pertamamu untuk menyimpan proyek dan mencatat dampaknya."
            icon={<History size={30} color={colors.forest600} />}
            actionLabel="Mulai Scan"
            onAction={() => router.push("/scan/upload")}
          />
        ) : (
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 20, paddingBottom: 120, gap: 12 }}
          >
            {history.map((project) => {
              const projectKey = getProjectKey(project);

              return (
                <View
                  key={projectKey}
                  style={{
                    borderRadius: 22,
                    borderCurve: "continuous",
                    overflow: "hidden",
                    backgroundColor: "rgba(255,255,255,0.72)",
                    borderWidth: 1,
                    borderColor: colors.mist100,
                    boxShadow: shadows.card,
                  }}
                >
                  <PressableScale
                    onPress={() => router.push(`/product/${project.product.id}`)}
                    style={{ flexDirection: "row", padding: 13, gap: 13 }}
                  >
                    <Image
                      source={{ uri: project.photoUri }}
                      resizeMode="cover"
                      style={{ width: 82, height: 82, borderRadius: 18, backgroundColor: colors.mist100 }}
                    />
                    <View style={{ flex: 1, justifyContent: "space-between", paddingVertical: 2 }}>
                      <View style={{ gap: 4 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text numberOfLines={1} style={{ flex: 1, color: colors.ink900, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                            {project.product.name}
                          </Text>
                          <ChevronRight size={16} color={colors.forest600} />
                        </View>
                        <Text numberOfLines={2} style={{ color: colors.ink600, fontSize: 10, lineHeight: 15 }}>
                          {project.product.shortDescription}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <View style={{ borderRadius: 8, backgroundColor: colors.mist100, paddingHorizontal: 8, paddingVertical: 4 }}>
                          <Text style={{ color: colors.forest600, fontFamily: "Inter_600SemiBold", fontSize: 9 }}>
                            {project.material.materialLabel}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </PressableScale>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderTopWidth: 1,
                      borderTopColor: colors.mist100,
                    }}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <CalendarDays size={12} color={colors.ink400} />
                        <Text style={{ color: colors.ink600, fontSize: 9 }}>{formatDate(project.savedAt)}</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Package size={12} color={colors.forest600} />
                        <Text selectable style={{ color: colors.forest600, fontFamily: "Inter_600SemiBold", fontSize: 10 }}>
                          Est. {formatRupiah(project.product.estimatedCost)}
                        </Text>
                      </View>
                    </View>
                    <PressableScale
                      disabled={deletingId === projectKey}
                      onPress={() => setDeleteTarget(project)}
                      style={{ width: 40, height: 40, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#F8ECEA" }}
                    >
                      <Trash2 size={17} color={colors.danger} />
                    </PressableScale>
                  </View>
                </View>
              );
            })}

            <Button title="Tambah Riwayat Baru" icon={<Camera size={18} color={colors.white} />} onPress={() => router.push("/scan/upload")} />
          </ScrollView>
        )}
      </View>

      <Modal visible={!!deleteTarget} animationType="fade" transparent onRequestClose={() => setDeleteTarget(null)}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(22,32,24,0.58)", paddingHorizontal: 24 }}>
          <View style={{ width: "100%", maxWidth: 384, borderRadius: 28, borderCurve: "continuous", backgroundColor: colors.cream50, padding: 24 }}>
            <View style={{ width: 54, height: 54, borderRadius: 19, backgroundColor: "#F8ECEA", alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
              <Trash2 size={26} color={colors.danger} />
            </View>
            <Text style={{ color: colors.ink900, fontFamily: "Inter_700Bold", fontSize: 18, textAlign: "center", marginTop: 14 }}>Hapus Riwayat?</Text>
            <Text style={{ color: colors.ink600, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 7, marginBottom: 22 }}>
              Data proyek ini akan dihapus dari Riwayat dan tidak muncul lagi di perangkat ini.
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Button title="Batal" variant="outline" className="flex-1" disabled={!!deletingId} onPress={() => setDeleteTarget(null)} />
              <Button title="Hapus" variant="danger" className="flex-1" loading={!!deletingId} onPress={() => deleteTarget && handleDelete(deleteTarget)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
