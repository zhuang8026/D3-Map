import { expect } from 'chai';
import { mount } from '@vue/test-utils';
import PlaybackBar from '@/components/CableMap/PlaybackBar.vue';

const baseProps = {
  playing: true, rate: 600, rates: [60, 600], clock: 0, count: 1234, total: 5000, enabledLayers: ['L7', 'L4'],
};

// 以 onUpdate:* 監聽器記錄 emit，不依賴 test-utils 的 emitted()
function mountBar(props = {}) {
  const calls = {};
  const listener = (name) => (value) => { (calls[name] ??= []).push(value); };
  const wrapper = mount(PlaybackBar, {
    props: {
      ...baseProps,
      ...props,
      'onUpdate:playing': listener('playing'),
      'onUpdate:rate': listener('rate'),
      'onUpdate:enabledLayers': listener('enabledLayers'),
    },
  });
  return { wrapper, calls };
}

describe('PlaybackBar.vue', () => {
  it('顯示攔截次數，沒有資料時時鐘顯示 —', () => {
    expect(mountBar().wrapper.text()).to.include('已攔截 1,234 / 5,000');
    expect(mountBar({ total: 0 }).wrapper.find('.playback-bar__clock').text()).to.equal('—');
  });

  it('點播放鍵 emit update:playing', async () => {
    const { wrapper, calls } = mountBar();
    await wrapper.find('.playback-bar__toggle').trigger('click');
    expect(calls.playing).to.deep.equal([false]);
  });

  it('切換倍速 emit 數字', async () => {
    const { wrapper, calls } = mountBar();
    await wrapper.find('select').setValue('60');
    expect(calls.rate).to.deep.equal([60]);
  });

  it('取消勾選 L4 emit 剩下的層級', async () => {
    const { wrapper, calls } = mountBar();
    await wrapper.findAll('input[type="checkbox"]')[1].setValue(false);
    expect(calls.enabledLayers).to.deep.equal([['L7']]);
  });
});
