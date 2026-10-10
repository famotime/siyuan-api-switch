import { ref, onMounted, onUnmounted } from "vue";

const STORAGE_KEY_SIZE = "sy_api_switch_dialog_size";
const DEFAULT_WIDTH = 920;
const DEFAULT_HEIGHT = 680;
const MIN_WIDTH = 640;
const MIN_HEIGHT = 480;

export function useWindowDrag(enableDebugLog?: () => boolean) {
  const showDialog = ref(false);
  const dialogWidth = ref(DEFAULT_WIDTH);
  const dialogHeight = ref(DEFAULT_HEIGHT);
  const dialogTranslateX = ref(0);
  const dialogTranslateY = ref(0);
  const isMaximized = ref(false);
  const isDraggingWindow = ref(false);
  const isResizingWindow = ref(false);
  const prevWindowState = ref<{ width: number; height: number; x: number; y: number } | null>(null);

  // 加载本地持久化的弹窗尺寸
  const loadSavedDialogSize = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SIZE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.width === "number" && typeof parsed.height === "number") {
          const maxW = Math.max(MIN_WIDTH, window.innerWidth - 32);
          const maxH = Math.max(MIN_HEIGHT, window.innerHeight - 32);
          dialogWidth.value = Math.min(Math.max(parsed.width, MIN_WIDTH), maxW);
          dialogHeight.value = Math.min(Math.max(parsed.height, MIN_HEIGHT), maxH);
          return;
        }
      }
    } catch (err) {
      if (enableDebugLog?.()) {
        console.warn("Failed to load dialog size:", err);
      }
    }
    dialogWidth.value = Math.min(DEFAULT_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - 32));
    dialogHeight.value = Math.min(DEFAULT_HEIGHT, Math.max(MIN_HEIGHT, window.innerHeight - 32));
  };

  // 保存弹窗尺寸至本地
  const saveDialogSize = () => {
    if (isMaximized.value) return;
    try {
      localStorage.setItem(
        STORAGE_KEY_SIZE,
        JSON.stringify({
          width: Math.round(dialogWidth.value),
          height: Math.round(dialogHeight.value),
        })
      );
    } catch (err) {
      // ignore
    }
  };

  // 打开弹窗
  const openDialog = () => {
    loadSavedDialogSize();
    dialogTranslateX.value = 0;
    dialogTranslateY.value = 0;
    isMaximized.value = false;
    showDialog.value = true;
  };

  // 关闭弹窗
  const closeDialog = () => {
    showDialog.value = false;
  };

  // 8 方向拖拽缩放
  const onResizeStart = (e: MouseEvent, direction: string) => {
    if (isMaximized.value) {
      isMaximized.value = false;
    }

    isResizingWindow.value = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = dialogWidth.value;
    const startH = dialogHeight.value;
    const startTx = dialogTranslateX.value;
    const startTy = dialogTranslateY.value;

    const minW = MIN_WIDTH;
    const minH = MIN_HEIGHT;
    const maxW = Math.max(minW, window.innerWidth - 32);
    const maxH = Math.max(minH, window.innerHeight - 32);

    const originalUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (direction.includes("e")) {
        const targetW = startW + dx;
        const newW = Math.min(maxW, Math.max(minW, targetW));
        const deltaW = newW - startW;
        dialogWidth.value = newW;
        dialogTranslateX.value = startTx + deltaW / 2;
      } else if (direction.includes("w")) {
        const targetW = startW - dx;
        const newW = Math.min(maxW, Math.max(minW, targetW));
        const deltaW = newW - startW;
        dialogWidth.value = newW;
        dialogTranslateX.value = startTx - deltaW / 2;
      }

      if (direction.includes("s")) {
        const targetH = startH + dy;
        const newH = Math.min(maxH, Math.max(minH, targetH));
        const deltaH = newH - startH;
        dialogHeight.value = newH;
        dialogTranslateY.value = startTy + deltaH / 2;
      } else if (direction.includes("n")) {
        const targetH = startH - dy;
        const newH = Math.min(maxH, Math.max(minH, targetH));
        const deltaH = newH - startH;
        dialogHeight.value = newH;
        dialogTranslateY.value = startTy - deltaH / 2;
      }
    };

    const onMouseUp = () => {
      isResizingWindow.value = false;
      document.body.style.userSelect = originalUserSelect;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      saveDialogSize();
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // 顶栏按住拖拽移动弹窗
  const onHeaderMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && target.closest("button, input, select, textarea, a, .header-actions")) {
      return;
    }

    if (isMaximized.value) {
      return;
    }

    isDraggingWindow.value = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startTx = dialogTranslateX.value;
    const startTy = dialogTranslateY.value;

    const originalUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const maxTx = Math.max(0, (window.innerWidth - dialogWidth.value) / 2);
    const maxTy = Math.max(0, (window.innerHeight - dialogHeight.value) / 2);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      const newTx = startTx + dx;
      const newTy = startTy + dy;

      dialogTranslateX.value = Math.min(maxTx, Math.max(-maxTx, newTx));
      dialogTranslateY.value = Math.min(maxTy, Math.max(-maxTy, newTy));
    };

    const onMouseUp = () => {
      isDraggingWindow.value = false;
      document.body.style.userSelect = originalUserSelect;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // 最大化 / 还原切换
  const toggleMaximize = () => {
    if (!isMaximized.value) {
      prevWindowState.value = {
        width: dialogWidth.value,
        height: dialogHeight.value,
        x: dialogTranslateX.value,
        y: dialogTranslateY.value,
      };
      dialogWidth.value = Math.max(MIN_WIDTH, window.innerWidth - 32);
      dialogHeight.value = Math.max(MIN_HEIGHT, window.innerHeight - 32);
      dialogTranslateX.value = 0;
      dialogTranslateY.value = 0;
      isMaximized.value = true;
    } else {
      if (prevWindowState.value) {
        dialogWidth.value = prevWindowState.value.width;
        dialogHeight.value = prevWindowState.value.height;
        dialogTranslateX.value = prevWindowState.value.x;
        dialogTranslateY.value = prevWindowState.value.y;
      } else {
        loadSavedDialogSize();
        dialogTranslateX.value = 0;
        dialogTranslateY.value = 0;
      }
      isMaximized.value = false;
    }
  };

  // 窗口尺寸自适应监听
  const handleWindowResize = () => {
    if (isMaximized.value) {
      dialogWidth.value = Math.max(MIN_WIDTH, window.innerWidth - 32);
      dialogHeight.value = Math.max(MIN_HEIGHT, window.innerHeight - 32);
      dialogTranslateX.value = 0;
      dialogTranslateY.value = 0;
    } else {
      const maxW = Math.max(MIN_WIDTH, window.innerWidth - 32);
      const maxH = Math.max(MIN_HEIGHT, window.innerHeight - 32);
      if (dialogWidth.value > maxW) dialogWidth.value = maxW;
      if (dialogHeight.value > maxH) dialogHeight.value = maxH;
      const maxTx = Math.max(0, (window.innerWidth - dialogWidth.value) / 2);
      const maxTy = Math.max(0, (window.innerHeight - dialogHeight.value) / 2);
      dialogTranslateX.value = Math.min(maxTx, Math.max(-maxTx, dialogTranslateX.value));
      dialogTranslateY.value = Math.min(maxTy, Math.max(-maxTy, dialogTranslateY.value));
    }
  };

  onMounted(() => {
    loadSavedDialogSize();
    window.addEventListener("resize", handleWindowResize);
  });

  onUnmounted(() => {
    window.removeEventListener("resize", handleWindowResize);
  });

  return {
    showDialog,
    dialogWidth,
    dialogHeight,
    dialogTranslateX,
    dialogTranslateY,
    isMaximized,
    isDraggingWindow,
    isResizingWindow,
    openDialog,
    closeDialog,
    toggleMaximize,
    onHeaderMouseDown,
    onResizeStart,
  };
}
