// ============================================================================
// CONSTANTS
// ============================================================================
const DEFAULT_SUFFIXES = ["picture", "wallpapers", "uncategorized", "direct"];
const DEFAULT_SETTINGS = {
  suffixes: DEFAULT_SUFFIXES,
  doubleClickEnabled: true,
  subfolderEnabled: true,
  dropboxToken: "",
  dropboxFolderPath: "/",
  dropboxEnabled: false,
};

const CONTEXT_MENU_IDS = {
  LOCAL_SAVE_PARENT: "quick-save-parent",
  LOCAL_SAVE_PREFIX: "quick-save-",
  DROPBOX_SAVE: "dropbox-save",
};

const MESSAGE_ACTIONS = {
  DOWNLOAD_IMAGE: "downloadImage",
  UPDATE_SUBFOLDER_ENABLED: "updateSubfolderEnabled",
  UPDATE_DROPBOX_ENABLED: "updateDropboxEnabled",
  SHOW_SUCCESS_TOAST: "showDownloadSuccessToast",
  SHOW_ERROR_TOAST: "showDownloadErrorToast",
};

// ============================================================================
// CONTEXT MENU MANAGEMENT
// ============================================================================
function createLocalSaveContextMenus(suffixes) {
  browser.contextMenus.create({
    id: CONTEXT_MENU_IDS.LOCAL_SAVE_PARENT,
    title: "Salvar imagem (local)",
    contexts: ["image"],
  });

  suffixes.forEach((suffix) => {
    browser.contextMenus.create({
      id: `${CONTEXT_MENU_IDS.LOCAL_SAVE_PREFIX}${suffix}`,
      parentId: CONTEXT_MENU_IDS.LOCAL_SAVE_PARENT,
      title: suffix,
      contexts: ["image"],
    });
  });
}

function createDropboxSaveContextMenu() {
  browser.contextMenus.create({
    id: CONTEXT_MENU_IDS.DROPBOX_SAVE,
    title: "Salvar no Dropbox",
    contexts: ["image"],
  });
}

async function removeLocalSaveContextMenus() {
  try {
    await browser.contextMenus.remove(CONTEXT_MENU_IDS.LOCAL_SAVE_PARENT);
  } catch (error) {}
}

async function removeDropboxSaveContextMenu() {
  try {
    await browser.contextMenus.remove(CONTEXT_MENU_IDS.DROPBOX_SAVE);
  } catch (error) {}
}

async function updateContextMenusBasedOnSettings(settings) {
  if (!settings) {
    console.error("No settings provided for context menu update.");
    return;
  }

  if (
    settings.hasOwnProperty("suffixes") ||
    settings.hasOwnProperty("subfolderEnabled")
  ) {
    const shouldShowLocalMenus =
      settings.subfolderEnabled && settings.suffixes?.length > 0;

    if (shouldShowLocalMenus) {
      createLocalSaveContextMenus(settings.suffixes);
    } else {
      await removeLocalSaveContextMenus();
    }
  }

  if (settings.hasOwnProperty("dropboxEnabled")) {
    if (settings.dropboxEnabled) {
      createDropboxSaveContextMenu();
    } else {
      await removeDropboxSaveContextMenu();
    }
  }
}

// ============================================================================
// IMAGE DOWNLOAD
// ============================================================================
function buildDownloadFilename(suffix, fileExtension) {
  const randomName = generateRandomName(10);

  if (suffix === "direct") {
    return `images/${randomName}.${fileExtension}`;
  }

  return `images/${suffix}/${randomName}.${fileExtension}`;
}

async function sendSuccessNotification(tabId, message) {
  if (!tabId) return;

  try {
    await browser.tabs.sendMessage(tabId, {
      action: MESSAGE_ACTIONS.SHOW_SUCCESS_TOAST,
      message: message,
    });
  } catch (error) {
    console.error("Erro ao enviar mensagem para a aba:", error);
  }
}

async function downloadImageToLocal(
  imageUrl,
  folderSuffix = "direct",
  tabId = null
) {
  if (!imageUrl) {
    console.error("URL not provided for download");
    return;
  }

  try {
    const fileExtension = getFileExtension(imageUrl);
    const filename = buildDownloadFilename(folderSuffix, fileExtension);

    await browser.downloads.download({
      url: imageUrl,
      filename: filename,
      conflictAction: "uniquify",
      saveAs: false,
    });

    await sendSuccessNotification(tabId, "Imagem salva com sucesso!");
  } catch (error) {
    console.error("Erro ao baixar imagem:", error);
  }
}

// ============================================================================
// STORAGE CHANGE HANDLERS
// ============================================================================
async function handleSuffixesChange(newSuffixes) {
  const { subfolderEnabled } = await browser.storage.local.get(
    "subfolderEnabled"
  );

  return {
    suffixes: newSuffixes,
    subfolderEnabled: subfolderEnabled ?? true,
  };
}

async function handleSubfolderEnabledChange(newSubfolderEnabled) {
  const { suffixes } = await browser.storage.local.get("suffixes");

  return {
    suffixes: suffixes || DEFAULT_SUFFIXES,
    subfolderEnabled: newSubfolderEnabled,
  };
}

function handleDropboxEnabledChange(newDropboxEnabled) {
  return {
    dropboxEnabled: newDropboxEnabled,
  };
}

async function handleStorageChanges(changes) {
  let updatedSettings = {};

  if (changes.suffixes) {
    const suffixSettings = await handleSuffixesChange(
      changes.suffixes.newValue
    );
    updatedSettings = { ...updatedSettings, ...suffixSettings };
  }

  if (changes.subfolderEnabled) {
    const subfolderSettings = await handleSubfolderEnabledChange(
      changes.subfolderEnabled.newValue
    );
    updatedSettings = { ...updatedSettings, ...subfolderSettings };
  }

  if (changes.dropboxEnabled) {
    const dropboxSettings = handleDropboxEnabledChange(
      changes.dropboxEnabled.newValue
    );
    updatedSettings = { ...updatedSettings, ...dropboxSettings };
  }

  /*  console.log("Storage updated:", changes);
  console.log("Updated settings:", updatedSettings); */

  if (Object.keys(updatedSettings).length === 0) {
    console.log("No relevant changes detected.");
    return;
  }

  await updateContextMenusBasedOnSettings(updatedSettings);
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================
function handleContextMenuClick(info, tab) {
  const menuItemId = info.menuItemId;

  if (menuItemId.startsWith(CONTEXT_MENU_IDS.LOCAL_SAVE_PREFIX)) {
    const folderSuffix = menuItemId.replace(
      CONTEXT_MENU_IDS.LOCAL_SAVE_PREFIX,
      ""
    );
    downloadImageToLocal(info.srcUrl, folderSuffix, tab?.id);
    return;
  }

  if (menuItemId === CONTEXT_MENU_IDS.DROPBOX_SAVE) {
    saveImageToDropbox(info.srcUrl, tab?.id);
    return;
  }
}

async function handleDoubleClickDownload(imageUrl, tabId) {
  const { doubleClickEnabled } = await browser.storage.local.get(
    "doubleClickEnabled"
  );

  if (doubleClickEnabled) {
    await downloadImageToLocal(imageUrl, "direct", tabId);
  } else {
    console.log("Download por duplo clique desativado nas configurações.");
    await sendSuccessNotification(
      tabId,
      "Download por duplo clique desativado."
    );
  }
}

async function handleRuntimeMessage(message, sender, sendResponse) {
  const { action } = message;
  const tabId = sender.tab?.id;

  switch (action) {
    case MESSAGE_ACTIONS.DOWNLOAD_IMAGE:
      await handleDoubleClickDownload(message.url, tabId);
      break;

    case MESSAGE_ACTIONS.UPDATE_SUBFOLDER_ENABLED:
      await browser.storage.local.set({
        subfolderEnabled: message.subfolderEnabled,
      });
      break;

    case MESSAGE_ACTIONS.UPDATE_DROPBOX_ENABLED:
      await browser.storage.local.set({
        dropboxEnabled: message.dropboxEnabled,
      });
      break;

    default:
      console.warn(`Unknown action: ${action}`);
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================
async function initializeExtension() {
  try {
    await browser.storage.local.set(DEFAULT_SETTINGS);
    await updateContextMenusBasedOnSettings(DEFAULT_SETTINGS);
  } catch (error) {
    console.error("Error during extension initialization:", error);
  }
}

async function restoreExtensionState() {
  try {
    const settings = await browser.storage.local.get(DEFAULT_SETTINGS);
    await updateContextMenusBasedOnSettings(settings);
  } catch (error) {
    console.error("Error during extension state restoration:", error);
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
browser.runtime.onInstalled.addListener(initializeExtension);
browser.runtime.onStartup.addListener(restoreExtensionState);
browser.storage.onChanged.addListener(handleStorageChanges);
browser.contextMenus.onClicked.addListener(handleContextMenuClick);
browser.runtime.onMessage.addListener(handleRuntimeMessage);
