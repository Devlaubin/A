let currentTab = 0
const tabState = {}

function normalizeInputToUrl(input) {
    input = input.trim()
    if (!input) return ''
    // si ressemble à URL commence par http
    if (input.startsWith('http://') || input.startsWith('https://')) return input
    // si contient un espace, faire une recherche Google
    if (input.includes(' ')) return 'https://www.google.com/search?q=' + encodeURIComponent(input)
    // si contient un point, considérer comme domaine
    if (input.includes('.')) return 'https://' + input
    // sinon recherche
    return 'https://www.google.com/search?q=' + encodeURIComponent(input)
}

function ensureTabState(i) {
    if (!tabState[i]) tabState[i] = { history: [], index: -1 }
    return tabState[i]
}

function go() {
    const raw = document.getElementById("url").value
    const url = normalizeInputToUrl(raw)
    if (!url) return
    // Envoyer la navigation au main process (BrowserView gèrera le rendu)
    if (window.api && window.api.navigate) {
        window.api.navigate({ tab: currentTab, url })
    } else {
        // fallback iframe if api missing
        const state = ensureTabState(currentTab)
        if (state.index < state.history.length - 1) state.history = state.history.slice(0, state.index + 1)
        state.history.push(url)
        state.index++
        showInContent(url)
        updateNavButtons(state.index > 0, state.index < state.history.length - 1)
    }
}

function newTab() {
    // create local state and ask main for a new tab if available
    const idx = Object.keys(tabState).length
    ensureTabState(idx)
    currentTab = idx
    // if main process supports new tab, notify it too
    if (window.api && window.api.newTab) window.api.newTab()
    renderTabsLocal()
}

function back() {
    const state = ensureTabState(currentTab)
    if (state.index > 0) {
        state.index--
        showInContent(state.history[state.index])
        updateNavButtons(state.index > 0, state.index < state.history.length - 1)
    }
}

function forward() {
    const state = ensureTabState(currentTab)
    if (state.index < state.history.length - 1) {
        state.index++
        showInContent(state.history[state.index])
        updateNavButtons(state.index > 0, state.index < state.history.length - 1)
    }
}

function showHistory() {
    const state = ensureTabState(currentTab)
    alert((state.history || []).join('\n'))
}

function clearHistory() {
    tabState[currentTab] = { history: [], index: -1 }
    updateNavButtons(false, false)
}

function reload() {
    const iframe = document.getElementById('content-iframe')
    if (iframe) {
        try { iframe.contentWindow.location.reload() } catch (e) { iframe.src = iframe.src }
    }
}
function updateURL(url) {
    document.getElementById("url").value = url
}
function updateNavButtons(canGoBack, canGoForward) {
    document.getElementById("back").disabled = !canGoBack
    document.getElementById("forward").disabled = !canGoForward
}
function closetab(tabIndex = currentTab) {
    window.api.closeTab(tabIndex)
}

function showInContent(url) {
    const container = document.getElementById('content')
    if (!container) return
    let iframe = document.getElementById('content-iframe')
    if (!iframe) {
        iframe = document.createElement('iframe')
        iframe.id = 'content-iframe'
        iframe.style.position = 'absolute'
        iframe.style.top = '16px'
        iframe.style.left = '0'
        iframe.style.width = '100%'
        iframe.style.height = 'calc(100% - 16px)'
        iframe.style.border = 'none'
        container.innerHTML = ''
        container.appendChild(iframe)
    }
    iframe.src = url
    document.getElementById('url').value = url
}

function renderTabsLocal() {
    // minimal local rendering when main doesn't send tabs
    const tabsDiv = document.getElementById('tabs')
    tabsDiv.innerHTML = ''
    const keys = Object.keys(tabState)
    if (keys.length === 0) ensureTabState(0)
    for (let i = 0; i < keys.length; i++) {
        const div = document.createElement('div')
        div.className = 'tab' + (i === currentTab ? ' active' : '')
        div.textContent = 'Onglet ' + (i + 1)
        div.onclick = () => { currentTab = i }
        tabsDiv.appendChild(div)
    }
}

window.api.onTabs((e, tabs) => {
    const tabsDiv = document.getElementById("tabs")
    tabsDiv.innerHTML = ""

    tabs.forEach((t, i) => {
        const div = document.createElement("div")
        div.className = "tab" + (i === currentTab ? " active" : "")

        if (t.favicon) {
            const img = document.createElement("img")
            img.src = t.favicon
            img.style.width = "16px"
            img.style.marginRight = "6px"
            div.appendChild(img)
        }

        div.append(t.title || "New tab")
        div.onclick = () => {
            currentTab = i
            window.api.switchTab(i)
        }

        tabsDiv.appendChild(div)
    })
})

window.api.onHistory((e, history) => {
    alert(history.map(h => h.url).join("\n"))
})

if (window.api && window.api.onNavState) {
    window.api.onNavState((e, s) => {
        // mettre à jour uniquement pour l'onglet courant
        if (s && typeof s.tab === 'number' && s.tab === currentTab) {
            // si un BrowserView affiche la page, supprimer l'iframe fallback
            const iframe = document.getElementById('content-iframe')
            if (iframe) {
                try { iframe.remove() } catch (e) { iframe.style.display = 'none' }
            }
            updateURL(s.url || '')
            updateNavButtons(!!s.canGoBack, !!s.canGoForward)
        }
    })
}

// Initial local render
renderTabsLocal()

