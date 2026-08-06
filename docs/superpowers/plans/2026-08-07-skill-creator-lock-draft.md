# Skill Creator: Lock Draft + Background AI Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can no longer edit the AI-generated skill draft; the AI review (verify) runs automatically in the background right after expansion, and only the final read-only result (layak → submit, perbaiki → pick another idea) is shown.

**Architecture:** Frontend-only change in `app/scan/skill-creator.tsx`. The stage machine becomes `ideas → verifying → result`. Selecting an idea triggers `expandSkillProposal` (existing endpoint) and then `verifySkill` (existing endpoint, `chat_history: []`) automatically while the user sees progress text. The old editable `renderEdit` form is deleted. Backend is untouched — `POST /skills/proposals/expand` and `POST /skills/verify` already exist and work.

**Tech Stack:** React Native (Expo), expo-router, TypeScript, jest-expo + @testing-library/react-native.

## Global Constraints

- No backend changes — endpoints `expandSkillProposal` and `verifySkill` stay as-is.
- Copy rules (Indonesian, verbatim from current UI): "Menyusun Detail...", "AI sedang meninjau draft...", "Kirim Skill untuk Verifikasi", "Coba Ide Lain", "Skill layak dikirim", "Perlu perbaikan:", "Perbaiki draft dulu, lalu cek lagi." is REMOVED (no more manual re-check).
- `runCheck` must keep sending `chat_history: [userMsg]` (single current-round message) — the stale-feedback-echo fix must not regress.
- Tests: jest-expo preset, run with `npx jest app/scan/skill-creator.test.tsx`.
- TDD: every behavior change starts with a failing test.

---

### Task 1: Auto-review orchestration (expand → verify in background)

**Files:**
- Modify: `app/scan/skill-creator.tsx:71-84` (`handleSelect`), `:25-33` (state), `:94-130` (`openVerify`/`runCheck` → replaced)
- Modify: `app/scan/skill-creator.test.tsx:100-109` (edit-stage test → result-stage test)
- Test: `app/scan/skill-creator.test.tsx`

**Interfaces:**
- Consumes: `apiClient.expandSkillProposal({ material, condition, idea })` → `Promise<SkillProposal>`; `apiClient.verifySkill({ draft, chat_history })` → `Promise<SkillVerifyResponse>` (both unchanged, see `src/services/api.ts`)
- Produces: `Stage = 'ideas' | 'verifying' | 'result'`; state `verdict: SkillVerifyResponse | null`; `handleSelect(idea)` sets stage `verifying` during expand+verify, then `result`. No `runCheck`, no `openVerify`, no `chatHistory` state, no `updateStep`.

- [ ] **Step 1: Write failing tests for auto-verify flow**

Replace the `selecting an idea expands it to full draft and moves to edit stage` test (lines 100-109) and the three verify-popup tests (lines 127-166) with:

```tsx
  it('selecting an idea expands then auto-verifies in background', async () => {
    const { findByText, queryByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    expect(await findByText('Skill layak dikirim')).toBeTruthy();
    expect(mockExpand).toHaveBeenCalledWith({
      material: 'plastik_pet',
      condition: 'Bersih',
      idea: ideas[0],
    });
    expect(mockVerify).toHaveBeenCalledWith(
      expect.objectContaining({ chat_history: expect.any(Array) }),
    );
    expect(queryByText('Edit Draft Skill')).toBeNull();
    expect(queryByText('Verifikasi dengan AI')).toBeNull();
  });

  it('shows verifying progress while review runs', async () => {
    let resolveVerify: (v: unknown) => void;
    mockVerify.mockReturnValue(
      new Promise((resolve) => { resolveVerify = resolve; }),
    );
    const { findByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    expect(await findByText('AI sedang meninjau draft...')).toBeTruthy();
    resolveVerify!({ verdict: 'layak', feedback: [], suggestions: [] });
    expect(await findByText('Skill layak dikirim')).toBeTruthy();
  });

  it('submit disabled until layak verdict', async () => {
    const { getByText, findByText, queryByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    await findByText('Skill layak dikirim');
    fireEvent.press(getByText('Kirim Skill untuk Verifikasi'));
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ title: 'Pot Gantung PET' }));
    expect(await findByText('Skill Terkirim')).toBeTruthy();
  });

  it('perbaiki verdict shows feedback and no submit button', async () => {
    mockVerify.mockResolvedValue({
      verdict: 'perbaiki',
      feedback: ['Bahan X tidak terdaftar di additional_materials.'],
      suggestions: [],
    });
    const { findByText, queryByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    expect(await findByText(/Bahan X tidak terdaftar/i)).toBeTruthy();
    expect(queryByText('Kirim Skill untuk Verifikasi')).toBeNull();
  });

  it('perbaiki verdict offers Coba Ide Lain which returns to ideas', async () => {
    mockVerify.mockResolvedValue({
      verdict: 'perbaiki',
      feedback: ['Bahan X tidak terdaftar di additional_materials.'],
      suggestions: [],
    });
    const { findByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    fireEvent.press(await findByText('Coba Ide Lain'));
    expect(await findByText('Generate Ulang')).toBeTruthy();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest app/scan/skill-creator.test.tsx`
Expected: FAIL — `queryByText('Edit Draft Skill')` still found (old behavior), `AI sedang meninjau draft...` never appears, `Coba Ide Lain` missing.

- [ ] **Step 3: Implement auto-review orchestration**

In `app/scan/skill-creator.tsx`:

```tsx
type Stage = 'ideas' | 'verifying' | 'result';
```

Replace state block (lines 25-33): delete `verifyVisible`, `chatHistory`, `checking`; keep `stage`, `selected`, `draft`, `expanding`, `verdict`, `submitting`.

Replace `handleSelect` (lines 71-84) with:

```tsx
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
```

Delete `updateStep` (lines 86-92), `openVerify` (94-99), `runCheck` (101-130).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest app/scan/skill-creator.test.tsx`
Expected: PASS (all tests in this file)

- [ ] **Step 5: Commit**

```bash
git add app/scan/skill-creator.tsx app/scan/skill-creator.test.tsx
git commit -m "feat(skill-creator): auto-verify draft in background after expand"
```

---

### Task 2: Read-only final result view (replace editable form)

**Files:**
- Modify: `app/scan/skill-creator.tsx:204-262` (`renderEdit` → `renderResult`), `:264-295` (JSX stage branches → `verifying` and `result` branches)
- Test: `app/scan/skill-creator.test.tsx`

**Interfaces:**
- Consumes: from Task 1 — `stage: 'verifying' | 'result'`, `draft: SkillProposal | null`, `verdict: SkillVerifyResponse | null`, `handleSubmit`, `renderIdeas`
- Produces: `renderResult()` — read-only display of title, description, difficulty, all steps (instruction + warning), `additional_materials` names; two buttons: "Kirim Skill untuk Verifikasi" (only when `verdict.verdict === 'layak'`) and "Coba Ide Lain" (when `perbaiki`, calls `generateCall.refetch()` + `setStage('ideas')`); a "Pilih Ide Lain" back affordance. Removes the `Modal` and its `chatHistory`/`Cek Lagi`/verdict footer markup entirely.

- [ ] **Step 1: Write failing test asserting no editable inputs remain**

Add to `app/scan/skill-creator.test.tsx`:

```tsx
  it('renders read-only draft with no text inputs', async () => {
    const { findByText, queryAllByPlaceholderText, queryByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    await findByText('Skill layak dikirim');
    expect(queryByText('Judul')).toBeNull();
    expect(queryByText('Langkah Pembuatan')).toBeTruthy();
    expect(queryAllByPlaceholderText('Peringatan keamanan (opsional)')).toHaveLength(0);
    expect(queryByText('Cuci botol')).toBeTruthy();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/scan/skill-creator.test.tsx -t "read-only"`
Expected: FAIL — `queryByText('Judul')` is still found (old `renderEdit` renders it), `Peringatan keamanan (opsional)` placeholders still present.

- [ ] **Step 3: Implement read-only result view**

Delete `renderEdit` entirely (lines 204-262). Add:

```tsx
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
        {verdict?.verdict === 'layak' ? (
          <Button title="Kirim Skill untuk Verifikasi" onPress={handleSubmit} disabled={submitting} />
        ) : (
          <Button title="Coba Ide Lain" onPress={handlePickAnother} variant="secondary" />
        )}
      </View>
    );
  };
```

Add handler next to `handleSubmit`:

```tsx
  const handlePickAnother = () => {
    setStage('ideas');
    setDraft(null);
    setVerdict(null);
    generateCall.refetch();
  };
```

Replace the JSX stage branches (lines 264-295): remove the entire `{stage === 'edit' && ...}` block; replace `{stage === 'done' && ...}` with:

```tsx
        {stage === 'verifying' && (
          <View className="pt-8">
            <LoadingSpinner fullScreen message="AI sedang meninjau draft..." />
          </View>
        )}
        {stage === 'result' && renderResult()}
        {stage === 'done' && (
          <EmptyState
            title="Skill Terkirim"
            description="Skill kamu sekarang menunggu verifikasi expert."
            actionLabel="Lihat Hasil Scan"
            onAction={() => router.replace('/scan/hasil')}
          />
        )}
```

Update the ideas-stage header copy (line 283-286): change "lalu sesuaikan sebelum dikirim." to "lalu AI akan menyusun dan meninjau detailnya."

Delete the entire `Modal` block (lines 296-366) and unused imports (`Modal`, `ChatMessage` if no longer referenced, `AlertTriangle`, `Bot`, `CheckCircle2`, `XCircle`). Keep `Alert` (used in `handleSelect`/`handleSubmit`), `Card`, `EmptyState`, `Header`, `LoadingSpinner`, `Button`, `Sparkles`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest app/scan/skill-creator.test.tsx`
Expected: PASS

- [ ] **Step 5: Full verification + commit**

Run: `npx jest` (full suite), then `npx tsc --noEmit`
Expected: all tests pass, tsc clean.

```bash
git add app/scan/skill-creator.tsx app/scan/skill-creator.test.tsx
git commit -m "feat(skill-creator): read-only final draft, remove edit form and verify popup"
```

---

### Task 3: Manual verification via live app (Playwright)

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: running backend `:8000`, Expo web `:8081` with `EXPO_PUBLIC_USE_MOCK=false`

- [ ] **Step 1: Restart Expo web to load new bundle**

Run: `curl -s http://localhost:8081/ | grep -c "getValidAccessToken"` — if 0, restart `npm run web`.

- [ ] **Step 2: Drive flow with Playwright**

Login as `e2e-frontend@wastex.test` / `e2e-password-123`, upload `.playwright-mcp/test-images/coke_can.jpg`, click "Analisis Sampah Sekarang", wait for scan result, click "Buat Skill Baru dari Material Ini", select first idea.

Expected: NO "Edit Draft Skill" screen and NO "Verifikasi dengan AI" button. Progress shows "Menyusun Detail..." then "AI sedang meninjau draft...", then the read-only final view.

- [ ] **Step 3: Verify both verdict paths render**

- If `layak`: green text "Skill layak dikirim" + "Kirim Skill untuk Verifikasi" button; click it → "Skill Terkirim".
- If `perbaiki`: red feedback list + "Coba Ide Lain"; click it → back to ideas list.
- Confirm no `TextInput` is rendered anywhere on the result screen (accessibility snapshot shows no `textbox` role).

- [ ] **Step 4: Report findings**

Summarize what rendered, screenshot to `.playwright-mcp/screenshots/skill-creator-readonly-{layak|perbaiki}.png`.
