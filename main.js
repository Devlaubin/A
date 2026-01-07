const { app, BrowserWindow, BrowserView, ipcMain } = require("electron")
const { autoUpdater } = require("electron-updater");
require('dotenv').config();

let win
let tabs = []
let currentTab = 0
let history = []

function createTab(url = "https://google.com") {
    const view = new BrowserView({
        webPreferences: {
            sandbox: true
        }
    })

    view.webContents.loadURL(url)

    // 🔒 Sécurité : bloquer protocoles dangereux
    view.webContents.on("will-navigate", (e, navUrl) => {
        if (!navUrl.startsWith("http")) {
            e.preventDefault()
        }
    })

    // 🏷️ Titre
    view.webContents.on("page-title-updated", () => {
        sendTabs()
    })

    // 🖼️ Favicon
    view.webContents.on("page-favicon-updated", (e, favicons) => {
        view.favicon = favicons[0]
        sendTabs()
    })

    // Envoyer état de navigation au renderer
    const sendNavStateForView = () => {
        const idx = tabs.indexOf(view)
        if (win && !win.isDestroyed()) {
            win.webContents.send('nav-state', {
                tab: idx,
                canGoBack: view.webContents.canGoBack(),
                canGoForward: view.webContents.canGoForward(),
                url: view.webContents.getURL()
            })
        }
    }

    view.webContents.on('did-navigate', sendNavStateForView)
    view.webContents.on('did-navigate-in-page', sendNavStateForView)
    view.webContents.on('did-finish-load', () => { sendTabs(); sendNavStateForView() })

    tabs.push(view)
    switchTab(tabs.length - 1)
}


function switchTab(index) {
    if (tabs[currentTab]) {
        win.removeBrowserView(tabs[currentTab])
    }

    currentTab = index
    win.addBrowserView(tabs[currentTab])

    const [w, h] = win.getContentSize()
    tabs[currentTab].setBounds({ x: 0, y: 70, width: w, height: h - 70 })
}

function sendTabs() {
    win.webContents.send(
        "tabs",
        tabs.map(t => ({
            title: t.webContents.getTitle(),
            favicon: t.favicon
        }))
    )
}


app.whenReady().then(() => {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: __dirname + "/preload.js",
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    })

    win.loadFile("index.html")

    // 🔄 Configuration auto-update avec token GitHub
    if (process.env.GITHUB_TOKEN) {
        autoUpdater.setFeedURL({
            provider: "github",
            owner: "Devlaubin",
            repo: "A",
            token: process.env.GITHUB_TOKEN
        });
        
        autoUpdater.checkForUpdatesAndNotify();
    } else {
        console.warn("⚠️ GITHUB_TOKEN non défini - auto-update désactivé");
    }
})

ipcMain.on("navigate", (e, data) => {
    let url = data.url
    if (!url.startsWith("http")) {
        url = "https://" + url
    }
    const tabIndex = (typeof data.tab === 'number') ? data.tab : currentTab
    // Si l'onglet n'existe pas côté main, en créer un
    if (!tabs[tabIndex]) {
        createTab(url)
        return
    }
    tabs[tabIndex].webContents.loadURL(url)
    history.push({ url, date: Date.now() })

})

ipcMain.on("new-tab", () => {
    createTab()
})

ipcMain.on("switch-tab", (e, index) => {
    switchTab(index)
})

ipcMain.on("close-tab", (e, index) => {
    if (tabs.length > 1) {
        tabs.splice(index, 1)
        if (currentTab >= tabs.length) {
            currentTab = tabs.length - 1
        }
        switchTab(currentTab)
        sendTabs()
    }
})

ipcMain.on("go-back", (e, tab) => {
    if (tabs[tab].webContents.canGoBack()) {
        tabs[tab].webContents.goBack()
    }
})

ipcMain.on("go-forward", (e, tab) => {
    if (tabs[tab].webContents.canGoForward()) {
        tabs[tab].webContents.goForward()
    }
})
ipcMain.on("reload", (e, tab) => {
    tabs[tab].webContents.reload()
})
ipcMain.on("get-history", () => {
    win.webContents.send("history", history)
})
ipcMain.on("clear-history", () => {
    history = []
})
// Envoyer les onglets au renderer
ipcMain.on("request-tabs", () => {
    sendTabs()
}
)
ipcMain.on("request-update-check", () => {
    autoUpdater.checkForUpdatesAndNotify();
})
