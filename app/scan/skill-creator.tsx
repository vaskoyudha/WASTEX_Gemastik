import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, Header, LoadingSpinner } from '../../src/components/ui';
import { useServiceCall } from '../../src/hooks/useServiceCall';
import { safeBack } from '../../src/lib/navigation';
import { apiClient } from '../../src/services/api';
import type { ChatMessage, SkillIdea, SkillProposal, SkillVerifyResponse } from '../../src/services/types';
import { useScanStore } from '../../src/store/useScanStore';
import { Sparkles } from 'lucide-react-native';
import { colors, gradients, gradientStyle, radii, screenSheetStyle, shadows } from '../../src/theme';

type Stage = 'ideas' | 'verifying' | 'result' | 'done';

export default function SkillCreatorScreen() {
  const router = useRouter();
  const { height: screenHeight } = useWindowDimensions();
  const scanResult = useScanStore((s) => s.scanResult);
  const [stage, setStage] = useState<Stage>('ideas');
  const [selected, setSelected] = useState<SkillProposal | null>(null);
  const [draft, setDraft] = useState<SkillProposal | null>(null);
  const [expanding, setExpanding] = useState(false);
  const [verdict, setVerdict] = useState<SkillVerifyResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const generateArgs = useMemo<[string, string] | undefined>(
    () => (scanResult ? [scanResult.materialType, scanResult.condition] : undefined),
    [scanResult],
  );

  const generateSkills = useCallback(
    (material: string, condition: string) =>
      apiClient.getSkillIdeas({ material, condition }),
    [],
  );

  const expandSkill = useCallback(
    (material: string, condition: string, idea: SkillIdea) =>
      apiClient.expandSkillProposal({ material, condition, idea }),
    [],
  );

  const generateCall = useServiceCall<SkillIdea[], [string, string]>(
    generateSkills,
    { autoCall: scanResult !== null, initialArgs: generateArgs },
  );

  if (!scanResult) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.forest900, ...gradientStyle(gradients.home) }}>
        <Header title="Buat Skill Baru" onBack={() => safeBack(router)} />
        <View style={screenSheetStyle}>
          <EmptyState
            title="Belum Ada Hasil Scan"
            description="Scan material terlebih dahulu untuk membuat skill baru."
            actionLabel="Mulai Scan"
            onAction={() => router.push('../scan/upload')}
          />
        </View>
      </View>
    );
  }

  const handleSelect = async (idea: SkillIdea) => {
    if (!scanResult || expanding) return;
    setExpanding(true);
    setStage('verifying');
    try {
      const full = await expandSkill(scanResult.materialType, scanResult.condition, idea);
      setSelected(full);
      setDraft({ ...full, steps: full.steps.map((s) => ({ ...s })) });
      const userMsg: ChatMessage = {
        role: 'user',
        content: `Draft skill: ${full.title}\n${full.description}`,
      };
      const result = await apiClient.verifySkill({
        draft: full,
        chat_history: [userMsg],
      });
      if (result.verdict !== 'layak') {
        throw new Error('Draft belum lolos verifikasi otomatis');
      }
      const verifiedDraft = result.draft ?? full;
      setSelected(verifiedDraft);
      setDraft({ ...verifiedDraft, steps: verifiedDraft.steps.map((s) => ({ ...s })) });
      setVerdict(result);
      setStage('result');
    } catch {
      Alert.alert('Detail Gagal Dimuat', 'AI tidak bisa menyusun detail skill. Coba pilih ide lain.');
      setStage('ideas');
    } finally {
      setExpanding(false);
    }
  };

  const handleSubmit = async () => {
    if (!draft || verdict?.verdict !== 'layak' || submitting) return;
    setSubmitting(true);
    try {
      await apiClient.createSkill({
        ...draft,
        reference_scan_id: scanResult?.scan_id,
        ai_verdict: verdict?.verdict ?? null,
      });
      setStage('done');
    } catch {
      Alert.alert('Gagal Kirim', 'Skill belum bisa dikirim. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderIdeas = () => {
    if (generateCall.loading) {
      return <LoadingSpinner fullScreen message="AI sedang menyusun ide skill..." />;
    }
    if (generateCall.error) {
      return (
        <EmptyState
          title="Ide Gagal Dimuat"
          description="Coba generate ulang ide skill."
          actionLabel="Coba Lagi"
          onAction={generateCall.refetch}
        />
      );
    }
    const ideas = generateCall.data ?? [];
    if (ideas.length === 0) {
      return (
        <EmptyState
          title="Belum Ada Ide Layak"
          description="AI tidak menemukan ide yang benar-benar cocok untuk material ini."
          actionLabel="Generate Ulang"
          onAction={generateCall.refetch}
        />
      );
    }
    return (
      <View style={{ gap: 12 }}>
        {ideas.map((idea, index) => (
          <TouchableOpacity
            key={idea.title}
            onPress={() => handleSelect(idea)}
            disabled={expanding}
            activeOpacity={0.7}
          >
            <Card className="p-4 rounded-[22px] border-0" style={{ backgroundColor: 'rgba(255,255,255,0.72)', boxShadow: shadows.card }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mist100 }}>
                  <Text style={{ color: colors.forest600, fontFamily: 'Inter_700Bold', fontSize: 11 }}>{String(index + 1).padStart(2, '0')}</Text>
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text className="text-sm font-bold" style={{ color: colors.ink900 }}>{idea.title}</Text>
                  <Text className="text-xs leading-5" style={{ color: colors.ink600 }}>{idea.description}</Text>
                  <View className="flex-row gap-2" style={{ marginTop: 2 }}>
                    <Text className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: colors.forest600, backgroundColor: colors.mist100 }}>
                      {idea.difficulty}
                    </Text>
                    {idea.est_cost_idr !== null && (
                      <Text className="text-[10px] px-2 py-0.5" style={{ color: colors.ink600 }}>
                        Est. biaya Rp{idea.est_cost_idr ?? 0}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))}
        {expanding ? <Text className="text-xs mb-3" style={{ color: colors.ink600 }}>AI sedang menyusun detail skill...</Text> : null}
        <Button
          title={expanding ? 'Menyusun Detail...' : 'Generate Ulang'}
          onPress={generateCall.refetch}
          variant="secondary"
          disabled={expanding}
        />
      </View>
    );
  };

  const handlePickAnother = () => {
    setStage('ideas');
    setDraft(null);
    setVerdict(null);
    generateCall.refetch();
  };

  const renderResult = () => {
    if (!draft) return null;
    return (
      <View style={{ gap: 18 }}>
        <View style={{ padding: 18, borderRadius: radii.xl, borderCurve: 'continuous', backgroundColor: '#2B7748', ...gradientStyle(gradients.uploadAnalyze), borderWidth: 1, borderColor: 'rgba(190,232,120,0.24)', boxShadow: '0 9px 22px rgba(20,69,39,0.22)' }}>
          <Text className="text-lg font-bold mb-1" style={{ color: colors.white }}>{draft.title}</Text>
          <Text className="text-xs mb-3 leading-5" style={{ color: 'rgba(255,255,255,0.72)' }}>{draft.description}</Text>
          <View className="flex-row gap-2">
            <Text className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: colors.lime300, backgroundColor: 'rgba(220,245,167,0.18)' }}>
              {draft.difficulty}
            </Text>
            {draft.est_cost_idr !== null && (
              <Text className="text-[10px] px-2 py-0.5" style={{ color: colors.sage200 }}>
                Est. biaya Rp{draft.est_cost_idr ?? 0}
              </Text>
            )}
          </View>
        </View>
        <Text className="text-sm font-bold" style={{ color: colors.ink900 }}>Langkah Pembuatan</Text>
        {draft.steps.map((step) => (
          <Card key={step.order} className="p-4 rounded-[22px] border-0" style={{ backgroundColor: 'rgba(255,255,255,0.72)', boxShadow: shadows.card }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 9 }}>
              <View style={{ width: 28, height: 28, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.forest800 }}>
                <Text style={{ color: colors.lime300, fontFamily: 'Inter_700Bold', fontSize: 10 }}>{step.order}</Text>
              </View>
              <Text className="text-xs font-bold" style={{ color: colors.forest600 }}>Langkah {step.order}</Text>
            </View>
            <Text className="text-sm mb-2 leading-5" style={{ color: colors.ink900 }}>{step.instruction}</Text>
            {step.warning ? (
              <View style={{ padding: 10, borderRadius: 14, backgroundColor: '#F8F2DE' }}>
                <Text className="text-xs leading-5" style={{ color: '#9A5A15' }}>⚠️ {step.warning}</Text>
              </View>
            ) : null}
          </Card>
        ))}
        {(draft.additional_materials?.length ?? 0) > 0 && (
          <View className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
            <Text className="text-xs text-amber-800 ml-1">
              Butuh bahan tambahan: {draft.additional_materials!.map((m) => m.name).join(', ')}.
            </Text>
          </View>
        )}
        {verdict?.auto_repaired && verdict.verdict === 'layak' && (
          <View className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-4">
            <Text className="text-xs text-emerald-700 leading-5">
              AI sudah memperbaiki draft secara otomatis dan memverifikasinya kembali.
            </Text>
          </View>
        )}
        <View className="mb-4">
          <Text className="text-sm font-bold mb-3" style={{ color: colors.ink900 }}>
            Skill layak dikirim
          </Text>
          <Button title="Kirim Skill untuk Verifikasi" onPress={handleSubmit} disabled={submitting} />
          <Button title="Coba Ide Lain" onPress={handlePickAnother} variant="secondary" />
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        contentContainerStyle={{ minHeight: screenHeight }}
      >
        <Image
          source={require('../../assets/images/upload-screen-bg.png')}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          style={{ position: 'absolute', top: -128, left: 0, width: '100%', height: screenHeight }}
        />
        <Header
          title="Buat Skill Baru"
          subtitle={scanResult.materialLabel}
          onBack={() => safeBack(router)}
          transparent
          contentColor={colors.white}
          subtitleColor="rgba(255,255,255,0.68)"
        />
        <View style={{ paddingHorizontal: 18, paddingTop: 32, paddingBottom: 44 }}>
        {stage === 'ideas' && (
          <View style={{ gap: 16 }}>
            <View style={{ padding: 17, flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: radii.xl, borderCurve: 'continuous', backgroundColor: colors.forest900, ...gradientStyle(gradients.navigation), borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)', boxShadow: shadows.floating }}>
              <View style={{ width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime300, ...gradientStyle(gradients.scanButton) }}>
                <Sparkles size={20} color={colors.forest900} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text className="text-base font-bold" style={{ color: colors.white }}>Ide skill dari AI</Text>
                <Text className="text-[11px] leading-4" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Pilih ide untuk {scanResult.materialLabel}, lalu AI akan menyusun dan meninjau detailnya.
                </Text>
              </View>
            </View>
            {renderIdeas()}
          </View>
        )}
        {stage === 'verifying' && (
          <View className="pt-8">
            <LoadingSpinner fullScreen message="AI sedang meninjau draft..." />
          </View>
        )}
        {stage === 'result' && renderResult()}
        {stage === 'done' && (
          <EmptyState
            title="Skill Terkirim"
            description={
              'Skill kamu langsung masuk katalog dan bisa dikerjakan semua orang.'
            }
            actionLabel="Lihat Hasil Scan"
            onAction={() => router.replace('/scan/hasil')}
          />
        )}
        </View>
      </ScrollView>
    </View>
  );
}
