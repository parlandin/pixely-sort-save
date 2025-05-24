const suffixList = document.getElementById("suffix-list");
const addButton = document.getElementById("add-suffix");
const newSuffixInput = document.getElementById("new-suffix");

function renderList(suffixes) {
  suffixList.innerHTML = "";
  suffixes.forEach((suffix, index) => {
    const li = document.createElement("li");
    li.textContent = suffix;

    if (suffix !== "direct") {
      const removeButton = document.createElement("button");
      removeButton.textContent = "Remover";
      removeButton.addEventListener("click", () => {
        suffixes.splice(index, 1);
        browser.storage.local.set({ suffixes });
        renderList(suffixes);
      });

      li.appendChild(removeButton);
    }
    suffixList.appendChild(li);
  });
}

browser.storage.local
  .get({ suffixes: ["picture", "wallpapers", "uncategorized", "direct"] })
  .then((data) => {
    renderList(data.suffixes);

    addButton.addEventListener("click", () => {
      const newSuffix = newSuffixInput.value.trim();
      if (newSuffix && !data.suffixes.includes(newSuffix)) {
        data.suffixes.push(newSuffix);
        browser.storage.local.set({ suffixes: data.suffixes });
        newSuffixInput.value = "";
        renderList(data.suffixes);
      }
    });
  });
