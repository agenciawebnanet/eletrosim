# Site do EletroSim

Landing page com download do APK, publicada no Vercel.

- Site: https://eletrosim.vercel.app
- APK: https://eletrosim.vercel.app/eletrosim.apk
- Repositório do site: https://github.com/agenciawebnanet/eletrosim
- Projeto Vercel: `eletrosim` (root directory `.`, deploy automático a cada push)

## Arquivos

```
site/
  index.html            pagina (HTML + CSS, sem dependencias)
  vercel.json           Content-Type e nome do APK no download
  eletrosim.apk         APK publicado (nao versionado no repo do app)
  assets/               captura usada no mockup
```

## Publicar nova versao do APK

Na pasta `eletrosim`:

```powershell
.\publicar-site.ps1
```

O script:

1. pega `app/build/outputs/apk/debug/app-debug.apk` (ou `-ApkPath`);
2. copia para `site/eletrosim.apk`;
3. atualiza o tamanho em MB no `index.html`;
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
