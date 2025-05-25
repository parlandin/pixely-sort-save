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
