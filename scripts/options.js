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
  suffixList: document.getElementById("suffix-list"),
  addButton: document.getElementById("add-suffix"),
  newSuffixInput: document.getElementById("new-suffix"),
  doubleClickToggle: document.getElementById("double-click-toggle"),
  subfolderToggle: document.getElementById("subfolder-toggle"),
  togglePassword: document.querySelector(".toggle-password"),
  tokenInput: document.querySelector("#dropbox-token"),
  dropboxToggle: document.querySelector("#dropbox-toggle"),
  dropboxFolder: document.querySelector("#dropbox-folder"),
};

function createRemoveButton(suffixes, index) {
  const removeButton = document.createElement("button");
  removeButton.textContent = "Remover";
  removeButton.addEventListener("click", () => {
    removeSuffix(suffixes, index);
  });
  return removeButton;
}

function createSuffixListItem(suffix, suffixes, index) {
  const li = document.createElement("li");
  li.textContent = suffix;

  if (suffix !== "direct") {
    const removeButton = createRemoveButton(suffixes, index);
    li.appendChild(removeButton);
  }

  return li;
}

function renderSuffixList(suffixes) {
  UI_ELEMENTS.suffixList.innerHTML = "";
  suffixes.forEach((suffix, index) => {
    const listItem = createSuffixListItem(suffix, suffixes, index);
    UI_ELEMENTS.suffixList.appendChild(listItem);
  });
}

async function removeSuffix(suffixes, index) {
  try {
    suffixes.splice(index, 1);
    await browser.storage.local.set({ suffixes });
    renderSuffixList(suffixes);
  } catch (error) {
    console.error("Error removing suffix:", error);
  }
}

async function addNewSuffix(suffixes) {
  const newSuffix = UI_ELEMENTS.newSuffixInput.value.trim();

  if (newSuffix && !suffixes.includes(newSuffix)) {
    try {
      suffixes.push(newSuffix);
      await browser.storage.local.set({ suffixes });
      UI_ELEMENTS.newSuffixInput.value = "";
      renderSuffixList(suffixes);
    } catch (error) {
      console.error("Error adding suffix:", error);
    }
  }
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

async function updateDropboxToken(token) {
  try {
    await browser.storage.local.set({ dropboxToken: token });
  } catch (error) {
    console.error("Error updating dropbox token:", error);
  }
}

async function updateDropboxFolder(folderPath) {
  try {
    await browser.storage.local.set({ dropboxFolderPath: folderPath });
  } catch (error) {
    console.error("Error updating dropbox folder:", error);
  }
}

function setupAddSuffixButton(suffixes) {
  UI_ELEMENTS.addButton.addEventListener("click", () => {
    addNewSuffix(suffixes);
  });
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

function setupTokenInput() {
  UI_ELEMENTS.tokenInput.addEventListener("input", () => {
    const token = UI_ELEMENTS.tokenInput.value;
    updateDropboxToken(token);
  });
}

function setupDropboxFolderInput() {
  UI_ELEMENTS.dropboxFolder.addEventListener("input", () => {
    const folderPath = UI_ELEMENTS.dropboxFolder.value;
    updateDropboxFolder(folderPath);
  });
}

function setupPasswordToggle() {
  UI_ELEMENTS.togglePassword.addEventListener("click", function () {
    const type =
      UI_ELEMENTS.tokenInput.getAttribute("type") === "password"
        ? "text"
        : "password";
    UI_ELEMENTS.tokenInput.setAttribute("type", type);
    this.classList.toggle("showing");
  });
}

function setupEventListeners(suffixes) {
  setupAddSuffixButton(suffixes);
  setupDoubleClickToggle();
  setupSubfolderToggle();
  setupDropboxToggle();
  setupTokenInput();
  setupDropboxFolderInput();
  setupPasswordToggle();
}

function updateUIFromSettings(data) {
  renderSuffixList(data.suffixes);
  UI_ELEMENTS.doubleClickToggle.checked = data.doubleClickEnabled;
  UI_ELEMENTS.subfolderToggle.checked = data.subfolderEnabled;
  UI_ELEMENTS.dropboxToggle.checked = data.dropboxEnabled;
  UI_ELEMENTS.tokenInput.value = data.dropboxToken;
  UI_ELEMENTS.dropboxFolder.value = data.dropboxFolderPath;
}

async function loadSettings() {
  try {
    const data = await browser.storage.local.get(DEFAULT_SETTINGS);
    updateUIFromSettings(data);
    setupEventListeners(data.suffixes);
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

async function initializeOptions() {
  await loadSettings();
}

initializeOptions();
