// ============================================================================
// CONSTANTS
// ============================================================================
const MESSAGE_ACTIONS = {
  DOWNLOAD_IMAGE: "downloadImage",
  SHOW_SUCCESS_TOAST: "showDownloadSuccessToast",
  SHOW_ERROR_TOAST: "showDownloadErrorToast",
  FETCH_BLOB_DATA: "FETCH_BLOB_DATA",
  FETCH_DATA_URL: "FETCH_DATA_URL",
  DOWNLOAD_IMAGE_AT_POSITION: "download-image",
  CONTEXT_MENU_POSITION: "context-menu-position",
  SHOW_LOADING_TOAST: "showLoadingToast",
};

const TOAST_TYPES = {
  SUCCESS: "success",
  ERROR: "error",
  INFO: "info",
  WARNING: "warning",
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
    info: "#2196F3",
    warning: "#FF9800",
  },
};

const IMAGE_EXTENSIONS = {
  "image/jpeg": "jpeg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
};

// ============================================================================
// IMAGE VALIDATION UTILITIES
// ============================================================================
function isImageElement(element) {
  return element && element.tagName === "IMG";
}

function hasValidImageUrl(element) {
  return element.src && element.src.trim() !== "";
}

function hasValidBlobUrl(element) {
  return element.src && element.src.startsWith("blob:");
}

function isBlobUrl(url) {
  return url && url.startsWith("blob:");
}

// ============================================================================
// STORAGE UTILITIES
// ============================================================================
async function isDoubleClickEnabled() {
  try {
    const data = await browser.storage.local.get("doubleClickEnabled");
    return data.doubleClickEnabled;
  } catch (error) {
    console.error("Error checking double click setting:", error);
    return false;
  }
}

// ============================================================================
// MESSAGE SENDING UTILITIES
// ============================================================================
function sendDownloadMessage(imageUrl) {
  browser.runtime.sendMessage({
    action: MESSAGE_ACTIONS.DOWNLOAD_IMAGE,
    url: imageUrl,
  });
}

function sendContextMenuPosition(x, y) {
  browser.runtime.sendMessage({
    action: MESSAGE_ACTIONS.CONTEXT_MENU_POSITION,
    x: x,
    y: y,
  });
}

// ============================================================================
// DOUBLE CLICK HANDLING
// ============================================================================
async function handleImageDoubleClick(imageUrl) {
  const isEnabled = await isDoubleClickEnabled();

  if (isEnabled) {
    sendDownloadMessage(imageUrl);
  } else {
    const errorMessage =
      "Download por duplo clique desativado. Acesse as configurações.";

    showToast(errorMessage, TOAST_TYPES.ERROR);
  }
}

function handleDoubleClickEvent(event) {
  if (isImageElement(event.target) || hasValidImageUrl(event.target)) {
    return handleImageDoubleClick(event.target.src);
  }

  const imageElement = findImageUnderPointer(event.pageX, event.pageY, 7);

  if (!imageElement) {
    showToast("Nenhuma imagem encontrada", TOAST_TYPES.ERROR);
    return;
  }
  const imageUrl = imageElement.url;
  if (!imageUrl) {
    showToast("URL da imagem inválida", TOAST_TYPES.ERROR);
    return;
  }

  handleImageDoubleClick(imageUrl);
}

// ============================================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================================
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

  const backgroundColor = getToastBackgroundColor(type);
  toast.style.cssText = `
    ${TOAST_CONFIG.STYLES.base}
    background-color: ${backgroundColor};
  `;

  return toast;
}

function getToastBackgroundColor(type) {
  return TOAST_CONFIG.STYLES[type] || TOAST_CONFIG.STYLES.success;
}

function animateToastIn(toast) {
  void toast.offsetWidth;
  toast.style.opacity = "1";
}

function animateToastOut(toast) {
  toast.style.opacity = "0";
  toast.addEventListener("transitionend", () => toast.remove(), { once: true });
}

function scheduleToastRemoval(toast) {
  setTimeout(() => {
    animateToastOut(toast);
  }, TOAST_CONFIG.DURATION);
}

function showToast(message, type = TOAST_TYPES.SUCCESS) {
  removeExistingToast();

  const toast = createToastElement(message, type);
  document.body.appendChild(toast);

  animateToastIn(toast);
  scheduleToastRemoval(toast);
}

// ============================================================================
// BLOB DATA PROCESSING
// ============================================================================
async function fetchBlobResponse(blobUrl) {
  try {
    const response = await fetch(blobUrl);
    return await response.blob();
  } catch (error) {
    console.error("Error fetching blob response:", error);
    throw error;
  }
}

function getBlobMimeType(blob) {
  return blob.type || "image/jpeg";
}

async function getFileExtensionFromMimeType(mimeType) {
  if (!mimeType || typeof mimeType !== "string") {
    const local = await browser.storage.local.get("defaultFormat");
    if (local.defaultFormat) {
      return local.defaultFormat;
    }
    return "jpg";
  }
  return IMAGE_EXTENSIONS[mimeType] || "jpg";
}

async function convertBlobToArrayBuffer(blob) {
  return await blob.arrayBuffer();
}

function createBlobDataResponse(arrayBuffer, mimeType, extension) {
  return {
    arrayBuffer: Array.from(new Uint8Array(arrayBuffer)),
    mimeType: mimeType,
    extension: extension,
  };
}

async function fetchBlobData(blobUrl) {
  try {
    const blob = await fetchBlobResponse(blobUrl);

    const mimeType = getBlobMimeType(blob);
    const extension = await getFileExtensionFromMimeType(mimeType);
    const arrayBuffer = await convertBlobToArrayBuffer(blob);

    return createBlobDataResponse(arrayBuffer, mimeType, extension);
  } catch (error) {
    console.error("Erro ao processar blob no content script:", error);
    throw error;
  }
}

// ============================================================================
// DATA URL UTILITIES
// ============================================================================
async function fetchDataURL(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("Error fetching data URL:", error);
    throw error;
  }
}

// ============================================================================
// IMAGE SEARCH UTILITIES
// ============================================================================
function getBackgroundImageUrl(element) {
  const computedStyle = window.getComputedStyle(element);
  const backgroundImage = computedStyle.backgroundImage;

  if (!backgroundImage || backgroundImage === "none") {
    return null;
  }

  const urlMatch = backgroundImage.match(/url\(["']?(.*?)["']?\)/);
  return urlMatch ? urlMatch[1] : null;
}

function findChildImageElement(element) {
  const childImg = element.querySelector("img");

  if (!childImg) return null;
  if (!hasValidImageUrl(childImg) && !hasValidBlobUrl(childImg)) return null;

  return { type: "img", element: childImg, url: childImg.src };
}

function checkCurrentElementAsImage(element) {
  if (!isImageElement(element)) return null;
  if (!hasValidImageUrl(element) && !hasValidBlobUrl(element)) return null;

  return { type: "img", element: element, url: element.src };
}

function checkElementBackgroundImage(element) {
  const bgUrl = getBackgroundImageUrl(element);

  if (!bgUrl) return null;

  return { type: "background", element: element, url: bgUrl };
}

function searchElementForImage(element) {
  const imageResult = checkCurrentElementAsImage(element);
  if (imageResult) return imageResult;

  const childImageResult = findChildImageElement(element);
  if (childImageResult) return childImageResult;

  const backgroundResult = checkElementBackgroundImage(element);
  if (backgroundResult) return backgroundResult;

  return null;
}

function searchForImageOrBackground(element, maxLevels) {
  let current = element;
  let level = 0;

  while (current && level <= maxLevels) {
    const imageResult = searchElementForImage(current);
    if (imageResult) return imageResult;

    current = current.parentElement;
    level++;
  }

  return null;
}

function findImageUnderPointer(x, y, maxLevels = 5) {
  const element = document.elementFromPoint(x, y);

  if (!element) return null;

  return searchForImageOrBackground(element, maxLevels);
}

// ============================================================================
// BLOB RESOLUTION
// ============================================================================
async function createBlobResolveResponse(blobData) {
  return {
    success: true,
    arrayBuffer: blobData.arrayBuffer,
    mimeType: blobData.mimeType,
    extension: blobData.extension,
  };
}

function createBlobErrorResponse(error) {
  return {
    success: false,
    error: error.message,
  };
}

async function resolveBlobUrl(blobUrl) {
  try {
    const blobData = await fetchBlobData(blobUrl);
    return createBlobResolveResponse(blobData);
  } catch (error) {
    console.error("Erro ao processar blob:", error);
    return createBlobErrorResponse(error);
  }
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================
function handleToastMessage(message) {
  const { action, message: toastMessage } = message;

  switch (action) {
    case MESSAGE_ACTIONS.SHOW_SUCCESS_TOAST:
      showToast(toastMessage, TOAST_TYPES.SUCCESS);
      break;

    case MESSAGE_ACTIONS.SHOW_ERROR_TOAST:
      showToast(toastMessage, TOAST_TYPES.ERROR);
      break;

    case MESSAGE_ACTIONS.SHOW_LOADING_TOAST:
      showToast(toastMessage, TOAST_TYPES.INFO);
      break;

    default:
      return;
  }
}

async function handleFetchBlobDataMessage(message) {
  try {
    const blobData = await fetchBlobData(message.blobUrl);

    return {
      success: true,
      arrayBuffer: blobData.arrayBuffer,
      mimeType: blobData.mimeType,
      extension: blobData.extension,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleFetchDataUrlMessage(message) {
  try {
    const dataUrl = await fetchDataURL(message.url);

    return { success: true, dataUrl: dataUrl };
  } catch (error) {
    console.error("Error fetching Data URL:", error);
    return { success: false, error: error.message };
  }
}

function createImageDownloadResponse(url, type, blobData = null) {
  const response = { url, type };
  if (blobData) {
    response.blobData = blobData;
  }
  return response;
}

async function handleDownloadImageMessage(message) {
  const { x, y } = message.position;

  const imageElement = findImageUnderPointer(x, y, 7);

  if (!imageElement) {
    showToast("Nenhuma imagem encontrada", TOAST_TYPES.ERROR);
    return null;
  }

  const { url } = imageElement;

  if (isBlobUrl(url)) {
    const blobData = await resolveBlobUrl(url);
    return createImageDownloadResponse(url, "blob", blobData);
  }

  return createImageDownloadResponse(url, "image");
}

function isToastMessage(action) {
  return (
    action === MESSAGE_ACTIONS.SHOW_SUCCESS_TOAST ||
    action === MESSAGE_ACTIONS.SHOW_ERROR_TOAST ||
    action === MESSAGE_ACTIONS.SHOW_LOADING_TOAST
  );
}

// ============================================================================
// MAIN MESSAGE LISTENER
// ============================================================================
function handleRuntimeMessage(message, sender, sendResponse) {
  const { action } = message;

  if (isToastMessage(action)) {
    handleToastMessage(message);
    return;
  }

  switch (action) {
    case MESSAGE_ACTIONS.FETCH_BLOB_DATA:
      return handleFetchBlobDataMessage(message);

    case MESSAGE_ACTIONS.FETCH_DATA_URL:
      return handleFetchDataUrlMessage(message);

    case MESSAGE_ACTIONS.DOWNLOAD_IMAGE_AT_POSITION:
      return handleDownloadImageMessage(message);

    default:
      return undefined;
  }
}

// ============================================================================
// MOUSE POSITION TRACKING
// ============================================================================
let mousePosition = { x: 0, y: 0 };

function updateMousePosition(event) {
  mousePosition.x = event.pageX;
  mousePosition.y = event.pageY;
}

function handleContextMenu(event) {
  updateMousePosition(event);

  sendContextMenuPosition(mousePosition.x, mousePosition.y);
}

// ============================================================================
// EVENT LISTENERS SETUP
// ============================================================================
function setupEventListeners() {
  document.addEventListener("dblclick", handleDoubleClickEvent);
  document.addEventListener("contextmenu", handleContextMenu);
  browser.runtime.onMessage.addListener(handleRuntimeMessage);
}

// ============================================================================
// INITIALIZATION
// ============================================================================
setupEventListeners();
