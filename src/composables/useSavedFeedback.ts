import { ref, onUnmounted } from "vue";

/**
 * 保存成功轻量提示反馈：showSavedFeedback 置位 isSaved 并在 durationMs 后自动消退，
 * clearSavedFeedback 立即复位。组件卸载时自动清理定时器。
 * ProviderEditPanel / ProfileEditPanel 共用（原为两处复制的 1800ms timer 实现）。
 */
export function useSavedFeedback(durationMs = 1800) {
  const isSaved = ref(false);
  let savedTimer: any = null;

  const showSavedFeedback = () => {
    if (savedTimer) {
      clearTimeout(savedTimer);
      savedTimer = null;
    }
    isSaved.value = true;
    savedTimer = setTimeout(() => {
      isSaved.value = false;
      savedTimer = null;
    }, durationMs);
  };

  const clearSavedFeedback = () => {
    if (savedTimer) {
      clearTimeout(savedTimer);
      savedTimer = null;
    }
    isSaved.value = false;
  };

  onUnmounted(() => {
    if (savedTimer) {
      clearTimeout(savedTimer);
      savedTimer = null;
    }
  });

  return { isSaved, showSavedFeedback, clearSavedFeedback };
}
