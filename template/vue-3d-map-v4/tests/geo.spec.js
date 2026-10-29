import { expect } from 'chai';
import {
  distanceKm, greatCircle, slicePath, containsPoint, unwrapLongitudes,
} from '../src/components/CableMap/utils/geo.js';

const TAIPEI = [121.5654, 25.033];
const LOS_ANGELES = [-118.2437 + 360, 34.0522];

describe('geo', () => {
  it('distanceKm：台北到洛杉磯約 10,900 公里', () => {
    expect(distanceKm(TAIPEI, LOS_ANGELES)).to.be.closeTo(10900, 100);
  });

  it('greatCircle：跨 180 度經線時經度保持連續', () => {
    const path = greatCircle(TAIPEI, LOS_ANGELES);
    expect(path).to.have.length(65);
    expect(path[0]).to.deep.equal(TAIPEI);
    expect(path[64][0]).to.be.closeTo(241.7563, 1e-6);
    path.slice(1).forEach(([lng], i) => {
      expect(Math.abs(lng - path[i][0])).to.be.below(5);
    });
  });

  it('greatCircle：同一點只回傳兩個點', () => {
    expect(greatCircle(TAIPEI, TAIPEI)).to.have.length(2);
  });

  it('slicePath：頭尾內插、中間保留原始點', () => {
    const line = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]];
    expect(slicePath(line, 0.125, 0.625)).to.deep.equal([[0.5, 0], [1, 0], [2, 0], [2.5, 0]]);
    expect(slicePath(line, 0, 1)).to.deep.equal(line);
  });

  it('containsPoint：支援挖洞的多邊形', () => {
    const donut = {
      type: 'Polygon',
      coordinates: [
        [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
        [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
      ],
    };
    expect(containsPoint(donut, [2, 2])).to.equal(true);
    expect(containsPoint(donut, [5, 5])).to.equal(false);
    expect(containsPoint(donut, [12, 5])).to.equal(false);
  });

  it('unwrapLongitudes：西半球經度加 360', () => {
    expect(unwrapLongitudes([[170, 0], [-170, 0]])).to.deep.equal([[170, 0], [190, 0]]);
    expect(unwrapLongitudes([[100, 0], [120, 0]])).to.deep.equal([[100, 0], [120, 0]]);
  });
});
