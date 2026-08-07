import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Pressable as MockPressable, Text as MockText } from 'react-native';
import SkillCreatorScreen from './skill-creator';

const mockGetIdeas = jest.fn();
const mockExpand = jest.fn();
const mockRouterPush = jest.fn();
const mockVerify = jest.fn();
const mockCreate = jest.fn();

const scanResult = {
  materialType: 'plastik_pet',
  materialLabel: 'Botol PET',
  condition: 'Bersih',
  confidence: 0.9,
  riskLevel: 'aman' as const,
  safetyNotes: [],
  potentialUses: [],
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), push: mockRouterPush }),
}));

jest.mock('../../src/store/useScanStore', () => ({
  useScanStore: (selector: (state: { scanResult: typeof scanResult }) => unknown) =>
    selector({ scanResult }),
}));

jest.mock('../../src/services/api', () => ({
  apiClient: {
    getSkillIdeas: (...args: unknown[]) => mockGetIdeas(...args),
    expandSkillProposal: (...args: unknown[]) => mockExpand(...args),
    verifySkill: (...args: unknown[]) => mockVerify(...args),
    createSkill: (...args: unknown[]) => mockCreate(...args),
  },
}));

jest.mock('../../src/components/ui', () => ({
  Header: ({ title }: { title: string }) => <MockText>{title}</MockText>,
  Card: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Button: ({ title, onPress }: { title: string; onPress: () => void }) => (
    <MockPressable onPress={onPress}><MockText>{title}</MockText></MockPressable>
  ),
  LoadingSpinner: ({ message }: { message: string }) => <MockText>{message}</MockText>,
  EmptyState: ({ title, description }: { title: string; description?: string }) => (
    <>
      <MockText>{title}</MockText>
      {description ? <MockText>{description}</MockText> : null}
    </>
  ),
}));

jest.mock('lucide-react-native', () => ({
  Sparkles: () => null,
  Bot: () => null,
  CheckCircle2: () => null,
  XCircle: () => null,
  AlertTriangle: () => null,
}));

const ideas = [
  {
    title: 'Pot Gantung PET',
    description: 'Pot gantung dari botol bekas.',
    material: 'plastik_pet',
    difficulty: 'pemula',
    est_cost_idr: 5000,
    est_price_idr: 25000,
  },
];

const fullProposal = {
  title: 'Pot Gantung PET',
  description: 'Pot gantung dari botol bekas.',
  material: 'plastik_pet',
  difficulty: 'pemula',
  steps: [{ order: 1, instruction: 'Cuci botol', warning: 'Sarung tangan' }],
  tools: [{ name: 'gunting', optional: false }],
  est_cost_idr: 5000,
  est_price_idr: 25000,
  additional_materials: [
    { name: 'tali', category: 'tali', est_cost_idr: 3000, purpose: 'untuk gantungan' },
    { name: 'cat', category: 'cat', est_cost_idr: 12000, purpose: 'untuk dekorasi' },
  ],
};

describe('SkillCreatorScreen ideas stage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIdeas.mockResolvedValue(ideas);
    mockExpand.mockResolvedValue(fullProposal);
  });

  it('generates ideas on mount and renders them', async () => {
    const { findByText } = await render(<SkillCreatorScreen />);
    expect(await findByText('Pot Gantung PET')).toBeTruthy();
    expect(mockGetIdeas).toHaveBeenCalledWith({
      material: 'plastik_pet',
      condition: 'Bersih',
    });
  });

  it('regenerate refetches ideas', async () => {
    const { findByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Generate Ulang'));
    expect(mockGetIdeas).toHaveBeenCalledTimes(2);
  });
});

describe('SkillCreatorScreen verify + submit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIdeas.mockResolvedValue(ideas);
    mockExpand.mockResolvedValue(fullProposal);
    mockVerify.mockResolvedValue({ verdict: 'layak', feedback: [], suggestions: [] });
    mockCreate.mockResolvedValue({ id: 'new-skill' });
  });

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

  it('uses and displays the automatically repaired draft', async () => {
    const repairedProposal = {
      ...fullProposal,
      steps: [
        ...fullProposal.steps,
        { order: 2, instruction: 'Keringkan botol sepenuhnya', warning: null },
      ],
    };
    mockVerify.mockResolvedValue({
      verdict: 'layak',
      feedback: [],
      suggestions: [],
      draft: repairedProposal,
      auto_repaired: true,
    });

    const { findByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));

    expect(await findByText('Keringkan botol sepenuhnya')).toBeTruthy();
    expect(await findByText(/sudah memperbaiki draft secara otomatis/i)).toBeTruthy();
  });

  it('submit disabled until layak verdict', async () => {
    const { getByText, findByText, queryByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    await findByText('Skill layak dikirim');
    fireEvent.press(getByText('Kirim Skill untuk Verifikasi'));
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ title: 'Pot Gantung PET' }));
    expect(await findByText('Skill Terkirim')).toBeTruthy();
  });

  it('perbaiki verdict shows feedback but still allows submit', async () => {
    mockVerify.mockResolvedValue({
      verdict: 'perbaiki',
      feedback: ['Bahan X tidak terdaftar di additional_materials.'],
      suggestions: [],
    });
    const { findByText, queryByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    expect(await findByText(/Bahan X tidak terdaftar/i)).toBeTruthy();
    expect(queryByText('Kirim Skill untuk Verifikasi')).toBeTruthy();
    fireEvent.press(queryByText('Kirim Skill untuk Verifikasi')!);
    expect(mockCreate).toHaveBeenCalled();
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

  it('renders read-only draft with no text inputs', async () => {
    const { findByText, queryAllByPlaceholderText, queryByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    await findByText('Skill layak dikirim');
    expect(queryByText('Judul')).toBeNull();
    expect(queryByText('Langkah Pembuatan')).toBeTruthy();
    expect(queryAllByPlaceholderText('Peringatan keamanan (opsional)')).toHaveLength(0);
    expect(queryByText('Cuci botol')).toBeTruthy();
  });

  it('submit sends ai_verdict layak and shows instant-catalog message', async () => {
    const { findByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    await findByText('Skill layak dikirim');
    fireEvent.press(await findByText('Kirim Skill untuk Verifikasi'));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ ai_verdict: 'layak' }),
    );
    expect(await findByText(/langsung masuk katalog/i)).toBeTruthy();
  });

  it('submit with perbaiki verdict shows expert-review message', async () => {
    mockVerify.mockResolvedValue({
      verdict: 'perbaiki',
      feedback: ['Bahan X tidak terdaftar.'],
      suggestions: [],
    });
    const { findByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    await findByText('Kirim draft untuk review expert');
    fireEvent.press(await findByText('Kirim Skill untuk Verifikasi'));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ ai_verdict: 'perbaiki' }),
    );
    expect(await findByText(/menunggu verifikasi expert/i)).toBeTruthy();
  });
});
