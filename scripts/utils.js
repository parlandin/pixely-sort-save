function generateRandomName(length = 10) {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

async function getFileExtension(url) {
  const match = url.match(/\.(\w+)(?=($|\?|#))/);

  if (!match) {
    const local = await browser.storage.local.get("defaultFormat");

    if (local.defaultFormat) {
      return local.defaultFormat;
    }

    return "jpg";
  }
  return match[1];
}

function isBlobUrl(url) {
  return url && url.startsWith("blob:");
}
