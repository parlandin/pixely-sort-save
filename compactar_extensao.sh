#!/bin/bash

EXTENSION_NAME="Pixely-Sort-&-Save"
FILES_TO_INCLUDE="."
EXCLUDE_LIST=(
    "--exclude=compactar_extensao.sh"
    "--exclude=${EXTENSION_NAME}.xpi"
    "--exclude=README.md"
    "--exclude=LICENSE"
    "--exclude=screenshot/*"
    "--exclude=.git/*"
    "--exclude=.gitignore"
    "--exclude=*.zip"
    "--exclude=*.env"
    "--exclude=*.vscode/*"
)

EXCLUDE_CMD="${EXCLUDE_LIST[*]}"

echo "--- Removendo versões anteriores ---"

if [ -f "${EXTENSION_NAME}.xpi" ]; then
    echo "Removendo .xpi anterior: ${EXTENSION_NAME}.xpi"
    rm "${EXTENSION_NAME}.xpi"
fi

if [ -f "${EXTENSION_NAME}.zip" ]; then
    echo "Removendo .zip anterior: ${EXTENSION_NAME}.zip"
    rm "${EXTENSION_NAME}.zip"
fi

echo ""

echo "--- Criando arquivo .xpi ---"
echo "Criando arquivo compactado: ${EXTENSION_NAME}.xpi"
zip -q -r "${EXTENSION_NAME}.xpi" ${FILES_TO_INCLUDE} ${EXCLUDE_CMD}
echo ".xpi criado com sucesso!"
echo ""

echo "--- Criando arquivo .zip ---"
echo "Criando arquivo compactado: ${EXTENSION_NAME}.zip"
zip -q -r "${EXTENSION_NAME}.zip" ${FILES_TO_INCLUDE} ${EXCLUDE_CMD}
echo ".zip criado com sucesso!"
echo ""

echo "--- Todas as tarefas de compactação concluídas! ---"