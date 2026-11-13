# EletroSim — site

Landing page do EletroSim com download do APK. HTML/CSS puro, sem build.

## Estrutura

```
index.html            pagina completa
eletrosim.apk         APK servido no botao de download
assets/               capturas usadas no mockup
vercel.json           cabecalhos e Content-Type do APK
publicar.ps1          atualiza o APK e publica
```

## Publicar uma nova versao do APK

No repositorio do app:

```powershell
.\publicar-site.ps1
```

O script:

1. pega `app/build/outputs/apk/debug/app-debug.apk` (ou o caminho em `-ApkPath`);
2. copia para `eletrosim.apk`;
3. atualiza o tamanho em MB no `index.html`;
4. sincroniza esta pasta com o clone local do repositorio do site;
5. faz commit e push, o que dispara o deploy automatico no Vercel.

## Rodar localmente

```powershell
python -m http.server 8099
```

Abra `http://localhost:8099`.

## Deploy manual

```powershell
vercel --prod
```

Projeto Vercel: `eletrosim`. Repositorio: `agenciawebnanet/eletrosim`.
