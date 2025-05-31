const DetectBrowser = {
  isFirefox: () =>
    typeof browser !== "undefined" && typeof InstallTrigger !== "undefined",
  isChrome: () =>
    typeof chrome !== "undefined" && typeof browser === "undefined",
  isEdge: () => navigator.userAgent.includes("Edg"),
  isBrave: async () => {
    return (navigator.brave && (await navigator.brave.isBrave())) === true;
  },
  isOpera: () => navigator.userAgent.includes("OPR"),
};

if (!DetectBrowser.isFirefox()) {
  importScripts(
    "../lib/browser-polyfill.min.js",
    "./utils.js",
    "./download.js",
    "./dropbox.js"
  );
}

/* browser = DetectBrowser.isFirefox() ? browser : chrome; */

// ============================================================================
// CONSTANTS
// ============================================================================
const DEFAULT_SUFFIXES = ["picture", "wallpapers", "uncategorized", "direct"];
const DEFAULT_SETTINGS = {
  suffixes: DEFAULT_SUFFIXES,
  doubleClickEnabled: true,
  defaultFormat: "jpg",
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
  SHOW_LOADING_TOAST: "showLoadingToast",
  DELETE_OBJECT_URL: "deleteObjectURL",
};

let doubleClickNotificationShown = false;

// ============================================================================
// CONTEXT MENU MANAGEMENT
// ============================================================================
async function createLocalSaveContextMenus(suffixes) {
  await removeLocalSaveContextMenus();

  const isFirefox = DetectBrowser.isFirefox();

  const icons = {
    16: "../icons/folder.png",
    48: "../icons/folder.png",
  };

  const menuCreateOptions = {
    documentUrlPatterns: ["https://*/*", "http://*/*"],
    contexts: ["frame", "image", "page"],
  };

  if (isFirefox) {
    menuCreateOptions.icons = icons;
  }

  browser.contextMenus.create({
    id: CONTEXT_MENU_IDS.LOCAL_SAVE_PARENT,
    title: "Salvar imagem (local)",
    ...menuCreateOptions,
  });

  suffixes.forEach((suffix) => {
    browser.contextMenus.create({
      id: `${CONTEXT_MENU_IDS.LOCAL_SAVE_PREFIX}${suffix}`,
      parentId: CONTEXT_MENU_IDS.LOCAL_SAVE_PARENT,
      title: suffix,
      ...menuCreateOptions,
    });
  });
}

function createDropboxSaveContextMenu() {
  const isFirefox = DetectBrowser.isFirefox();

  const icons = {
    16: "../icons/dropbox.png",
    48: "../icons/dropbox.png",
  };

  const menuCreateOptions = {
    documentUrlPatterns: ["https://*/*", "http://*/*"],
    contexts: ["frame", "image", "page"],
  };

  if (isFirefox) {
    menuCreateOptions.icons = icons;
  }

  browser.contextMenus.create({
    id: CONTEXT_MENU_IDS.DROPBOX_SAVE,
    title: "Salvar no Dropbox",
    ...menuCreateOptions,
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
      await createLocalSaveContextMenus(settings.suffixes);
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

  if (Object.keys(updatedSettings).length === 0) {
    return;
  }

  await updateContextMenusBasedOnSettings(updatedSettings);
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================
async function revokeObjectURL(url, tabId) {
  browser.tabs.sendMessage(tabId, {
    action: MESSAGE_ACTIONS.DELETE_OBJECT_URL,
    message: { url },
  });
}

async function handleSaveLocalImage(info, tab) {
  const menuItemId = info.menuItemId;

  const folderSuffix = menuItemId.replace(
    CONTEXT_MENU_IDS.LOCAL_SAVE_PREFIX,
    ""
  );

  const isFirefox = DetectBrowser.isFirefox();
  const resolvedImage = await resolveImageInput(info, tab, isFirefox);

  if (!resolvedImage || !resolvedImage.url) {
    console.error("Failed to resolve image input.");
    return;
  }

  const { url, fileExtension, type } = resolvedImage;
  await downloadImageToLocal(url, folderSuffix, fileExtension, tab?.id);
  if (type == "blob" || type == "data") {
    await revokeObjectURL(url, tab?.id);
  }
  return;
}

async function handleSaveDropboxImage(info, tab) {
  const isFirefox = DetectBrowser.isFirefox();
  const resolvedImage = await resolveImageInput(info, tab, isFirefox);

  if (!resolvedImage || !resolvedImage.url) {
    console.error("Failed to resolve image input for Dropbox.");
    return;
  }

  await saveImageToDropbox(resolvedImage.url, tab?.id);
  if (resolvedImage.type === "blob" || resolvedImage.type === "data") {
    await revokeObjectURL(resolvedImage.url, tab?.id);
  }
  return;
}

async function handleContextMenuClick(info, tab) {
  const menuItemId = info.menuItemId;

  if (menuItemId.startsWith(CONTEXT_MENU_IDS.LOCAL_SAVE_PREFIX)) {
    await handleSaveLocalImage(info, tab);
    return;
  }

  if (menuItemId === CONTEXT_MENU_IDS.DROPBOX_SAVE) {
    await handleSaveDropboxImage(info, tab);
    return;
  }
}

async function handleDoubleClickDownload(imageUrl, tabId) {
  const { doubleClickEnabled } = await browser.storage.local.get(
    "doubleClickEnabled"
  );

  if (doubleClickEnabled) {
    const resolvedImage = await resolveImageInput(
      { srcUrl: imageUrl, mediaType: "image" },
      tabId
    );
    await downloadImageToLocal(
      resolvedImage.url,
      "direct",
      resolvedImage.fileExtension,
      tabId
    );
  } else {
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

    case "checkDoubleClickNotification":
      return Promise.resolve({ alreadyShown: doubleClickNotificationShown });

    case "markDoubleClickNotificationShown":
      doubleClickNotificationShown = true;
      return Promise.resolve({ success: true });

    case "clearDoubleClickNotification":
      doubleClickNotificationShown = false;
      return Promise.resolve({ success: true });

    default:
      return false;
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
