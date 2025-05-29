let lastClickPosition = { x: null, y: null };

function isBlobUrl(url) {
  return url && url.startsWith("blob:");
}

async function downloadBlobUrl(blobUrl, tabId) {
  try {
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

  return downloadUrl;
}

async function resolveImageInput(info, tab) {
  if (!info?.mediaType || info.mediaType !== "image") {
    const response = await browser.tabs.sendMessage(tab.id, {
      action: "download-image",
      position: lastClickPosition,
    });

    if (response?.url) {
      return await processImageUrl(response.url, response.type, tab.id, tab);
    }
  }

  if (!info.srcUrl) {
    return null;
  }

  const urlType = getImageUrlType(info.srcUrl);
  return await processImageUrl(info.srcUrl, urlType, tab.id, tab);
}

function getImageUrlType(url) {
  if (!url) return null;

  if (url.startsWith("data:")) return "data";
  if (url.startsWith("blob:")) return "blob";
  if (url.startsWith("http://") || url.startsWith("https://")) return "http";
  if (url.startsWith("/")) return "relative";

  return "unknown";
}

async function processImageUrl(imageUrl, type, tabId, tab) {
  if (!type || type === "url") {
    type = getImageUrlType(imageUrl);
  }

  switch (type) {
    case "blob":
      const blobData = await downloadBlobUrl(imageUrl, tabId);
      const blobUrl = await CreateBlobUrl(
        blobData.arrayBuffer,
        blobData.mimeType
      );
      return {
        url: blobUrl,
        fileExtension: blobData.extension,
      };

    case "data":
      const response = await browser.tabs.sendMessage(tabId, {
        action: "FETCH_DATA_URL",
        url: imageUrl,
      });

      if (response.success) {
        const dataUrl = response.dataUrl;
        return {
          url: dataUrl,
          fileExtension: await getFileExtension(dataUrl),
        };
      }

    case "relative":
      const absoluteUrl = new URL(imageUrl, tab.url).href;
      return {
        url: absoluteUrl,
        fileExtension: await getFileExtension(absoluteUrl),
      };

    case "http":
    default:
      return {
        url: imageUrl,
        fileExtension: await getFileExtension(imageUrl),
      };
  }
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

  const tabExists = await browser.tabs.get(tabId).catch(() => null);

  if (!tabExists) return;

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

    const filename = buildDownloadFilename(folderSuffix, fileExtension);

    await browser.downloads.download({
      url: downloadUrl,
      filename: filename,
      conflictAction: "uniquify",
      saveAs: false,
    });

    // Clean up any blob URLs we created
    /* if (
      (isBlobUrl(downloadUrl) || downloadUrl.startsWith("blob:")) &&
      downloadUrl !== imageUrl
    ) {
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } */

    await sendSuccessNotification(tabId, "Imagem encontrada, salvando...");
  } catch (error) {
    console.error("Erro ao baixar imagem:", error);

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

browser.runtime.onMessage.addListener((message) => {
  if (message.action == "context-menu-position") {
    lastClickPosition = {
      x: message.x,
      y: message.y,
    };
    return;
  }
});
