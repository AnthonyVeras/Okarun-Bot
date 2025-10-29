# 🎨 Comando Criar Figurinha do Pinterest

## 📋 Visão Geral

Comando que busca imagens no Pinterest baseado em uma descrição do usuário e automaticamente cria uma figurinha (sticker) a partir da imagem encontrada.

## 🎯 Objetivo

Permitir que usuários criem figurinhas personalizadas sem precisar enviar imagens, apenas descrevendo o que querem buscar.

## 🛠️ Ferramentas Utilizadas

- **gallery-dl**: Downloader universal para sites de galeria de imagens
- **FFmpeg**: Conversão de imagens/GIFs para formato WebP (figurinha)
- **Sistema de Cache**: Memória local para variar resultados e evitar downloads repetidos

## 🏗️ Arquitetura

### 1. Serviço Pinterest (`src/services/pinterestService.js`)

#### Funções Principais:

- **`searchAndDownloadImage(query)`**: Busca e baixa imagem do Pinterest
  - Normaliza query para cache (lowercase + trim)
  - Verifica cache existente
  - Se encontrado: alterna entre resultados salvos
  - Se não encontrado: busca no Pinterest com gallery-dl
  - Baixa até 5 imagens e salva no cache
  - Retorna primeira imagem

- **`loadCache()`** / **`saveCache(cache)`**: Gerenciamento de cache
  - Arquivo: `database/pinterest-cache.json`
  - Formato: `{ "query": { timestamp, results: [{filePath, type}], currentIndex } }`

- **`cleanCache(cache)`**: Remove entradas antigas (>24h)

- **`cleanupFile(filePath)`**: Remove arquivo temporário

- **`cleanupAllPinterestFiles()`**: Limpa todos arquivos do Pinterest em temp/

- **`clearOldCache()`**: Limpa cache expirado

#### Sistema de Cache:

```javascript
{
  "gato fofo": {
    "timestamp": 1735123456789,
    "results": [
      { "filePath": "/temp/pinterest_123_001.jpg", "type": "image" },
      { "filePath": "/temp/pinterest_123_002.jpg", "type": "image" },
      { "filePath": "/temp/pinterest_123_003.gif", "type": "gif" }
    ],
    "currentIndex": 1  // Próxima chamada retorna índice 1
  }
}
```

**Funcionamento:**
- Primeira busca: baixa 5 imagens, retorna a primeira
- Segunda busca (mesma query): retorna segunda imagem do cache
- Terceira busca: retorna terceira imagem
- Quarta busca: volta para primeira (circular)
- Cache expira em 30 minutos

### 2. Comando (`src/commands/member/criar-fig.js`)

#### Estrutura:

```javascript
module.exports = {
  name: "criar-fig",
  commands: ["criar-fig", "criar-figurinha", "fig-pinterest"],
  usage: `${PREFIX}criar-fig gato fofo`,
  handle: async ({ fullArgs, ... }) => {
    // 1. Validar query (min 3 caracteres)
    // 2. Buscar imagem no Pinterest
    // 3. Converter para WebP com FFmpeg
    // 4. Adicionar metadados (username, bot name)
    // 5. Enviar figurinha
    // 6. Limpar arquivos temporários
  }
}
```

#### Fluxo de Execução:

```
1. Usuário: /criar-fig cachorro sorrindo
2. Validar query (min 3 chars)
3. React ⏳ (aguardando)
4. searchAndDownloadImage("cachorro sorrindo")
   ├─ Verificar cache
   ├─ Se cache: retornar próximo resultado
   └─ Se não: buscar no Pinterest
5. Converter imagem → WebP (FFmpeg)
   ├─ Imagem estática: scale 512x512 + quality 90
   └─ GIF: scale 512x512 + fps 15 + palette
6. Adicionar metadados (username, bot name)
7. Enviar sticker (3 tentativas)
8. React ✅ (sucesso)
9. Limpar arquivos temporários
```

## 🎨 Processamento de Imagens

### Imagens Estáticas:

```bash
ffmpeg -i "input.jpg" \
  -vf "scale=512:512:force_original_aspect_ratio=decrease" \
  -f webp -quality 90 "output.webp"
```

- **Scale**: 512x512 mantendo proporção
- **Quality**: 90 (alta qualidade)
- **Formato**: WebP (figurinha)

### GIFs Animados:

```bash
ffmpeg -y -i "input.gif" \
  -vcodec libwebp -fs 0.99M \
  -filter_complex "[0:v] scale=512:512:force_original_aspect_ratio=decrease, fps=15, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse" \
  -f webp "output.webp"
```

- **Scale**: 512x512 mantendo proporção
- **FPS**: 15 (otimizado para figurinha)
- **File Size**: Máximo 0.99MB
- **Palette**: Otimizada com transparência

## ⚙️ Comando gallery-dl

### Busca no Pinterest:

```bash
gallery-dl --range 1-5 --no-mtime \
  -o filename="pinterest_{timestamp}_{num:03d}.{ext}" \
  "https://www.pinterest.com/search/pins/?q=QUERY"
```

**Parâmetros:**
- `--range 1-5`: Baixar até 5 resultados
- `--no-mtime`: Não preservar data original
- `-o filename`: Template do nome do arquivo
- Timeout: 60 segundos

**Formatos Suportados:**
- Imagens: JPG, PNG, WEBP
- GIFs: GIF animados

## 📂 Estrutura de Arquivos

### Arquivos Temporários:

- **Localização**: `assets/temp/`
- **Formato**: `pinterest_[timestamp]_[num].{ext}`
- **Exemplos**:
  - `pinterest_1735123456_001.jpg`
  - `pinterest_1735123456_002.png`
  - `pinterest_1735123456_003.gif`

### Arquivo de Cache:

- **Localização**: `database/pinterest-cache.json`
- **Expiração**: 30 minutos
- **Limpeza**: Automática ao carregar cache

## 🔧 Configurações

### Constantes:

```javascript
const TEMP_DIR = path.join(__dirname, "../../assets/temp");
const CACHE_FILE = path.join(__dirname, "../../database/pinterest-cache.json");
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutos
```

### Validações:

- **Query mínima**: 3 caracteres
- **Timeout**: 60 segundos para busca
- **Tentativas de envio**: 3 tentativas com retry

## 🚨 Tratamento de Erros

### Erros Possíveis:

1. **Query muito curta**: "A busca precisa ter pelo menos 3 caracteres!"
2. **Nenhuma imagem encontrada**: "Não encontrei resultados para: [query]"
3. **Timeout**: "A busca demorou muito. Tente novamente."
4. **Gallery-dl não instalado**: "Verifique se o gallery-dl está instalado"
5. **Erro de conversão**: "Erro ao converter imagem para figurinha"
6. **Erro de envio**: "Falha ao enviar figurinha após 3 tentativas"

## 📊 Logs

### Mensagens de Log:

- `[PINTEREST] Buscando no Pinterest: "query"`
- `[PINTEREST] X imagem(ns) encontrada(s)`
- `[PINTEREST] Usando resultado Y/Z do cache para: "query"`
- `[CRIAR-FIG] Buscando: "query"`
- `[CRIAR-FIG] Imagem encontrada (do cache/nova busca): filename`
- `[CRIAR-FIG] Figurinha enviada com sucesso!`

## 🎯 Casos de Uso

### 1. Primeira Busca (Nova)

```
Usuário: /criar-fig gato preto
Bot: [Busca no Pinterest]
Bot: [Baixa 5 imagens]
Bot: [Cria figurinha da 1ª imagem]
Bot: [Envia figurinha] ✅
```

### 2. Segunda Busca (Mesmo Termo)

```
Usuário: /criar-fig gato preto
Bot: [Verifica cache - encontrado!]
Bot: [Usa 2ª imagem do cache]
Bot: [Cria figurinha]
Bot: [Envia figurinha] ✅
```

### 3. Busca com GIF

```
Usuário: /criar-fig meme engraçado
Bot: [Busca no Pinterest]
Bot: [Encontra GIF animado]
Bot: [Converte para sticker animado]
Bot: [Envia figurinha animada] ✅
```

## ⚠️ Limitações

### Limitações Técnicas:

1. **Dependência**: Requer gallery-dl instalado (`pip install gallery-dl`)
2. **Timeout**: 60 segundos máximo para busca
3. **Resultados**: Até 5 imagens por busca
4. **Cache**: Expira em 30 minutos
5. **Qualidade**: Sujeita aos resultados do Pinterest

### Limitações do Pinterest:

1. **Disponibilidade**: Resultados dependem do Pinterest estar acessível
2. **Bloqueios**: Possíveis rate limits do Pinterest
3. **Conteúdo**: Apenas conteúdo público disponível
4. **Relevância**: Resultados podem variar

## 📝 Exemplos de Uso

### Comandos:

```
/criar-fig gato fofo
/criar-fig meme brasileiro
/criar-fig anime naruto
/criar-figurinha cachorro feliz
/fig-pinterest paisagem bonita
```

### Aliases:

- `/criar-fig` (principal)
- `/criar-figurinha`
- `/fig-pinterest`

## 🎨 Diferenças vs Sticker Normal

| Aspecto | /sticker | /criar-fig |
|---------|----------|------------|
| Input | Imagem enviada | Descrição em texto |
| Origem | Mídia do usuário | Pinterest (busca) |
| Cache | Não | Sim (24h) |
| Variedade | Única | Alterna resultados |
| GIF | Suporta (enviado) | Suporta (busca) |
| Dependências | Apenas FFmpeg | FFmpeg + gallery-dl |

## 🔮 Melhorias Futuras

- [ ] Filtros de busca (tamanho, cor, orientação)
- [ ] Múltiplas fontes (Google Images, Unsplash)
- [ ] Preview de resultados antes de criar figurinha
- [ ] Comando para limpar cache manualmente
- [ ] Estatísticas de buscas mais populares
- [ ] Suporte a packs de figurinhas (múltiplos resultados)
- [ ] Integração com sistema de favoritos

## 📚 Referências

- gallery-dl: https://github.com/mikf/gallery-dl
- Pinterest: https://www.pinterest.com
- FFmpeg: https://ffmpeg.org
- WebP Format: https://developers.google.com/speed/webp

---

**Data de Criação**: Janeiro 2025
**Última Atualização**: Janeiro 2025
**Versão do Bot**: 6.5.1+
