# Pixely Sort & Save

Salve imagens da web de forma rápida, organizada e sem complicações.
**Pixely Sort & Save** adiciona um botão no menu de contexto que permite salvar qualquer imagem diretamente em uma pasta específica, usando sufixos para organizar suas coleções. O nome do arquivo é gerado automaticamente, evitando janelas de diálogo e acelerando seu fluxo de trabalho.

---

## 🎞️ Funcionalidades

* ✅ Salvar imagens com apenas um clique (menu de contexto)
* ✅ Defina sufixos personalizados para organizar em subpastas
* ✅ Nome aleatório automático com extensão preservada
* ✅ Sem janelas de diálogo de download
* ✅ Leve, rápido e fácil de usar


---

## 🚀 Instalação Manual

1. Baixe este repositório como ZIP e extraia os arquivos, ou clone:

   ```bash
   git clone https://github.com/seu-usuario/pixely-sort-save.git
   ```
2. No Firefox/Chrome, acesse:

   * `about:debugging` (Firefox) → "Carregar Add-on Temporário"
   * `chrome://extensions` (Chrome) → Ative "Modo de desenvolvedor" → "Carregar sem compactação"
3. Selecione a pasta do projeto.

---

## ⚙️ Configurações

* Acesse a página de configurações da extensão.
* Adicione ou edite os sufixos que serão usados para criar subpastas.
* As imagens serão salvas em `/images/<sufixo>/`.

![image](./screenshot/options.jpg)


---

## 🗂️ Estrutura dos Arquivos Salvos

```
/images/
 ├── wallpapers/
 ├── memes/
 ├── referencias/
 └── screenshots/
```

---

## 💡 Como Usar

1. Clique com o botão direito sobre qualquer imagem na web.
2. Selecione **"Pixely Sort & Save"**.
3. Escolha um dos sufixos configurados.
4. A imagem será salva automaticamente em `/images/<sufixo>/` com um nome aleatório.

![image](./screenshot/example.jpg)

---

## 🌐 Compatibilidade

* Firefox
* Outros navegadores Firefox-based
