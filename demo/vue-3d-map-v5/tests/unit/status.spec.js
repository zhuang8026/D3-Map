import { expect } from 'chai';
import {
  computeCableStatus, isActive, worse, unwrapLongitudes,
} from '@/components/CableMap/lib/status';

const cables = [{ id: 'apg', segments: [{ id: 's1' }, { id: 's2' }] }];

describe('lib/status', () => {
  it('isActive：resolved_at 為空才算進行中', () => {
    expect(isActive({ resolved_at: '' })).to.equal(true);
    expect(isActive({ resolved_at: '  ' })).to.equal(true);
    expect(isActive({ resolved_at: '2026-01-01' })).to.equal(false);
  });

  it('worse：取較嚴重的狀態', () => {
    expect(worse('notice', 'disconnected')).to.equal('disconnected');
    expect(worse('disconnected', 'normal')).to.equal('disconnected');
  });

  it('computeCableStatus：事件標在對應區段', () => {
    const result = computeCableStatus(cables, [
      {
        cableid: 'apg', segment: 's1', status: 'disconnected', resolved_at: '',
      },
      {
        cableid: 'apg', segment: 's1', status: 'notice', resolved_at: '2026-01-01',
      },
    ]);
    const apg = result.get('apg');
    expect(apg.status).to.equal('disconnected');
    expect(apg.segments.get('s1').status).to.equal('disconnected');
    expect(apg.segments.get('s1').incidents).to.have.length(1);
    expect(apg.segments.get('s2').status).to.equal('normal');
  });

  it('computeCableStatus：對不到區段的事件只記在 unlocated，不改區段顏色', () => {
    const apg = computeCableStatus(cables, [
      {
        cableid: 'apg', segment: '', status: 'partial_disconnected', resolved_at: '',
      },
    ]).get('apg');
    expect(apg.status).to.equal('partial_disconnected');
    expect(apg.unlocated).to.have.length(1);
    expect(apg.segments.get('s1').status).to.equal('normal');
  });

  it('unwrapLongitudes：跨 180 度經線時把西經加 360', () => {
    expect(unwrapLongitudes([[170, 0], [-170, 0]])).to.deep.equal([[170, 0], [190, 0]]);
    expect(unwrapLongitudes([[100, 0], [120, 0]])).to.deep.equal([[100, 0], [120, 0]]);
  });
});
