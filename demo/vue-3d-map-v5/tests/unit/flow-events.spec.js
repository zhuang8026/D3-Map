import { expect } from 'chai';
import {
  normalizeEvents, createRouteCache, createCountryLookup,
} from '@/components/CableMap/lib/flow-events';
import { FLOW } from '@/components/CableMap/lib/config';

const nodes = { TW: { name: '台北', coordinates: [121.5, 25] } };
const countryCoords = { TW: [121, 23.7], DE: [10.45, 51.17], US: [-98.58, 39.83] };

describe('lib/flow-events', () => {
  it('normalizeEvents：依時間排序，略過查不到座標的國家', () => {
    const { events, missing } = normalizeEvents([
      {
        timestamp: '2026-01-01T00:02:00Z', country_code: 'DE', source_node_country: 'TW', block_layer: 'L4',
      },
      {
        timestamp: '2026-01-01T00:01:00Z', country_code: 'US', source_node_country: 'TW', block_layer: 'L7',
      },
      {
        timestamp: '2026-01-01T00:00:00Z', country_code: 'ZZ', source_node_country: 'TW', block_layer: 'L7',
      },
    ], { nodes, countryCoords });
    expect(events.map((e) => e.srcCode)).to.deep.equal(['US', 'DE']);
    expect(events.map((e) => e.layer)).to.deep.equal(['L7', 'L4']);
    expect(missing).to.deep.equal(['ZZ']);
  });

  it('createRouteCache：目的地優先用節點座標，飛行時間落在上下限內並快取', () => {
    const routeOf = createRouteCache({ nodes, countryCoords, flow: FLOW });
    const route = routeOf('DE', 'TW');
    expect(route.dst[0]).to.be.closeTo(121.5, 1e-9);
    expect(route.dst[1]).to.be.closeTo(25, 1e-9);
    expect(route.duration).to.be.within(FLOW.minDuration, FLOW.maxDuration);
    expect(routeOf('DE', 'TW')).to.equal(route);
  });

  it('createCountryLookup：找出代表點所在的國家 feature id', () => {
    const countries = {
      type: 'FeatureCollection',
      features: [{
        id: 7,
        geometry: { type: 'Polygon', coordinates: [[[5, 45], [15, 45], [15, 55], [5, 55], [5, 45]]] },
      }],
    };
    const countryOf = createCountryLookup(countries, countryCoords);
    expect(countryOf('DE')).to.equal(7);
    expect(countryOf('US')).to.equal(null);
  });
});
