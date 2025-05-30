#!/bin/bash

EXTENSION_NAME="Pixely-Sort-&-Save"
DIST_DIR="dist_firefox"
FILES_TO_INCLUDE="."
EXCLUDE_LIST=(
    "--exclude=compactar_extensao.sh"
    "--exclude=gerar_pasta_chrome.sh"
    "--exclude=${EXTENSION_NAME}.xpi"
    "--exclude=README.md"
    "--exclude=manifest.chrome.json"
    "--exclude=manifest.firefox.json"
    "--exclude=LICENSE"
    "--exclude=screenshot/*"
    "--exclude=.git/*"
    "--exclude=.gitignore"
    "--exclude=*.zip"
    "--exclude=*.env"
    "--exclude=*.vscode/*"
    "--exclude=dist_*/*"
)

EXCLUDE_CMD="${EXCLUDE_LIST[*]}"

# Criar diretório de distribuição se não existir
echo "--- Preparando ambiente ---"
if [ ! -d "${DIST_DIR}" ]; then
    echo "Criando diretório ${DIST_DIR}"
    mkdir -p "${DIST_DIR}"
fi

# Remover versão anterior
echo "--- Removendo versões anteriores ---"
if [ -f "${DIST_DIR}/${EXTENSION_NAME}.xpi" ]; then
    echo "Removendo .xpi anterior: ${DIST_DIR}/${EXTENSION_NAME}.xpi"
    rm "${DIST_DIR}/${EXTENSION_NAME}.xpi"
fi
echo ""

# Criar cópia temporária do manifest.firefox.json para manifest.json
echo "--- Preparando manifest.json ---"
if [ -f "manifest.firefox.json" ]; then
    echo "Criando cópia temporária do manifest.firefox.json"
    cp manifest.firefox.json manifest.json
    MANIFEST_COPIED=true
else
    echo "Arquivo manifest.firefox.json não encontrado!"
    MANIFEST_COPIED=false
fi
echo ""

# Criar arquivo XPI
echo "--- Criando arquivo .xpi ---"
echo "Criando arquivo compactado: ${DIST_DIR}/${EXTENSION_NAME}.xpi"
zip -q -r "${DIST_DIR}/${EXTENSION_NAME}.xpi" ${FILES_TO_INCLUDE} ${EXCLUDE_CMD}
echo ".xpi criado com sucesso!"
echo ""

# Remover a cópia temporária do manifest.json se foi criada
if [ "$MANIFEST_COPIED" = true ]; then
    echo "--- Limpando arquivos temporários ---"
    echo "Removendo cópia temporária do manifest.json"
    rm manifest.json
    echo ""
fi

echo "--- Todas as tarefas de compactação concluídas! ---"
echo "Arquivo .xpi disponível em: ${DIST_DIR}/${EXTENSION_NAME}.xpi"