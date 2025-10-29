# 📸 Integração Instagram - yt-dlp

## 📋 Visão Geral

Este documento descreve a integração do **yt-dlp** para download de vídeos e imagens do Instagram sem marca d'água.

## 🎯 Objetivo

Permitir que usuários baixem conteúdo do Instagram (posts, reels, IGTV) com qualidade máxima disponível, incluindo suporte para posts com múltiplas mídias (carrossel).

## 📦 Ferramenta Utilizada

- **Nome**: yt-dlp
- **Versão**: 2025.03.31+
- **Site**: https://github.com/yt-dlp/yt-dlp
- **Funcionalidade**: Downloader universal que suporta Instagram, YouTube, TikTok e mais de 1000 sites

## 🏗️ Arquitetura

### 1. Serviço de Download (`src/services/instagramService.js`)

#### Funções Principais:

- **`downloadInstagramMedia(url)`**: Função principal que gerencia todo o processo
  - Valida URL do Instagram
  - Executa yt-dlp para baixar a mídia
  - Suporta múltiplos arquivos (posts carrossel)
  - Verifica tamanho dos arquivos
  - Retorna array com informações de cada arquivo

- **`isValidInstagramUrl(url)`**: Valida URLs do Instagram
  - Regex: `/^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(p|reel|tv|reels)\/[A-Za-z0-9_-]+/i`
  - Suporta: `/p/`, `/reel/`, `/reels/`, `/tv/`

- **`cleanupFile(filePath)`**: Remove arquivo temporário

#### Fluxo de Execução:

```
1. Validar URL
2. Executar yt-dlp com output template
3. Procurar arquivos baixados no diretório temp
4. Para cada arquivo:
   - Verificar tamanho (MAX 100MB)
   - Determinar tipo (video/image)
   - Adicionar ao array de retorno
5. Retornar {files: [{filePath, type}], info: {count, types}}
```

### 2. Comando (`src/commands/member/downloads/instagram.js`)

#### Estrutura:

```javascript
module.exports = {
  name: "instagram",
  description: "Faço o download de vídeos e imagens do Instagram",
  commands: ["instagram", "ig", "insta"],
  usage: `${PREFIX}instagram https://www.instagram.com/p/ABC123/`,
  handle: async ({ socket, remoteJid, webMessage, ... }) => {
    // 1. Validar parâmetros
    // 2. Chamar serviço de download
    // 3. Enviar cada arquivo (vídeo ou imagem)
    // 4. Limpar arquivos temporários
  }
}
```

#### Lógica de Envio:

**Para Vídeos:**
```javascript
await socket.sendMessage(remoteJid, {
  video: fileBuffer,
  caption: "🎬 *Instagram Video*\n\n✅ Download concluído com sucesso!",
  gifPlayback: false,  // Evita conversão para GIF
  ptv: false,          // Desabilita picture-in-picture
}, {
  quoted: webMessage,
  mediaUploadTimeoutMs: 120000
});
```

**Para Imagens:**
```javascript
await socket.sendMessage(remoteJid, {
  image: fileBuffer,
  caption: "📷 *Instagram Image*\n\n✅ Download concluído com sucesso!",
}, {
  quoted: webMessage
});
```

## 🎨 Configurações de Qualidade

### Vídeos

- **gifPlayback: false** - Evita que o WhatsApp converta o vídeo em GIF (que reduz qualidade)
- **ptv: false** - Desabilita o modo "picture-in-picture" (vídeo redondo)
- **mediaUploadTimeoutMs: 120000** - Timeout de 2 minutos para upload de arquivos grandes

### Imagens

- Enviadas como imagem JPEG com qualidade original
- Suporte para múltiplas imagens em posts carrossel

## 📂 Estrutura de Arquivos

### Diretório Temporário

- **Localização**: `assets/temp/`
- **Formato de Nome**: `instagram_[timestamp]_[index].[ext]`
  - Exemplo vídeo: `instagram_1735123456_0.mp4`
  - Exemplo imagem: `instagram_1735123456_1.jpg`
- **Limpeza**: Automática no bloco `finally` após envio

## 🔧 Configurações

### Constantes:

```javascript
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const TEMP_DIR = path.resolve(__dirname, "../../assets/temp");
```

### Nomeação de Arquivos:

- **Template**: `instagram_[timestamp]_%(autonumber)s.%(ext)s`
- **Exemplo Vídeo**: `instagram_1735123456_00001.mp4`
- **Exemplo Imagem**: `instagram_1735123456_00002.jpg`
- **Carrossel**: `instagram_1735123456_00001.jpg`, `instagram_1735123456_00002.jpg`, `instagram_1735123456_00003.mp4`

## ⚙️ Comando yt-dlp

### Parâmetros Usados:

```bash
yt-dlp --no-warnings --quiet --no-playlist -o "template" "url"
```

- `--no-warnings`: Suprime avisos
- `--quiet`: Modo silencioso (sem progresso)
- `--no-playlist`: Baixa apenas o item específico
- `-o "template"`: Define o nome do arquivo de saída
  - Template: `instagram_[timestamp]_%(autonumber)s.%(ext)s`
  - Exemplo: `instagram_1735123456_00001.mp4`

### Formatos Suportados:

- **Vídeos**: MP4, WEBM, MOV
- **Imagens**: JPG, PNG, WEBP

## 🎯 Casos de Uso

### 1. Post Simples (Uma Imagem/Vídeo)

```
Usuário: /instagram https://www.instagram.com/p/ABC123/
Bot: [Envia 1 arquivo] ✅ Download concluído com sucesso!
```

### 2. Post Carrossel (Múltiplas Mídias)

```
Usuário: /instagram https://www.instagram.com/p/XYZ789/
Bot: [Envia arquivo 1] 📷 *Instagram Image*
Bot: [Envia arquivo 2] 🎬 *Instagram Video*
Bot: [Envia arquivo 3] 📷 *Instagram Image*
```

### 3. Reels

```
Usuário: /instagram https://www.instagram.com/reel/DEF456/
Bot: [Envia vídeo] 🎬 *Instagram Video* ✅ Download concluído!
```

## 🚨 Tratamento de Erros

### Erros Possíveis:

1. **URL inválida**: "❌ URL do Instagram inválida!"
2. **Sem resultados**: "❌ Não foi possível obter informações desta mídia"
3. **Arquivo muito grande**: "❌ Arquivo excede 100MB: [tamanho]"
4. **Erro de download**: "❌ Erro ao baixar arquivo: [mensagem]"
5. **Erro geral**: "❌ Erro ao baixar do Instagram! [mensagem]"

## 📊 Logs

### Mensagens de Log:

- `[INSTAGRAM] Iniciando download do Instagram...`
- `[INSTAGRAM] Baixando arquivo 1/3...`
- `[INSTAGRAM] Download concluído com sucesso!`
- `[INSTAGRAM] Erro: [mensagem]`

## ⚠️ Limitações

### Limitações da Ferramenta:

1. **Posts privados**: Não funciona com contas privadas
2. **Stories**: Não suporta download de stories (expiram em 24h)
3. **Lives**: Não suporta transmissões ao vivo
4. **Autenticação**: Requer cookies para contas privadas (não implementado)

### Limitações Técnicas:

1. **Tamanho máximo**: 100MB por arquivo
2. **Timeout**: Padrão do yt-dlp (sem timeout customizado)
3. **Compressão**: WhatsApp sempre aplica alguma compressão em vídeos
4. **Dependência**: Requer yt-dlp instalado no sistema

### URLs Suportadas:

- ✅ `https://www.instagram.com/p/[POST_ID]/`
- ✅ `https://www.instagram.com/reel/[REEL_ID]/`
- ✅ `https://www.instagram.com/reels/[REEL_ID]/`
- ✅ `https://www.instagram.com/tv/[TV_ID]/`
- ✅ `https://instagr.am/p/[POST_ID]/`
- ❌ Stories (`/stories/`)
- ❌ Perfis (`/[username]/`)
- ❌ Highlights (`/stories/highlights/`)

## 🔄 Fluxo Completo

```
1. Usuário envia: /instagram [URL]
2. Bot valida URL
3. Bot reage com ⏳ (aguardando)
4. Serviço executa yt-dlp com URL
5. yt-dlp baixa arquivo(s) para temp/
6. Para cada arquivo:
   a. Verifica tamanho
   b. Determina tipo (video/image)
   c. Envia para usuário
7. Bot reage com ✅ (sucesso)
8. Limpa arquivos temporários
```

## 📝 Exemplos de Uso

### Comando Básico:

```
/instagram https://www.instagram.com/p/ABC123/
```

### Aliases:

```
/ig https://www.instagram.com/p/ABC123/
/insta https://www.instagram.com/reel/XYZ789/
```

## 🎨 Diferenças vs TikTok

| Aspecto | TikTok | Instagram |
|---------|--------|-----------|
| Ferramenta | @faouzkk/tiktok-dl (NPM) | yt-dlp (CLI) |
| Múltiplos arquivos | ❌ Não | ✅ Sim (carrossel) |
| Tipos de mídia | Vídeo apenas | Vídeo e Imagem |
| Implementação | API/Scraper Node.js | Comando exec CLI |
| Dependência Externa | NPM package | yt-dlp instalado |
| Confiabilidade | Depende de API externa | Alta (yt-dlp mantido ativamente) |

## 🔮 Melhorias Futuras

- [ ] Suporte para autenticação (cookies) para posts privados
- [ ] Metadados do post (likes, descrição, autor) via yt-dlp --print
- [ ] Opção de qualidade (SD/HD) via yt-dlp -f formato
- [ ] Cache de downloads recentes
- [ ] Progress bar durante download
- [ ] Integração com sistema de fila do yt-dlp

## 📚 Referências

- yt-dlp: https://github.com/yt-dlp/yt-dlp
- Baileys: https://github.com/WhiskeySockets/Baileys
- yt-dlp Supported Sites: https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md

---

**Data de Criação**: Janeiro 2025
**Última Atualização**: Janeiro 2025 (Migrado para yt-dlp)
**Versão do Bot**: 6.5.1+
**Motivo da Migração**: Bibliotecas NPM de Instagram apresentaram instabilidade (APIs/scrapers externos fora do ar)
