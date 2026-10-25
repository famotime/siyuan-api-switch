export class Plugin {
  name: string = "siyuan-api-switch";
  version: string = "0.9.0";
  displayName: string = "API 旋钮";

  async loadData(key: string): Promise<any> {
    return null;
  }

  async saveData(key: string, data: any): Promise<void> {}

  async removeData(key: string): Promise<void> {}
}

type FetchHandler = (url: string, data: any) => any;

let fetchHandler: FetchHandler | null = null;

/** 注入可编程的内核响应处理器；传 null 恢复默认 {code:0} 响应 */
export const setFetchHandler = (handler: FetchHandler | null) => {
  fetchHandler = handler;
};

export const fetchSyncPost = async (url: string, data: any): Promise<any> => {
  if (fetchHandler) {
    return await fetchHandler(url, data);
  }
  return { code: 0, msg: "", data: {} };
};

export const getFrontend = (): string => "desktop";

export const showMessage = (msg: string, timeout: number = 3000): void => {};
