const DROPBOX_API_UPLOAD_URL = "https://content.dropboxapi.com/2/files/upload";

const DROPBOX_MESSAGES = {
  SUCCESS: "Imagem salva no Dropbox!",
  TOKEN_MISSING: "Token de acesso do Dropbox não configurado.",
  URL_MISSING: "URL da imagem não fornecida para o Dropbox.",
  PATH_INVALID: "Formato de caminho inválido. Use /pasta ou /pasta/subpasta",
};

function validateImageUrl(imageUrl) {
  if (!imageUrl) {
    throw new Error(DROPBOX_MESSAGES.URL_MISSING);
  }
}

function normalizeFolderPath(path) {
  if (!path) return "";
  if (path === "/") return "";

  if (!path.startsWith("/")) {
    path = "/" + path;
  }

  path = path.replace(/\/$/, "");

  const pathRegex = /^(\/[a-zA-Z0-9_-]+)+$/;
  if (!pathRegex.test(path)) {
    throw new Error(DROPBOX_MESSAGES.PATH_INVALID);
  }

  return path;
}

async function fetchImageBlob(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Falha ao obter imagem: ${response.statusText}`);
  }
  return response.blob();
}

function buildDropboxUploadHeaders(dropboxToken, dropboxPath) {
  return {
    Authorization: `Bearer ${dropboxToken}`,
    "Content-Type": "application/octet-stream",
    "Dropbox-API-Arg": JSON.stringify({
      path: dropboxPath,
      mode: "add",
      autorename: true,
      mute: false,
    }),
  };
}

async function uploadToDropbox(imageBlob, dropboxPath, dropboxToken) {
  const headers = buildDropboxUploadHeaders(dropboxToken, dropboxPath);

  const uploadResponse = await fetch(DROPBOX_API_UPLOAD_URL, {
    method: "POST",
    headers: headers,
    body: imageBlob,
  });

  if (!uploadResponse.ok) {
    const errorData = await uploadResponse
      .json()
      .catch(() => ({ message: uploadResponse.statusText }));
    throw new Error(
      `Falha no upload para o Dropbox: ${
        errorData.error_summary || JSON.stringify(errorData)
      }`
    );
  }

  return uploadResponse.json();
}

async function sendDropboxToastMessage(tabId, isError, message) {
  if (!tabId) return;

  try {
    await browser.tabs.sendMessage(tabId, {
      action: isError
        ? MESSAGE_ACTIONS.SHOW_ERROR_TOAST
        : MESSAGE_ACTIONS.SHOW_SUCCESS_TOAST,
      message: message,
    });
  } catch (error) {
    console.error("Erro ao enviar mensagem de toast do Dropbox:", error);
  }
}

async function getDropboxSettings() {
  return await browser.storage.local.get(["dropboxToken", "dropboxFolderPath"]);
}

function validateDropboxToken(token) {
  if (!token) {
    throw new Error(DROPBOX_MESSAGES.TOKEN_MISSING);
  }
}

async function buildDropboxFilename(imageUrl) {
  const randomName = generateRandomName(15);
  const fileExtension = await getFileExtension(imageUrl);
  return `${randomName}.${fileExtension}`;
}

function buildDropboxPath(folderPath, filename) {
  return `${folderPath}/${filename}`;
}

async function processDropboxUpload(imageUrl, folderPath, dropboxToken) {
  validateImageUrl(imageUrl);

  const imageBlob = await fetchImageBlob(imageUrl);
  const filename = await buildDropboxFilename(imageUrl);
  const dropboxPath = buildDropboxPath(folderPath, filename);

  const result = await uploadToDropbox(imageBlob, dropboxPath, dropboxToken);

  return result;
}

async function saveImageToDropbox(imageUrl, tabId = null) {
  let message = DROPBOX_MESSAGES.SUCCESS;
  let isError = false;

  try {
    const data = await getDropboxSettings();

    validateDropboxToken(data.dropboxToken);

    const folder = data.dropboxFolderPath || "";
    const folderPath = normalizeFolderPath(folder);

    await processDropboxUpload(imageUrl, folderPath, data.dropboxToken);
  } catch (error) {
    console.error("Erro ao salvar no Dropbox:", error);
    message = `Erro ao salvar no Dropbox: ${error.message}`;
    isError = true;
  } finally {
    await sendDropboxToastMessage(tabId, isError, message);
  }
}
