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

export const fetchSyncPost = async (url: string, data: any): Promise<any> => {
  return { code: 0, msg: "", data: {} };
};

export const getFrontend = (): string => "desktop";

export const showMessage = (msg: string, timeout: number = 3000): void => {};
