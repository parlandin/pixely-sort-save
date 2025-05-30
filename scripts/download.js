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
        url: response.url,
        extension: response.extension,
        mimeType: response.mimeType,
        arrayBuffer: response.arrayBuffer,
      };
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error("Erro ao processar blob URL:", error);
    throw error;
  }
}

async function downloadDataUrl(imageUrl, type, tabId) {
  const response = await browser.tabs.sendMessage(tabId, {
    action: "FETCH_DATA_URL",
    url: imageUrl,
    type: type,
  });

  if (response.success) {
    const dataUrl = response.dataUrl;
    return {
      url: dataUrl,
      fileExtension: await getFileExtension(dataUrl),
      type: type,
    };
  }
  throw new Error("Failed to fetch data URL");
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

async function resolveImageInput(info, tab, isFirefox) {
  if (!info?.mediaType || info.mediaType !== "image") {
    const response = await browser.tabs.sendMessage(tab.id, {
      action: "download-image",
      position: lastClickPosition,
    });

    if (response?.url) {
      return await processImageUrl(
        response.url,
        response.type,
        tab.id,
        tab,
        isFirefox
      );
    }
  }

  if (!info.srcUrl) {
    return null;
  }

  const urlType = getImageUrlType(info.srcUrl);
  return await processImageUrl(info.srcUrl, urlType, tab.id, tab, isFirefox);
}

function getImageUrlType(url) {
  if (!url) return null;

  if (url.startsWith("data:")) return "data";
  if (url.startsWith("blob:")) return "blob";
  if (url.startsWith("http://") || url.startsWith("https://")) return "http";
  if (url.startsWith("/")) return "relative";

  return "unknown";
}

async function getUrlToFirefox(imageUrl, type, tabId) {
  const blobData = await downloadBlobUrl(imageUrl, tabId);
  const blobUrl = await CreateBlobUrl(blobData.arrayBuffer, blobData.mimeType);

  if (!blobUrl) {
    throw new Error("Failed to create blob URL");
  }
  return {
    url: blobUrl,
    fileExtension: blobData.extension,
    type: type,
  };
}

async function processImageUrl(imageUrl, type, tabId, tab, isFirefox = false) {
  if (!type || type === "url") {
    type = getImageUrlType(imageUrl);
  }

  switch (type) {
    case "blob":
      if (isFirefox) {
        const blobData = await getUrlToFirefox(imageUrl, type, tabId);
        return blobData;
      }

      const dataResponse = await downloadDataUrl(imageUrl, type, tabId);
      return dataResponse;

    case "data":
      if (isFirefox) {
        const blobData = await getUrlToFirefox(imageUrl, type, tabId);
        return blobData;
      }

      const response = await downloadDataUrl(imageUrl, type, tabId);
      return response;

    case "relative":
      const absoluteUrl = new URL(imageUrl, tab.url).href;
      return {
        url: absoluteUrl,
        fileExtension: await getFileExtension(absoluteUrl),
        type: type,
      };

    case "http":
    default:
      return {
        url: imageUrl,
        fileExtension: await getFileExtension(imageUrl),
        type: type,
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
