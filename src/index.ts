import {
  Plugin,
  getFrontend,
} from "siyuan";
import "@/index.scss";
import PluginInfoString from '@/../plugin.json'
import { destroy, init } from '@/main'
import { apiSwitchCore, STORAGE_KEY } from "@/services/api-switch-core";
import { DEBUG_SETTINGS_KEY } from "@/constants/debug";
import { SyFrontendTypes } from "@/types";
import { t } from "@/utils/i18n";

const {
  version,
} = PluginInfoString

export default class ApiSwitchPlugin extends Plugin {
  // Run as mobile
  public isMobile: boolean
  // Run in browser
  public isBrowser: boolean
  // Run as local
  public isLocal: boolean
  // Run in Electron
  public isElectron: boolean
  // Run in window
  public isInWindow: boolean
  public platform: SyFrontendTypes
  public readonly version = version

  async onload() {
    const frontEnd = getFrontend();
    this.platform = frontEnd as SyFrontendTypes
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile"
    this.isBrowser = frontEnd.includes('browser')
    this.isLocal =
      location.href.includes('127.0.0.1')
      || location.href.includes('localhost')
    this.isInWindow = location.href.includes('window.html')

    try {
      require("@electron/remote")
        .require("@electron/remote/main")
      this.isElectron = true
    } catch (err) {
      this.isElectron = false
    }

    if (localStorage.getItem(DEBUG_SETTINGS_KEY) === "true") { console.log('Plugin loaded, the plugin is ', this); }

    // 初始化 API 旋钮核心
    await apiSwitchCore.initialize(this);

    init(this);

    // 注册工具栏顶栏图标，点击后打开统一入口
    this.addTopBar({
      icon: "iconSparkles",
      title: this.i18n?.topBarTitle || t("topBarTitle"),
      position: "right",
      callback: () => {
        this.openSetting();
      },
    });
  }

  onunload() {
    apiSwitchCore.destroy();
    destroy()
  }

  uninstall() {
    this.removeData(STORAGE_KEY);
  }

  openSetting() {
    window._sy_api_switch?.openSetting?.()
  }
}
