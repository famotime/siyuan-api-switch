import { ref } from "vue";

/**
 * JSON 快照脏检查：updateInitialSnapshot 记录当前数据的序列化快照，
 * isDirty 比较当前序列化结果判断是否有未保存改动（未建立快照时恒为 false）。
 * ProviderEditPanel / ProfileEditPanel 共用（原为两处复制的快照实现）。
 */
export function useDirtySnapshot(getData: () => unknown) {
  const initialSnapshot = ref("");

  const updateInitialSnapshot = () => {
    initialSnapshot.value = JSON.stringify(getData());
  };

  const isDirty = () => {
    if (!initialSnapshot.value) return false;
    return JSON.stringify(getData()) !== initialSnapshot.value;
  };

  return { initialSnapshot, updateInitialSnapshot, isDirty };
}
