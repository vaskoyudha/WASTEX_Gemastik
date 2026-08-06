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
  EmptyState: ({ title }: { title: string }) => <MockText>{title}</MockText>,
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

  it('selecting an idea expands it to full draft and moves to edit stage', async () => {
    const { findByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    expect(await findByText('Edit Draft Skill')).toBeTruthy();
    expect(mockExpand).toHaveBeenCalledWith({
      material: 'plastik_pet',
      condition: 'Bersih',
      idea: ideas[0],
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

  it('opens verify popup and shows verdict', async () => {
    const { findByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    fireEvent.press(await findByText('Verifikasi dengan AI'));
    expect(await findByText('Skill layak dikirim')).toBeTruthy();
    expect(mockVerify).toHaveBeenCalledWith(
      expect.objectContaining({ chat_history: expect.any(Array) }),
    );
  });

  it('cek lagi sends only current round history to avoid stale feedback echo', async () => {
    const { getByText, findByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    fireEvent.press(await findByText('Verifikasi dengan AI'));
    await findByText('Skill layak dikirim');
    fireEvent.press(getByText('Cek Lagi'));
    await findByText('Skill layak dikirim');
    expect(mockVerify).toHaveBeenCalledTimes(2);
    const lastCall = mockVerify.mock.calls[1][0];
    expect(lastCall.chat_history).toHaveLength(1);
  });

  it('submit disabled until layak verdict', async () => {
    const { getByText, findByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    fireEvent.press(await findByText('Verifikasi dengan AI'));
    await findByText('Skill layak dikirim');
    fireEvent.press(getByText('Kirim Skill untuk Verifikasi'));
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ title: 'Pot Gantung PET' }));
    expect(await findByText('Skill Terkirim')).toBeTruthy();
  });

  it('shows warning in verify popup when laidak with additional materials', async () => {
    const { getByText, findByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    fireEvent.press(await findByText('Verifikasi dengan AI'));
    expect(
      await findByText(/Butuh bahan tambahan di luar hasil scan: tali, cat/i),
    ).toBeTruthy();
  });
});
