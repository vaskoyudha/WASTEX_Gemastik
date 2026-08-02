import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, Header, LoadingSpinner } from '../../src/components/ui';
import { useServiceCall } from '../../src/hooks/useServiceCall';
import { safeBack } from '../../src/lib/navigation';
import { apiClient } from '../../src/services/api';
import type { BackendDifficulty, SkillProposal } from '../../src/services/types';
import { useScanStore } from '../../src/store/useScanStore';
import { Sparkles } from 'lucide-react-native';

type Stage = 'ideas' | 'edit' | 'verify' | 'done';

const DIFFICULTIES: BackendDifficulty[] = ['pemula', 'menengah', 'mahir'];

export default function SkillCreatorScreen() {
  const router = useRouter();
  const scanResult = useScanStore((s) => s.scanResult);
  const [stage, setStage] = useState<Stage>('ideas');
  const [selected, setSelected] = useState<SkillProposal | null>(null);
  const [draft, setDraft] = useState<SkillProposal | null>(null);

  const generateArgs = useMemo<[string, string] | undefined>(
    () => (scanResult ? [scanResult.materialType, scanResult.condition] : undefined),
    [scanResult],
  );

  const generateSkills = useCallback(
    (material: string, condition: string) =>
      apiClient.getSkillProposals({ material, condition }),
    [],
  );

  const generateCall = useServiceCall<SkillProposal[], [string, string]>(
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

  const handleSelect = (proposal: SkillProposal) => {
    setSelected(proposal);
    setDraft({ ...proposal, steps: proposal.steps.map((s) => ({ ...s })) });
    setStage('edit');
  };

  const updateStep = (index: number, field: 'instruction' | 'warning', value: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      steps: draft.steps.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    });
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
          <TouchableOpacity key={idea.title} onPress={() => handleSelect(idea)} activeOpacity={0.7}>
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
        <Button title="Generate Ulang" onPress={generateCall.refetch} variant="secondary" />
      </View>
    );
  };

  const renderEdit = () => {
    if (!draft) return null;
    return (
      <View>
        <Text className="text-sm font-bold text-slate-900 mb-2">Judul</Text>
        <TextInput
          value={draft.title}
          onChangeText={(t) => setDraft({ ...draft, title: t })}
          className="border border-slate-200 rounded-xl px-4 py-3 mb-4 text-sm"
        />
        <Text className="text-sm font-bold text-slate-900 mb-2">Deskripsi</Text>
        <TextInput
          value={draft.description}
          onChangeText={(t) => setDraft({ ...draft, description: t })}
          multiline
          className="border border-slate-200 rounded-xl px-4 py-3 mb-4 text-sm min-h-[80px]"
        />
        <Text className="text-sm font-bold text-slate-900 mb-2">Tingkat Kesulitan</Text>
        <View className="flex-row gap-2 mb-4">
          {DIFFICULTIES.map((d) => {
            const active = draft.difficulty === d;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => setDraft({ ...draft, difficulty: d })}
                className={`px-4 py-2 rounded-full border ${active ? 'bg-brand border-brand' : 'border-slate-200'}`}
              >
                <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-slate-600'}`}>{d}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text className="text-sm font-bold text-slate-900 mb-2">Langkah Pembuatan</Text>
        {draft.steps.map((step, i) => (
          <Card key={i} className="p-3 border border-slate-100 mb-3">
            <Text className="text-xs font-bold text-slate-500 mb-1">Langkah {step.order}</Text>
            <TextInput
              value={step.instruction}
              onChangeText={(v) => updateStep(i, 'instruction', v)}
              className="border border-slate-200 rounded-lg px-3 py-2 mb-2 text-sm"
            />
            <TextInput
              value={step.warning ?? ''}
              onChangeText={(v) => updateStep(i, 'warning', v)}
              placeholder="Peringatan keamanan (opsional)"
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </Card>
        ))}
        <Button title="Verifikasi dengan AI" onPress={() => setStage('verify')} />
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
              Pilih salah satu ide untuk material {scanResult.materialLabel}, lalu sesuaikan sebelum dikirim.
            </Text>
            {renderIdeas()}
          </View>
        )}
        {stage === 'edit' && (
          <View>
            <Text className="text-sm font-bold text-slate-900 mb-3">Edit Draft Skill</Text>
            {renderEdit()}
          </View>
        )}
        {stage === 'done' && (
          <EmptyState
            title="Skill Terkirim"
            description="Skill kamu sekarang menunggu verifikasi expert."
            actionLabel="Lihat Hasil Scan"
            onAction={() => router.replace('/scan/hasil')}
          />
        )}
      </ScrollView>
    </View>
  );
}
