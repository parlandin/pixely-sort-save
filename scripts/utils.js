function generateRandomName(length = 10) {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

function getFileExtension(url) {
  const match = url.match(/\.(\w+)(?=($|\?|#))/);
  return match ? match[1] : "jpg";
}

function isBlobUrl(url) {
  return url && url.startsWith("blob:");
}

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
