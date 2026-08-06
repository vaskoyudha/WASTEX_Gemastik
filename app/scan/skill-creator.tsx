import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, Header, LoadingSpinner } from '../../src/components/ui';
import { useServiceCall } from '../../src/hooks/useServiceCall';
import { safeBack } from '../../src/lib/navigation';
import { apiClient } from '../../src/services/api';
import type { ChatMessage, SkillIdea, SkillProposal, SkillVerifyResponse } from '../../src/services/types';
import { useScanStore } from '../../src/store/useScanStore';
import { Sparkles } from 'lucide-react-native';

type Stage = 'ideas' | 'verifying' | 'result' | 'done';

export default function SkillCreatorScreen() {
  const router = useRouter();
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
      <View className="flex-1 bg-slate-50">
        <Header title="Buat Skill Baru" onBack={() => safeBack(router)} />
        <EmptyState
          title="Belum Ada Hasil Scan"
          description="Scan material terlebih dahulu untuk membuat skill baru."
          actionLabel="Mulai Scan"
          onAction={() => router.push('../scan/upload')}
        />
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
    if (!draft || submitting) return;
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
      <View>
        {ideas.map((idea) => (
          <TouchableOpacity
            key={idea.title}
            onPress={() => handleSelect(idea)}
            disabled={expanding}
            activeOpacity={0.7}
          >
            <Card className="p-4 border border-slate-100 mb-3">
              <Text className="text-sm font-bold text-slate-900 mb-1">{idea.title}</Text>
              <Text className="text-xs text-slate-500 mb-2">{idea.description}</Text>
              <View className="flex-row gap-2">
                <Text className="text-[10px] font-semibold text-brand-dark bg-emerald-50 px-2 py-0.5 rounded-full">
                  {idea.difficulty}
                </Text>
                {idea.est_cost_idr !== null && (
                  <Text className="text-[10px] text-slate-500 px-2 py-0.5">
                    Est. biaya Rp{idea.est_cost_idr ?? 0}
                  </Text>
                )}
              </View>
            </Card>
          </TouchableOpacity>
        ))}
        {expanding && <Text className="text-xs text-slate-500 mb-3">AI sedang menyusun detail skill...</Text>}
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
      <View>
        <Text className="text-sm font-bold text-slate-900 mb-1">{draft.title}</Text>
        <Text className="text-xs text-slate-500 mb-3 leading-5">{draft.description}</Text>
        <View className="flex-row gap-2 mb-4">
          <Text className="text-[10px] font-semibold text-brand-dark bg-emerald-50 px-2 py-0.5 rounded-full">
            {draft.difficulty}
          </Text>
          {draft.est_cost_idr !== null && (
            <Text className="text-[10px] text-slate-500 px-2 py-0.5">
              Est. biaya Rp{draft.est_cost_idr ?? 0}
            </Text>
          )}
        </View>
        <Text className="text-sm font-bold text-slate-900 mb-2">Langkah Pembuatan</Text>
        {draft.steps.map((step) => (
          <Card key={step.order} className="p-3 border border-slate-100 mb-3">
            <Text className="text-xs font-bold text-slate-500 mb-1">Langkah {step.order}</Text>
            <Text className="text-sm text-slate-800 mb-2 leading-5">{step.instruction}</Text>
            {step.warning ? (
              <Text className="text-xs text-amber-700 leading-5">⚠️ {step.warning}</Text>
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
        {verdict?.verdict === 'perbaiki' && (
          <View className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">
            <Text className="text-xs font-bold text-red-700 mb-1">Perlu perbaikan:</Text>
            {verdict.feedback.map((f, i) => (
              <Text key={i} className="text-xs text-red-700 mb-1 leading-5">• {f}</Text>
            ))}
          </View>
        )}
        <View className="mb-4">
          <Text className="text-sm font-bold text-slate-900 mb-3">
            {verdict?.verdict === 'layak'
              ? 'Skill layak dikirim'
              : 'Kirim draft untuk review expert'}
          </Text>
          <Button title="Kirim Skill untuk Verifikasi" onPress={handleSubmit} disabled={submitting} />
          <Button title="Coba Ide Lain" onPress={handlePickAnother} variant="secondary" />
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-slate-50">
      <Header
        title="Buat Skill Baru"
        subtitle={scanResult.materialLabel}
        onBack={() => safeBack(router)}
      />
      <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {stage === 'ideas' && (
          <View className="mb-5">
            <View className="flex-row items-center mb-3">
              <Sparkles size={16} color="#16a34a" />
              <Text className="text-sm font-bold text-slate-900 ml-2">Ide Skill dari AI</Text>
            </View>
            <Text className="text-xs text-slate-500 mb-4 leading-5">
              Pilih salah satu ide untuk material {scanResult.materialLabel}, lalu AI akan menyusun dan meninjau detailnya.
            </Text>
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
              verdict?.verdict === 'layak'
                ? 'Skill kamu langsung masuk katalog dan bisa dikerjakan semua orang.'
                : 'Skill kamu sekarang menunggu verifikasi expert.'
            }
            actionLabel="Lihat Hasil Scan"
            onAction={() => router.replace('/scan/hasil')}
          />
        )}
      </ScrollView>
    </View>
  );
}
