import { computed, ref, watch } from 'vue';

/**
 * 可選的 v-model：父元件有綁定 v-model:name 時跟著父元件的值，
 * 沒綁定時元件自己保存狀態；兩種情況都會 emit('update:name')。
 *
 * @param {object} props defineProps 的回傳值
 * @param {Function} emit defineEmits 的回傳值
 * @param {string} name prop 名稱
 */
export default function useSyncedProp(props, emit, name) {
  const local = ref(props[name]);
  watch(() => props[name], (value) => { local.value = value; });
  return computed({
    get: () => local.value,
    set: (value) => {
      local.value = value;
      emit(`update:${name}`, value);
    },
  });
}
