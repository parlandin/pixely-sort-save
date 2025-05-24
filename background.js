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

function createContextMenus(suffixes) {
  browser.contextMenus.removeAll().then(() => {
    browser.contextMenus.create({
      id: "quick-save-parent",
      title: "Salvar imagem (aleatório)",
      contexts: ["image"],
    });

    suffixes.forEach((suffix) => {
      browser.contextMenus.create({
        id: `quick-save-${suffix}`,
        parentId: "quick-save-parent",
        title: suffix,
        contexts: ["image"],
      });
    });
  });
}

browser.runtime.onInstalled.addListener(() => {
  browser.storage.local
    .get({ suffixes: ["picture", "wallpapers", "uncategorized", "direct"] })
    .then((data) => createContextMenus(data.suffixes));
});

browser.runtime.onStartup.addListener(() => {
  browser.storage.local
    .get({ suffixes: ["picture", "wallpapers", "uncategorized", "direct"] })
    .then((data) => createContextMenus(data.suffixes));
});

browser.storage.onChanged.addListener((changes) => {
  if (changes.suffixes) {
    createContextMenus(changes.suffixes.newValue);
  }
});

browser.contextMenus.onClicked.addListener((info) => {
  const clickedId = info.menuItemId;
  if (clickedId.startsWith("quick-save-")) {
    const suffix = clickedId.replace("quick-save-", "");

    const url = info.srcUrl;
    const ext = getFileExtension(url);

    if (!url) {
      console.error("URL not found");
      return;
    }

    let filename;

    if (suffix == "direct") {
      filename = `images/${generateRandomName(10)}.${ext}`;
    } else {
      filename = `images/${suffix}/${generateRandomName(10)}.${ext}`;
    }

    browser.downloads.download({
      url: url,
      filename: filename,
      conflictAction: "uniquify",
      saveAs: false,
    });
  }
});
