import { expect } from 'chai';
import { computeCableStatus, pickRoutes } from '../src/components/CableMap/utils/status.js';

const cables = [{
  id: 'apg',
  segments: [
    { id: 'seg-a', coordinates: [[120, 20], [121, 21]] },
    { id: 'seg-b', coordinates: [[121, 21], [122, 22]] },
  ],
  equipments: [
    { name: 'near', coordinate: [121.1, 21.1] },
    { name: 'far', coordinate: [130, 30] },
  ],
}];

describe('computeCableStatus', () => {
  it('區段取最嚴重的進行中事件；已解決的事件不算', () => {
    const status = computeCableStatus(cables, [
      {
        cableid: 'apg', segment: 'seg-a', status: 'notice', resolved_at: '',
      },
      {
        cableid: 'apg', segment: 'seg-a', status: 'disconnected', resolved_at: '',
      },
      {
        cableid: 'apg', segment: 'seg-b', status: 'disconnected', resolved_at: '2025-01-01',
      },
    ]).get('apg');
    expect(status.status).to.equal('disconnected');
    expect(status.segments.get('seg-a').status).to.equal('disconnected');
    expect(status.segments.get('seg-b').status).to.equal('normal');
  });

  it('對不到區段的事件只記在 unlocated，不改變區段顏色', () => {
    const status = computeCableStatus(cables, [
      {
        cableid: 'apg', segment: '', status: 'disconnected', resolved_at: '',
      },
      {
        cableid: 'sjc', segment: '、', status: 'disconnected', resolved_at: '',
      },
    ]).get('apg');
    expect(status.unlocated).to.have.length(1);
    expect(status.segments.get('seg-a').status).to.equal('normal');
  });
});

describe('pickRoutes', () => {
  it('只保留路線用到的區段，以及附近的設備與登陸點', () => {
    const picked = pickRoutes({
      cables,
      landingPoints: [{ name: 'A', coordinates: [120.1, 20.1] }, { name: 'B', coordinates: [0, 0] }],
    }, [{ cableId: 'apg', segments: ['seg-a'] }]);
    expect(picked.cables[0].segments.map((s) => s.id)).to.deep.equal(['seg-a']);
    expect(picked.cables[0].equipments.map((e) => e.name)).to.deep.equal(['near']);
    expect(picked.landingPoints.map((p) => p.name)).to.deep.equal(['A']);
  });

  it('沒有指定路線時不過濾', () => {
    const picked = pickRoutes({ cables, landingPoints: [] }, []);
    expect(picked.cables).to.equal(cables);
  });
});
