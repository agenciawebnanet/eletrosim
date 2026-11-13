# Página do EletroSim

Página estática de apresentação e download do APK.

## Arquivos

```
site/
  index.html            página completa (HTML + CSS, sem dependências externas)
  eletrosim.apk         APK para download (NÃO versionado no git)
  assets/
    tela-projetos.png   captura usada no mockup de celular
```

O `index.html` referencia o APK por caminho relativo (`eletrosim.apk`), então os dois
precisam ficar na mesma pasta ao publicar. O atributo `download="EletroSim-1.0.apk"`
define o nome do arquivo salvo no celular.

## Testar no computador

```powershell
cd eletrosim/site
python -m http.server 8099
```

Abra `http://localhost:8099`.

## Testar no celular (mesma rede Wi-Fi)

Descubra o IP da máquina com `ipconfig` e abra `http://SEU_IP:8099` no navegador do
celular. Se não abrir, libere a porta 8099 no Firewall do Windows.

## Publicar

Qualquer hospedagem estática serve. Envie a pasta `site` inteira (HTML, `assets` e o
APK juntos):

- **Netlify Drop:** arraste a pasta em app.netlify.com/drop
- **Vercel:** `vercel deploy site`
- **GitHub Pages:** copie o conteúdo para a branch `gh-pages`
- **Hospedagem própria:** envie por FTP para a raiz ou uma subpasta

Depois de publicar, troque o link de download se quiser apontar para outro domínio.

## Atualizar o APK

```powershell
Copy-Item eletrosim/EletroSim-debug.apk eletrosim/site/eletrosim.apk -Force
```
