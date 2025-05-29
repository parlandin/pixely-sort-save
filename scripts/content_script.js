const MESSAGE_ACTIONS = {
  DOWNLOAD_IMAGE: "downloadImage",
  SHOW_SUCCESS_TOAST: "showDownloadSuccessToast",
  SHOW_ERROR_TOAST: "showDownloadErrorToast",
};

const TOAST_TYPES = {
  SUCCESS: "success",
  ERROR: "error",
};

const TOAST_CONFIG = {
  ID: "quick-save-toast",
  DURATION: 4000,
  STYLES: {
    base: `
      position: fixed;
      top: 20px;
      right: 20px;
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      z-index: 99999999;
      font-family: sans-serif;
      font-size: 16px;
      opacity: 0;
      transition: opacity 0.5s ease-in-out;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    `,
    success: "#4CAF50",
    error: "#f44336",
  },
};

function isImageElement(element) {
  return element.tagName === "IMG";
}

function hasValidImageUrl(element) {
  return element.src && element.src.trim() !== "";
}

function hasValidBlobUrl(element) {
  return element.src && element.src.startsWith("blob:");
}

async function checkDoubleClickEnabled() {
  const data = await browser.storage.local.get("doubleClickEnabled");
  return data.doubleClickEnabled;
}

function sendDownloadMessage(imageUrl) {
  browser.runtime.sendMessage({
    action: MESSAGE_ACTIONS.DOWNLOAD_IMAGE,
    url: imageUrl,
  });
}

async function handleImageDoubleClick(imageUrl) {
  const isEnabled = await checkDoubleClickEnabled();

  if (isEnabled) {
    sendDownloadMessage(imageUrl);
  } else {
    console.log(
      "Download por duplo clique desativado. Verifique as configurações."
    );
    showToast(
      "Download por duplo clique desativado. Acesse as configurações.",
      TOAST_TYPES.ERROR
    );
  }
}

function handleDoubleClick(event) {
  if (!isImageElement(event.target)) return;

  const imageUrl = event.target.src;
  if (!hasValidImageUrl(event.target)) return;

  handleImageDoubleClick(imageUrl);
}

function handleRuntimeMessage(message) {
  console.log("Handling runtime message:", message);
  const { action, message: toastMessage } = message;

  switch (action) {
    case MESSAGE_ACTIONS.SHOW_SUCCESS_TOAST:
      showToast(toastMessage, TOAST_TYPES.SUCCESS);
      break;

    case MESSAGE_ACTIONS.SHOW_ERROR_TOAST:
      showToast(toastMessage, TOAST_TYPES.ERROR);
      break;

    default:
      console.warn(`Unknown message action: ${action}`);
  }
}

function removeExistingToast() {
  const existingToast = document.getElementById(TOAST_CONFIG.ID);
  if (existingToast) {
    existingToast.remove();
  }
}

function createToastElement(message, type) {
  const toast = document.createElement("div");
  toast.id = TOAST_CONFIG.ID;
  toast.textContent = message;

  const backgroundColor =
    TOAST_CONFIG.STYLES[type] || TOAST_CONFIG.STYLES.success;
  toast.style.cssText = `
    ${TOAST_CONFIG.STYLES.base}
    background-color: ${backgroundColor};
  `;

  return toast;
}

function animateToastIn(toast) {
  void toast.offsetWidth;
  toast.style.opacity = "1";
}

function animateToastOut(toast) {
  toast.style.opacity = "0";
  toast.addEventListener("transitionend", () => toast.remove(), { once: true });
}

function showToast(message, type = TOAST_TYPES.SUCCESS) {
  removeExistingToast();

  const toast = createToastElement(message, type);
  document.body.appendChild(toast);

  animateToastIn(toast);

  setTimeout(() => {
    animateToastOut(toast);
  }, TOAST_CONFIG.DURATION);
}

document.addEventListener("dblclick", handleDoubleClick);
/* browser.runtime.onMessage.addListener(handleRuntimeMessage); */

// ============================================================================
// BLOB HANDLING NO CONTENT SCRIPT
// ============================================================================
async function fetchBlobData(blobUrl) {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();

    console.log("Blob fetched successfully:", blob.type);

    // Obter o tipo MIME do blob
    const mimeType = blob.type || "image/jpeg";

    // Converter para array buffer
    const arrayBuffer = await blob.arrayBuffer();

    // Determinar extensão baseada no MIME type
    const extensionMap = {
      "image/jpeg": "jpeg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/bmp": "bmp",
      "image/svg+xml": "svg",
    };

    const extension = extensionMap[mimeType] || "jpg";

    return {
      arrayBuffer: Array.from(new Uint8Array(arrayBuffer)),
      mimeType: mimeType,
      extension: extension,
    };
  } catch (error) {
    console.error("Erro ao processar blob no content script:", error);
    throw error;
  }
}

async function fetchDataURL(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  const objectURL = URL.createObjectURL(blob);

  return objectURL;
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message in content script:", message);
  // Handle toast messages
  if (
    message.action === MESSAGE_ACTIONS.SHOW_SUCCESS_TOAST ||
    message.action === MESSAGE_ACTIONS.SHOW_ERROR_TOAST
  ) {
    handleRuntimeMessage(message);
    return; // No response needed
  }

  // Handle FETCH_BLOB_DATA
  if (message.action === "FETCH_BLOB_DATA") {
    return fetchBlobData(message.blobUrl)
      .then((blobData) => {
        console.log(
          "Blob data fetched successfully, mimeType:",
          blobData.mimeType
        );
        return {
          success: true,
          arrayBuffer: blobData.arrayBuffer,
          mimeType: blobData.mimeType,
          extension: blobData.extension,
        };
      })
      .catch((error) => {
        return { success: false, error: error.message };
      });
  }

  if (message.action === "FETCH_DATA_URL") {
    return fetchDataURL(message.url)
      .then((dataUrl) => {
        console.log("Data URL fetched successfully:", dataUrl);
        return { success: true, dataUrl: dataUrl };
      })
      .catch((error) => {
        console.error("Error fetching Data URL:", error);
        return { success: false, error: error.message };
      });
  }

  // Handle download-image
  if (message.action === "download-image") {
    const { x, y } = message.position;
    console.log("Download image at position:", x, y);

    const imageElement = findImageUnderPointer(x, y, 7);

    if (imageElement) {
      const { type, url } = imageElement;
      const isBlobUrl = url && url.startsWith("blob:");

      if (isBlobUrl) {
        // For blob URLs, we return a promise that resolves to the response
        return blobResolve(url).then((blobData) => {
          return {
            url: url,
            type: "blob",
            blobData: blobData,
          };
        });
      }

      // For regular URLs, we can return directly
      return Promise.resolve({
        url: url,
        type: "image",
      });
    }

    showToast("Nenhuma imagem encontrada", TOAST_TYPES.ERROR);
    return Promise.resolve(null);
  }

  // Return undefined for any other messages
  return undefined;
});

async function blobResolve(blobUrl) {
  try {
    const blobData = await fetchBlobData(blobUrl);
    return {
      success: true,
      arrayBuffer: blobData.arrayBuffer,
      mimeType: blobData.mimeType,
      extension: blobData.extension,
    };
  } catch (error) {
    console.error("Erro ao processar blob:", error);
    return { success: false, error: error.message };
  }
}

function getBackgroundImageUrl(el) {
  const bg = window.getComputedStyle(el).backgroundImage;
  if (bg && bg !== "none") {
    const urlMatch = bg.match(/url\(["']?(.*?)["']?\)/);
    return urlMatch ? urlMatch[1] : null;
  }
  return null;
}

function findImageUnderPointer(x, y, maxLevels = 5) {
  const el = document.elementFromPoint(x, y);

  console.log("Element under pointer:", el);

  if (!el) return null;

  return searchForImageOrBackground(el, maxLevels);
}

function searchForImageOrBackground(element, maxLevels) {
  let current = element;
  let level = 0;

  while (current && level <= maxLevels) {
    console.log(`Checking element at level ${level}:`, current.class);
    if (current.tagName === "IMG" && hasValidImageUrl(current)) {
      return { type: "img", element: current, url: current.src };
    }

    if (current.tagName === "IMG" && hasValidBlobUrl(current)) {
      return { type: "img", element: current, url: current.src };
    }

    const childImg = current.querySelector("img");
    if (childImg && (hasValidImageUrl(childImg) || hasValidBlobUrl(childImg))) {
      return { type: "img", element: childImg, url: childImg.src };
    }

    const bgUrl = getBackgroundImageUrl(current);
    if (bgUrl) {
      return { type: "background", element: current, url: bgUrl };
    }

    current = current.parentElement;
    level++;
  }

  return null;
}

let mouseX = 0;
let mouseY = 0;

document.addEventListener("contextmenu", (event) => {
  mouseX = event.pageX;
  mouseY = event.pageY;

  console.log("Context menu position:", mouseX, mouseY);

  browser.runtime.sendMessage({
    action: "context-menu-position",
    x: mouseX,
    y: mouseY,
  });
});
