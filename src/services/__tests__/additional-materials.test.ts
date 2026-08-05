import { tutorialFromBackend } from '../index';
import { BackendTutorial, ProductTutorial, AdditionalMaterial } from '../types';

describe('tutorialFromBackend', () => {
  const backend: BackendTutorial = {
    skill_id: 's1',
    title: 'Pot Gantung',
    description: 'Pot dari kaleng',
    difficulty: 'pemula',
    tools: [{ name: 'gunting', optional: false }],
    steps: [{ order: 1, instruction: 'Cuci kaleng' }],
    estimated_time: '20 menit',
    additional_materials: [
      { name: 'tali', category: 'tali', est_cost_idr: 3000, purpose: 'gantungan' },
    ],
  };

  it('maps additional_materials into ProductTutorial', () => {
    const result: ProductTutorial = tutorialFromBackend(backend);
    expect(result.additionalMaterials).toHaveLength(1);
    expect(result.additionalMaterials![0].name).toBe('tali');
    expect(result.additionalMaterials![0].est_cost_idr).toBe(3000);
  });

  it('maps tools objects to names in toolsAndMaterials', () => {
    const result = tutorialFromBackend(backend);
    expect(result.toolsAndMaterials).toEqual(['gunting', 'tali']);
  });
});
