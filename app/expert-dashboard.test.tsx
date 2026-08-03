import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Alert, Pressable as MockPressable, Text as MockText } from 'react-native';
import ExpertDashboardScreen from './expert-dashboard';

const mockGetSkills = jest.fn();
const mockUpdateStatus = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), push: jest.fn() }),
}));

jest.mock('../src/services/api', () => ({
  apiClient: {
    getSkills: (...args: any[]) => mockGetSkills(...args),
    updateSkillStatus: (...args: any[]) => mockUpdateStatus(...args),
  },
}));

jest.mock('../src/services/auth', () => ({
  auth: { getUser: () => ({ id: 'expert-1' }) },
}));

jest.mock('../src/components/ui', () => ({
  Header: ({ title }: { title: string }) => <MockText>{title}</MockText>,
  Card: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Badge: ({ label }: { label?: string }) => <MockText>{label ?? ''}</MockText>,
}));

jest.mock('lucide-react-native', () => ({
  CheckCircle2: () => null,
  XCircle: () => null,
  Eye: () => null,
  ThumbsDown: () => null,
}));

const pendingSkills = [
  { id: 's1', title: 'Tas dari Plastik', status: 'pending', difficulty: 'menengah' },
  { id: 's2', title: 'Lampu dari Botol', status: 'pending', difficulty: 'mahir' },
];

describe('ExpertDashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSkills.mockResolvedValue(pendingSkills);
    mockUpdateStatus.mockResolvedValue({});
  });

  it('loads pending skills from the API', async () => {
    const { findByText } = await render(<ExpertDashboardScreen />);
    expect(await findByText('Tas dari Plastik')).toBeTruthy();
    expect(mockGetSkills).toHaveBeenCalledWith({ status: 'pending' });
  });

  it('approves a skill via PATCH', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { findByText, getAllByText } = await render(<ExpertDashboardScreen />);
    await findByText('Tas dari Plastik');
    fireEvent.press(getAllByText('Tinjau')[0]);
    const buttons = (alertSpy.mock.calls[0]?.[2] ?? []) as { text: string; onPress: () => void }[];
    const approveButton = buttons.find((b) => b.text === 'Setujui');
    expect(approveButton).toBeTruthy();
    approveButton!.onPress();
    expect(mockUpdateStatus).toHaveBeenCalledWith('s1', {
      status: 'approved',
      reviewed_by: 'expert-1',
    });
    alertSpy.mockRestore();
  });
});