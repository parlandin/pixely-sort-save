const DEFAULT_SETTINGS = {
  suffixes: ["picture", "wallpapers", "uncategorized", "direct"],
  doubleClickEnabled: true,
  subfolderEnabled: true,
  dropboxToken: "",
  dropboxFolderPath: "/",
  dropboxEnabled: false,
};

const MESSAGE_ACTIONS = {
  UPDATE_SUBFOLDER_ENABLED: "updateSubfolderEnabled",
  UPDATE_DROPBOX_ENABLED: "updateDropboxEnabled",
};

const UI_ELEMENTS = {
  doubleClickToggle: document.getElementById("double-click-toggle"),
  subfolderToggle: document.getElementById("subfolder-toggle"),
  dropboxToggle: document.getElementById("dropbox-toggle"),
  settingsButton: document.querySelector(".settings-button"),
};

function handleSettingsButtonClick() {
  chrome.runtime.openOptionsPage();
}

async function updateDoubleClickSetting(isEnabled) {
  try {
    await browser.storage.local.set({ doubleClickEnabled: isEnabled });
  } catch (error) {
    console.error("Error updating double click setting:", error);
  }
}

async function updateSubfolderSetting(isEnabled) {
  try {
    await browser.runtime.sendMessage({
      action: MESSAGE_ACTIONS.UPDATE_SUBFOLDER_ENABLED,
      subfolderEnabled: isEnabled,
    });
  } catch (error) {
    console.error("Error updating subfolder setting:", error);
  }
}

async function updateDropboxSetting(isEnabled) {
  try {
    await browser.storage.local.set({ dropboxEnabled: isEnabled });
    await browser.runtime.sendMessage({
      action: MESSAGE_ACTIONS.UPDATE_DROPBOX_ENABLED,
      dropboxEnabled: isEnabled,
    });
  } catch (error) {
    console.error("Error updating dropbox setting:", error);
  }
}

function setupDoubleClickToggle() {
  UI_ELEMENTS.doubleClickToggle.addEventListener("change", () => {
    const isEnabled = UI_ELEMENTS.doubleClickToggle.checked;
    updateDoubleClickSetting(isEnabled);
  });
}

function setupSubfolderToggle() {
  UI_ELEMENTS.subfolderToggle.addEventListener("change", () => {
    const isEnabled = UI_ELEMENTS.subfolderToggle.checked;
    updateSubfolderSetting(isEnabled);
  });
}

function setupDropboxToggle() {
  UI_ELEMENTS.dropboxToggle.addEventListener("change", () => {
    const isEnabled = UI_ELEMENTS.dropboxToggle.checked;
    updateDropboxSetting(isEnabled);
  });
}

function setupEventListeners() {
  UI_ELEMENTS.settingsButton.addEventListener(
    "click",
    handleSettingsButtonClick
  );
  setupDoubleClickToggle();
  setupSubfolderToggle();
  setupDropboxToggle();
}

function updateUIFromSettings(data) {
  UI_ELEMENTS.doubleClickToggle.checked = data.doubleClickEnabled;
  UI_ELEMENTS.subfolderToggle.checked = data.subfolderEnabled;
  UI_ELEMENTS.dropboxToggle.checked = data.dropboxEnabled;
}

async function loadSettings() {
  try {
    const data = await browser.storage.local.get(DEFAULT_SETTINGS);
    updateUIFromSettings(data);
  } catch (error) {
    console.error("Error retrieving settings:", error);
  }
}

async function initializePopup() {
  await loadSettings();
  setupEventListeners();
}

initializePopup();
