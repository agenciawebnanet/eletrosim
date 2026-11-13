# Site do Consumo Consciente

Landing page com download do APK, publicada no Vercel.

- Site: https://consumo-consciente-app.vercel.app
- APK: https://consumo-consciente-app.vercel.app/consumo-consciente.apk
- Link antigo (continua funcionando): https://eletrosim.vercel.app
- Repositório do site: https://github.com/agenciawebnanet/eletrosim
- Projeto Vercel: `eletrosim` (root directory `.`, deploy automático a cada push)

## Arquivos

```
site/
  index.html            pagina (HTML + CSS, sem dependencias)
  vercel.json           Content-Type e nome do APK no download
  consumo-consciente.apk  APK publicado (nao versionado no repo do app)
  assets/               captura usada no mockup
```

## Publicar nova versao do APK

Na pasta do app:

```powershell
.\publicar-site.ps1
```

O script:

1. pega o release `app/build/outputs/apk/release/app-release.apk` (ou o debug, ou `-ApkPath`);
2. copia para `site/consumo-consciente.apk`;
3. atualiza tamanho, versao e nome de download no `index.html` e no `vercel.json`;
4. sincroniza `site` com o clone em `%LOCALAPPDATA%\eletrosim-site-repo`;
5. faz commit e push, disparando o deploy automatico no Vercel.

Opcoes: `-ApkPath "C:\caminho\app.apk"` e `-Message "texto do commit"`.

## Rodar localmente

```powershell
cd site
python -m http.server 8099
```

## Deploy manual

```powershell
cd site
vercel --prod
```
