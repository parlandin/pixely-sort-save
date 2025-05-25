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
browser.runtime.onMessage.addListener(handleRuntimeMessage);
