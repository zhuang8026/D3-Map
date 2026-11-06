import { expect } from 'chai';
import {
  distanceKm, greatCircle, flowPath, slicePath, containsPoint, wrapLng,
} from '@/components/CableMap/lib/geo';

describe('lib/geo', () => {
  it('distanceKm：台北到東京約 2,100 公里', () => {
    const km = distanceKm([121.5654, 25.033], [139.6917, 35.6895]);
    expect(km).to.be.within(2000, 2200);
  });

  it('greatCircle：跨 180 度經線時經度保持連續', () => {
    const path = greatCircle([121.5, 25], [-118.2, 34], 32);
    expect(path).to.have.length(33);
    path.slice(1).forEach(([lng], i) => {
      expect(Math.abs(lng - path[i][0])).to.be.below(180);
    });
    expect(path[path.length - 1][0]).to.be.closeTo(-118.2 + 360, 1e-6);
  });

  it('wrapLng：換算到 [seam, seam + 360)', () => {
    expect(wrapLng(-118, -30)).to.equal(242);
    expect(wrapLng(10, -30)).to.equal(10);
  });

  it('flowPath：歐洲 → 美西不跨接縫經線', () => {
    const seam = -30;
    const path = flowPath([10.45, 51.17], [-118.2437 + 360, 34.0522], seam);
    path.forEach(([lng]) => {
      expect(lng).to.be.at.least(seam);
      expect(lng).to.be.below(seam + 360);
    });
  });

  it('slicePath：頭尾落在指定比例上', () => {
    const line = [[0, 0], [10, 0], [20, 0]];
    expect(slicePath(line, 0.25, 0.75)).to.deep.equal([[5, 0], [10, 0], [15, 0]]);
  });

  it('containsPoint：支援挖洞的多邊形', () => {
    const geometry = {
      type: 'Polygon',
      coordinates: [
        [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
        [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
      ],
    };
    expect(containsPoint(geometry, [2, 2])).to.equal(true);
    expect(containsPoint(geometry, [5, 5])).to.equal(false);
    expect(containsPoint(geometry, [20, 5])).to.equal(false);
  });
});
