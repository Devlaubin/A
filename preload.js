const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("api", {
    navigate: (data) => ipcRenderer.send("navigate", data),
    newTab: () => ipcRenderer.send("new-tab"),
    switchTab: (i) => ipcRenderer.send("switch-tab", i),
    closeTab: (i) => ipcRenderer.send("close-tab", i),
    back: (i) => ipcRenderer.send("go-back", i),
    forward: (i) => ipcRenderer.send("go-forward", i),
    getHistory: () => ipcRenderer.send("get-history"),
    onTabs: (callback) => ipcRenderer.on("tabs", callback),
    onHistory: (callback) => ipcRenderer.on("history", callback)
    ,onNavState: (callback) => ipcRenderer.on('nav-state', callback)
})
