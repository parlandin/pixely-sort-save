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
let lastClickPosition = { x: null, y: null };

// ============================================================================
// CONTEXT MENU MANAGEMENT
// ============================================================================
async function createLocalSaveContextMenus(suffixes) {
  await removeLocalSaveContextMenus();

  const isFirefox = DetectBrowser.isFirefox();

  const icons = {
    16: "../icons/folder.png",
    32: "../icons/folder.png",
    48: "../icons/folder.png",
    128: "../icons/folder.png",
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
  browser.contextMenus.create({
    id: CONTEXT_MENU_IDS.DROPBOX_SAVE,
    title: "Salvar no Dropbox",
    contexts: ["image"],
    icons: {
      16: "../icons/dropbox.png",
      32: "../icons/dropbox.png",
      48: "../icons/dropbox.png",
      128: "../icons/dropbox.png",
    },
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
// BLOB HANDLING
// ============================================================================
function isBlobUrl(url) {
  return url && url.startsWith("blob:");
}

async function downloadBlobUrl(blobUrl, tabId) {
  try {
    // Enviar mensagem para o content script fazer o fetch
    const response = await browser.tabs.sendMessage(tabId, {
      action: "FETCH_BLOB_DATA",
      blobUrl: blobUrl,
    });

    if (response.success) {
      return {
        arrayBuffer: response.arrayBuffer,
        mimeType: response.mimeType,
        extension: response.extension,
      };
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error("Erro ao processar blob URL:", error);
    throw error;
  }
}

async function CreateBlobUrl(arrayBuffer, mimeType) {
  let bufferToUse;
  if (Array.isArray(arrayBuffer)) {
    bufferToUse = new Uint8Array(arrayBuffer);
  } else {
    bufferToUse = arrayBuffer;
  }

  const blob = new Blob([bufferToUse], { type: mimeType });
  const downloadUrl = URL.createObjectURL(blob);

  console.log("Blob URL created:", downloadUrl);

  return downloadUrl;
}

async function resolveImagemInput(info, tab) {
  if (!info?.mediaType || info.mediaType !== "image") {
    const response = await browser.tabs.sendMessage(tab.id, {
      action: "download-image",
      position: lastClickPosition,
    });

    console.log({ response });

    if (response && response.url) {
      const { url: imageUrl, type } = response;
      if (type === "blob") {
        const blobData = await downloadBlobUrl(imageUrl, tab.id);
        const url = await CreateBlobUrl(
          blobData.arrayBuffer,
          blobData.mimeType
        );

        return {
          url: url,
          fileExtension: blobData.extension,
        };
      } else {
        const url = imageUrl;

        return {
          url: url,
          fileExtension: getFileExtension(url),
        };
      }
    }
  }

  if (!info.srcUrl) {
    return null;
  }

  const isBlob = isBlobUrl(info.srcUrl);

  if (isBlob) {
    const blobData = await downloadBlobUrl(info.srcUrl, tab.id);
    const url = await CreateBlobUrl(blobData.arrayBuffer, blobData.mimeType);

    return {
      url: url,
      fileExtension: blobData.extension,
    };
  }

  return {
    url: info.srcUrl,
    fileExtension: getFileExtension(info.srcUrl),
  };
}

// ============================================================================
// IMAGE DOWNLOAD (UPDATED)
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
  fileExtension = null,
  tabId = null
) {
  if (!imageUrl) {
    console.error("URL not provided for download");
    return;
  }

  try {
    let downloadUrl = imageUrl;

    // Handle data URLs by converting to blob URLs
    if (downloadUrl.startsWith("data:")) {
      try {
        const response = await fetch(downloadUrl);
        const blob = await response.blob();
        downloadUrl = URL.createObjectURL(blob);
      } catch (fetchError) {
        console.error("Error converting data URL to blob URL:", fetchError);
        await browser.tabs.sendMessage(tabId, {
          action: MESSAGE_ACTIONS.SHOW_ERROR_TOAST,
          message: "Erro ao processar a imagem. Tente novamente.",
        });
        return;
      }
    }

    const filename = buildDownloadFilename(folderSuffix, fileExtension);

    await browser.downloads.download({
      url: downloadUrl,
      filename: filename,
      conflictAction: "uniquify",
      saveAs: false,
    });

    // Clean up any blob URLs we created
    if (
      (isBlobUrl(downloadUrl) || downloadUrl.startsWith("blob:")) &&
      downloadUrl !== imageUrl
    ) {
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    }

    await sendSuccessNotification(tabId, "Imagem salva com sucesso!");
  } catch (error) {
    console.error("Erro ao baixar imagem:", error);

    // Send error notification to user
    if (tabId) {
      try {
        await browser.tabs.sendMessage(tabId, {
          action: MESSAGE_ACTIONS.SHOW_ERROR_TOAST,
          message: "Erro ao salvar imagem. Tente novamente.",
        });
      } catch (msgError) {
        console.error("Erro ao enviar mensagem de erro:", msgError);
      }
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

async function handleContextMenuClick(info, tab) {
  const menuItemId = info.menuItemId;

  if (menuItemId.startsWith(CONTEXT_MENU_IDS.LOCAL_SAVE_PREFIX)) {
    const folderSuffix = menuItemId.replace(
      CONTEXT_MENU_IDS.LOCAL_SAVE_PREFIX,
      ""
    );

    const resolvedImage = await resolveImagemInput(info, tab);
    if (!resolvedImage || !resolvedImage.url) {
      console.error("Failed to resolve image input.");
      return;
    }

    console.log({ resolvedImage });

    const { url, fileExtension } = resolvedImage;
    downloadImageToLocal(url, folderSuffix, fileExtension, tab?.id);
    return;
  }

  if (menuItemId === CONTEXT_MENU_IDS.DROPBOX_SAVE) {
    const resolvedImage = await resolveImagemInput(info, tab);
    if (!resolvedImage || !resolvedImage.url) {
      console.error("Failed to resolve image input for Dropbox.");
      return;
    }

    saveImageToDropbox(resolvedImage.url, tab?.id);
    return;
  }
}

async function handleDoubleClickDownload(imageUrl, tabId) {
  const { doubleClickEnabled } = await browser.storage.local.get(
    "doubleClickEnabled"
  );

  if (doubleClickEnabled) {
    const resolvedImage = await resolveImagemInput(
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

    case "context-menu-position":
      lastClickPosition = {
        x: message.x,
        y: message.y,
      };
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
