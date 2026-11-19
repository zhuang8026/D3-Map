import { expect } from 'chai';
import { mount } from '@vue/test-utils';
import MapFilter from '@/components/CableMap/MapFilter.vue';

describe('MapFilter.vue', () => {
  it('標示目前的篩選，點擊時 emit update:modelValue', async () => {
    const calls = [];
    const wrapper = mount(MapFilter, {
      props: { modelValue: 'all', 'onUpdate:modelValue': (v) => calls.push(v) },
    });
    const buttons = wrapper.findAll('button');
    expect(buttons[0].classes()).to.include('map-filter__button--active');
    await buttons[2].trigger('click');
    expect(calls).to.deep.equal(['abnormal']);
  });
});
