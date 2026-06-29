/**
 * Copyright (c) 2023 frostime. All rights reserved.
 */

/**
 * Frequently used data structures in SiYuan
 */
type DocumentId = string;
type BlockId = string;
type NotebookId = string;
type PreviousID = BlockId;
type ParentID = BlockId | DocumentId;

type Notebook = {
  id: NotebookId;
  name: string;
  icon: string;
  sort: number;
  closed: boolean;
};

type NotebookConf = {
  name: string;
  closed: boolean;
  refCreateSavePath: string;
  createDocNameTemplate: string;
  dailyNoteSavePath: string;
  dailyNoteTemplatePath: string;
};

type BlockType =
  | "d"
  | "s"
  | "h"
  | "t"
  | "i"
  | "p"
  | "f"
  | "audio"
  | "video"
  | "other";

type BlockSubType =
  | "d1"
  | "d2"
  | "s1"
  | "s2"
  | "s3"
  | "t1"
  | "t2"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "table"
  | "task"
  | "toggle"
  | "latex"
  | "quote"
  | "html"
  | "code"
  | "footnote"
  | "cite"
  | "collection"
  | "bookmark"
  | "attachment"
  | "comment"
  | "mindmap"
  | "spreadsheet"
  | "calendar"
  | "image"
  | "audio"
  | "video"
  | "other";

type Block = {
  id: BlockId;
  parent_id?: BlockId;
  root_id: DocumentId;
  hash: string;
  box: string;
  path: string;
  hpath: string;
  name: string;
  alias: string;
  memo: string;
  tag: string;
  content: string;
  fcontent?: string;
  markdown: string;
  length: number;
  type: BlockType;
  subtype: BlockSubType;
  /** string of { [key: string]: string }
   * For instance: "{: custom-type=\"query-code\" id=\"20230613234017-zkw3pr0\" updated=\"20230613234509\"}"
   */
  ial?: string;
  sort: number;
  created: string;
  updated: string;
};

type doOperation = {
  action: string;
  data: string;
  id: BlockId;
  parentID: BlockId | DocumentId;
  previousID: BlockId;
  retData: null;
};

interface Window {
  siyuan: {
    notebooks: any;
    menus: any;
    dialogs: any;
    blockPanels: any;
    storage: any;
    user: any;
    ws: any;
    languages: any;
  };
  _sy_plugin_sample: {
    [key: string]: any;
  };
  siyuanApiSwitch?: SiyuanApiSwitch;
}

export interface SharedConfig {
  profileId: string;      // 绑定的 Profile ID
  profileName: string;    // Profile 的名称，如 "DeepSeek-Default"
  provider: string;       // 服务商标识，如 "openai", "google", "deepseek", "siliconflow", "custom"
  baseUrl: string;        // API 基础 URL
  apiKey: string;         // API 密钥
  model: string;          // 模型名称
  models?: string[];      // 候选模型列表
  requestTimeoutSeconds?: number; // 请求超时时间（秒）
  temperature?: number;   // 采样温度
  maxTokens?: number;     // 最大 Token 数
  memo?: string;          // 备注
  providerUrl?: string;   // 服务商官网链接
}

export interface SiyuanApiSwitch {
  version: string;
  register(
    pluginId: string,
    displayName: string,
    callback: (config: SharedConfig | null) => void,
    localConfig?: Omit<SharedConfig, "profileId" | "profileName">
  ): void;
  unregister(pluginId: string): void;
  getBoundConfig(pluginId: string): SharedConfig | null;
}


enum SyFrontendTypes {
  // 桌面端
  'desktop' = 'desktop',
  'desktop-window' = 'desktop-window',
  // 移动端
  'mobile' = 'mobile',
  // 浏览器 - 桌面端
  'browser-desktop' = 'browser-desktop',
  // 浏览器 - 移动端
  'browser-mobile' = 'browser-mobile',
}
