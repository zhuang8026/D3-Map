import { expect } from 'chai';
import { pickRoutes } from '@/components/CableMap/lib/routes';

const cables = [
  {
    id: 'apg',
    segments: [
      { id: 'a', coordinates: [[120, 20], [121, 21]] },
      { id: 'b', coordinates: [[130, 30], [131, 31]] },
    ],
    equipments: [
      { name: 'near', coordinate: [120.1, 20.1] },
      { name: 'far', coordinate: [130, 30] },
    ],
  },
  { id: 'other', segments: [{ id: 'x', coordinates: [[0, 0], [1, 1]] }] },
];
const landingPoints = [
  { name: 'L1', coordinates: [121, 21] },
  { name: 'L2', coordinates: [0, 0] },
];

describe('lib/routes', () => {
  it('routes 為空時不過濾', () => {
    const result = pickRoutes({ cables, landingPoints }, []);
    expect(result.cables).to.equal(cables);
    expect(result.landingPoints).to.equal(landingPoints);
  });

  it('只保留指定區段，以及附近的設備與登陸點', () => {
    const result = pickRoutes({ cables, landingPoints }, [{ cableId: 'apg', segments: ['a'] }]);
    expect(result.cables.map((c) => c.id)).to.deep.equal(['apg']);
    expect(result.cables[0].segments.map((s) => s.id)).to.deep.equal(['a']);
    expect(result.cables[0].equipments.map((e) => e.name)).to.deep.equal(['near']);
    expect(result.landingPoints.map((p) => p.name)).to.deep.equal(['L1']);
  });

  it('不改動傳入的資料', () => {
    pickRoutes({ cables, landingPoints }, [{ cableId: 'apg', segments: ['a'] }]);
    expect(cables[0].segments).to.have.length(2);
  });
});
