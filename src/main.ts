import {
  Plugin,
} from "siyuan";
import { createApp } from 'vue'
import App from './App.vue'
import { DEBUG_SETTINGS_KEY } from "@/constants/debug"

let plugin: Plugin | null = null
export function usePlugin(pluginProps?: Plugin): Plugin {
  if (localStorage.getItem(DEBUG_SETTINGS_KEY) === "true") { console.log('usePlugin', pluginProps, plugin); }
  if (pluginProps) {
    plugin = pluginProps
  }
  if (!plugin && !pluginProps) {
    if (localStorage.getItem(DEBUG_SETTINGS_KEY) === "true") { console.error('need bind plugin'); }
  }
  return plugin!;
}

let app: any = null
export function init(pluginInstance: Plugin) {
  // bind plugin hook
  usePlugin(pluginInstance);

  const div = document.createElement('div')
  div.classList.toggle('siyuan-api-switch-app')
  div.id = pluginInstance.name
  app = createApp(App)
  app.mount(div)
  document.body.appendChild(div)
}

export function destroy() {
  if (app) {
    app.unmount()
  }
  if (plugin) {
    const div = document.getElementById(plugin.name)
    if (div) {
      document.body.removeChild(div)
    }
  }
}
