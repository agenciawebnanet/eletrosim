# Site do Consumo Consciente

Landing page com download do APK. Publicada no Vercel.

- Site: https://consumo-consciente-app.vercel.app
- APK: https://consumo-consciente-app.vercel.app/consumo-consciente.apk
- Repositório: https://github.com/agenciawebnanet/eletrosim
- Projeto Vercel: `consumo-consciente` (deploy automático a cada push)

## Arquivos

```
site/
  index.html              pagina de apresentacao e download
  vercel.json             Content-Type e nome do APK no download
  consumo-consciente.apk  APK publicado (nao versionado no repo do app)
  assets/                 captura usada no mockup
  app/sw.js               encerra o PWA antigo instalado em navegadores
```

## Publicar nova versao do APK

Na pasta do app:

```powershell
.\publicar-site.ps1
```

O script copia o release, atualiza tamanho/versao/nome do download e faz commit e
push para o repositorio do site, disparando o deploy no Vercel.

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

## Versao web (PWA)

Foi removida. As URLs `/app` e `/app/*` redirecionam para a pagina inicial e o
service worker publicado apenas limpa o cache e se desregistra em quem tinha o
PWA instalado. O aplicativo disponivel agora e somente o APK.
