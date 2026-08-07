import React, { useState } from "react";
import { Alert, Image, Modal, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CalendarDays,
  Camera,
  ChevronRight,
  History,
  Leaf,
  Package,
  Trash2,
} from "lucide-react-native";
import { Button, EmptyState, LoadingSpinner, PressableScale } from "../../src/components/ui";
import { SavedProject } from "../../src/services/types";
import { formatRupiah } from "../../src/lib/format";
import { useImpactData } from "../../src/hooks/useImpactData";
import { gradientStyle } from "../../src/theme";

const palette = {
  forest: "#0B3D25",
  forestDeep: "#062E1B",
  forestSoft: "#2E6742",
  lime: "#A7D94C",
  limePale: "#EDF6DF",
  cream: "#FBFCF8",
  white: "#FFFFFF",
  ink: "#103821",
  muted: "#68736B",
  line: "#E1E7DF",
  danger: "#F0504F",
} as const;

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
  const insets = useSafeAreaInsets();
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
    <View style={{ flex: 1, backgroundColor: palette.cream }}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 104 }}
      >
        <View
          style={{
            minHeight: 250,
            paddingTop: Math.max(insets.top, 18),
            paddingHorizontal: 16,
            overflow: "hidden",
            backgroundColor: palette.forestDeep,
          }}
        >
          <Image
            source={require("../../assets/images/impact-header-bg.png")}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: 0.72,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              inset: 0,
              ...gradientStyle(
                "linear-gradient(180deg, rgba(3,39,22,0.24) 0%, rgba(5,43,25,0.12) 52%, rgba(5,43,25,0.62) 100%)"
              ),
            }}
          />

          <View style={{ alignItems: "center", gap: 3 }}>
            <Text
              style={{
                color: palette.white,
                fontFamily: "Manrope_800ExtraBold",
                fontSize: 29,
                lineHeight: 36,
                letterSpacing: -0.7,
                textShadowColor: "rgba(0,0,0,0.22)",
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 5,
              }}
            >
              Riwayat
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, lineHeight: 18 }}>
              Proyek upcycling yang sudah kamu simpan
            </Text>
          </View>

          <View
            style={{
              height: 118,
              marginTop: 18,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              borderRadius: 27,
              borderCurve: "continuous",
              overflow: "hidden",
              backgroundColor: "rgba(74,119,78,0.72)",
              borderWidth: 1,
              borderColor: "rgba(211,239,169,0.72)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.2), 0 14px 28px rgba(0,25,12,0.22)",
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                inset: 0,
                ...gradientStyle(
                  "radial-gradient(circle at 20% 22%, rgba(190,236,109,0.2) 0%, rgba(190,236,109,0) 34%), linear-gradient(120deg, rgba(42,90,56,0.92) 0%, rgba(96,142,91,0.82) 100%)"
                ),
              }}
            />

            <View
              style={{
                width: 70,
                height: 70,
                borderRadius: 35,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(206,242,147,0.15)",
                borderWidth: 1,
                borderColor: "rgba(224,251,174,0.55)",
                boxShadow:
                  "inset 0 0 15px rgba(218,255,158,0.35), 0 8px 17px rgba(3,37,18,0.28)",
              }}
            >
              <History size={38} color="#E6FFB7" strokeWidth={2.3} />
              <View
                style={{
                  position: "absolute",
                  right: -8,
                  bottom: -2,
                  transform: [{ rotate: "-24deg" }],
                }}
              >
                <Leaf size={31} color="#91CE35" fill="#91CE35" strokeWidth={1.6} />
              </View>
            </View>

            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{
                  color: palette.white,
                  fontFamily: "Manrope_700Bold",
                  fontSize: 18,
                  letterSpacing: -0.35,
                }}
              >
                Riwayat Upcycling
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 11, lineHeight: 16 }}>
                {history.length} proyek tersimpan di perangkat ini
              </Text>
            </View>

            <View style={{ minWidth: 47, alignItems: "center" }}>
              <Text
                selectable
                style={{
                  color: palette.white,
                  fontFamily: "Manrope_500Medium",
                  fontSize: 39,
                  lineHeight: 42,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {history.length}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 10 }}>proyek</Text>
            </View>
          </View>
        </View>

        <View
          style={{
            minHeight: 570,
            marginTop: -24,
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: 18,
            borderTopLeftRadius: 38,
            borderTopRightRadius: 38,
            borderCurve: "continuous",
            backgroundColor: palette.cream,
            boxShadow: "0 -10px 28px rgba(4,43,23,0.12)",
            zIndex: 2,
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 10,
              alignSelf: "center",
              width: 38,
              height: 5,
              borderRadius: 3,
              backgroundColor: "rgba(31,68,43,0.18)",
            }}
          />

          {loading ? (
            <View style={{ minHeight: 460 }}>
              <LoadingSpinner fullScreen message="Memuat riwayat..." />
            </View>
          ) : error ? (
            <View style={{ minHeight: 460 }}>
              <EmptyState
                title="Riwayat Gagal Dimuat"
                description="Coba muat ulang data riwayat pada perangkat ini."
                actionLabel="Muat Ulang"
                onAction={refresh}
              />
            </View>
          ) : history.length === 0 ? (
            <View style={{ minHeight: 460 }}>
              <EmptyState
                title="Belum Ada Riwayat"
                description="Pindai sampah pertamamu untuk menyimpan proyek dan mencatat dampaknya."
                icon={<History size={30} color={palette.forestSoft} />}
                actionLabel="Mulai Scan"
                onAction={() => router.push("/scan/upload")}
              />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {history.map((project) => {
                const projectKey = getProjectKey(project);

                return (
                  <View
                    key={projectKey}
                    style={{
                      borderRadius: 22,
                      borderCurve: "continuous",
                      overflow: "hidden",
                      backgroundColor: palette.white,
                      borderWidth: 1,
                      borderColor: palette.line,
                      boxShadow: "0 8px 22px rgba(32,63,39,0.1)",
                    }}
                  >
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={`Buka ${project.product.name}`}
                      onPress={() => router.push(`/product/${project.product.id}`)}
                      style={{ minHeight: 105, flexDirection: "row", padding: 10, gap: 13 }}
                    >
                      <Image
                        source={{ uri: project.photoUri }}
                        resizeMode="cover"
                        accessibilityIgnoresInvertColors
                        style={{
                          width: 102,
                          minHeight: 96,
                          alignSelf: "stretch",
                          borderRadius: 20,
                          backgroundColor: "#EEF2EC",
                        }}
                      />
                      <View style={{ flex: 1, minWidth: 0, paddingVertical: 3, justifyContent: "space-between" }}>
                        <View style={{ gap: 4 }}>
                          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 5 }}>
                            <Text
                              numberOfLines={1}
                              style={{
                                flex: 1,
                                color: palette.ink,
                                fontFamily: "Manrope_700Bold",
                                fontSize: 14,
                                lineHeight: 19,
                                letterSpacing: -0.15,
                              }}
                            >
                              {project.product.name}
                            </Text>
                            <ChevronRight size={18} color="#7B827D" strokeWidth={2} />
                          </View>
                          <Text
                            numberOfLines={2}
                            style={{ color: palette.muted, fontSize: 10, lineHeight: 15 }}
                          >
                            {project.product.shortDescription}
                          </Text>
                        </View>

                        <View
                          style={{
                            alignSelf: "flex-start",
                            maxWidth: "100%",
                            paddingHorizontal: 9,
                            paddingVertical: 5,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 5,
                            borderRadius: 13,
                            backgroundColor: palette.limePale,
                          }}
                        >
                          <Leaf size={11} color={palette.forestSoft} fill={palette.forestSoft} />
                          <Text
                            numberOfLines={1}
                            style={{ color: palette.forestSoft, fontFamily: "Manrope_500Medium", fontSize: 9 }}
                          >
                            {project.material.materialLabel}
                          </Text>
                        </View>
                      </View>
                    </PressableScale>

                    <View
                      style={{
                        minHeight: 47,
                        paddingHorizontal: 13,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        borderTopWidth: 1,
                        borderTopColor: palette.line,
                      }}
                    >
                      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 7 }}>
                        <CalendarDays size={15} color={palette.forestSoft} strokeWidth={1.8} />
                        <Text numberOfLines={1} style={{ color: "#404943", fontSize: 9 }}>
                          {formatDate(project.savedAt)}
                        </Text>
                      </View>
                      <View style={{ width: 1, height: 24, backgroundColor: palette.line }} />
                      <View style={{ flex: 0.78, flexDirection: "row", alignItems: "center", gap: 7 }}>
                        <Package size={15} color={palette.forestSoft} strokeWidth={1.8} />
                        <Text
                          selectable
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          style={{ color: "#404943", fontFamily: "Manrope_500Medium", fontSize: 9.5 }}
                        >
                          Est. {formatRupiah(project.product.estimatedCost)}
                        </Text>
                      </View>
                      <PressableScale
                        accessibilityLabel={`Hapus ${project.product.name}`}
                        disabled={deletingId === projectKey}
                        onPress={() => setDeleteTarget(project)}
                        style={{
                          width: 39,
                          height: 39,
                          borderRadius: 14,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "#FDECE9",
                        }}
                      >
                        <Trash2 size={18} color={palette.danger} strokeWidth={2} />
                      </PressableScale>
                    </View>
                  </View>
                );
              })}

              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Tambah riwayat baru"
                onPress={() => router.push("/scan/upload")}
                style={{
                  height: 56,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  borderRadius: 20,
                  borderCurve: "continuous",
                  overflow: "hidden",
                  backgroundColor: palette.forest,
                  ...gradientStyle("linear-gradient(135deg, #2E7440 0%, #0B4B28 100%)"),
                  borderWidth: 1,
                  borderColor: "rgba(174,220,91,0.7)",
                  boxShadow: "0 10px 22px rgba(8,61,32,0.22)",
                }}
              >
                <Camera size={21} color={palette.white} strokeWidth={2.1} />
                <Text style={{ color: palette.white, fontFamily: "Manrope_700Bold", fontSize: 15 }}>
                  Tambah Riwayat Baru
                </Text>
              </PressableScale>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={!!deleteTarget} animationType="fade" transparent onRequestClose={() => setDeleteTarget(null)}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
            backgroundColor: "rgba(5,34,18,0.64)",
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 384,
              padding: 24,
              borderRadius: 28,
              borderCurve: "continuous",
              backgroundColor: palette.cream,
            }}
          >
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 19,
                alignItems: "center",
                justifyContent: "center",
                alignSelf: "center",
                backgroundColor: "#FDECE9",
              }}
            >
              <Trash2 size={26} color={palette.danger} />
            </View>
            <Text
              style={{
                paddingTop: 14,
                color: palette.ink,
                fontFamily: "Manrope_700Bold",
                fontSize: 18,
                textAlign: "center",
              }}
            >
              Hapus Riwayat?
            </Text>
            <Text
              style={{
                paddingTop: 7,
                paddingBottom: 22,
                color: palette.muted,
                fontSize: 13,
                lineHeight: 19,
                textAlign: "center",
              }}
            >
              Data proyek ini akan dihapus dari Riwayat dan tidak muncul lagi di perangkat ini.
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
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
