#!/bin/bash

EXTENSION_NAME="Pixely-Sort-&-Save"
DIST_DIR="dist_chrome"

# Criar diretório de distribuição se não existir
echo "--- Preparando ambiente ---"
if [ -d "${DIST_DIR}" ]; then
    echo "Removendo diretório ${DIST_DIR} existente"
    rm -rf "${DIST_DIR}"
fi

echo "Criando diretório ${DIST_DIR}"
mkdir -p "${DIST_DIR}"
echo ""

# Criar cópia temporária do manifest.chrome.json para manifest.json
echo "--- Preparando manifest.json ---"
if [ -f "manifest.chrome.json" ]; then
    echo "Criando cópia temporária do manifest.chrome.json"
    cp manifest.chrome.json "${DIST_DIR}/manifest.json"
    echo "manifest.json criado com sucesso!"
else
    echo "Arquivo manifest.chrome.json não encontrado!"
    exit 1
fi
echo ""

# Definir arquivos e diretórios para copiar
echo "--- Copiando arquivos para ${DIST_DIR} ---"
# Copiar apenas os diretórios e arquivos necessários
mkdir -p "${DIST_DIR}/icons"
mkdir -p "${DIST_DIR}/scripts"
mkdir -p "${DIST_DIR}/pages"
mkdir -p "${DIST_DIR}/lib"
mkdir -p "${DIST_DIR}/assets"

# Copiar apenas os arquivos específicos necessários
cp -r icons/* "${DIST_DIR}/icons/"
cp -r scripts/* "${DIST_DIR}/scripts/"
cp -r pages/* "${DIST_DIR}/pages/"
cp -r lib/* "${DIST_DIR}/lib/"
cp -r assets/* "${DIST_DIR}/assets/"

# Copiar outros arquivos específicos que possam ser necessários
# Adicione outros arquivos conforme necessário
# cp arquivo.ext "${DIST_DIR}/"

echo "Arquivos copiados com sucesso!"
echo ""

echo "--- Todas as tarefas concluídas! ---"
echo "Extensão disponível em: ${DIST_DIR}/"