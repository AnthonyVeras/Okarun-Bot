# 🎬 Comando Criar GIF - Figurinhas Animadas do Pinterest

## 📋 Visão Geral

Variação do comando `/criar-fig` especializado em buscar **especificamente GIFs animados** no Pinterest e criar figurinhas animadas (stickers) automaticamente.

## 🎯 Diferenças vs `/criar-fig`

| Aspecto | /criar-fig | /criar-gif |
|---------|------------|------------|
| Tipo de busca | Imagens e GIFs | **Apenas GIFs** |
| Query modificada | `query` | `query + "gif animated"` |
| Resultados | Misto (imagens/GIFs) | **100% GIFs** |
| Cache separado | `pinterest-cache.json` | `pinterest-gif-cache.json` |
| Diretório temp | `pinterest_[timestamp]` | `pinterest_gif_[timestamp]` |
| Filtro de arquivos | `.jpg, .png, .gif, .webp` | **Apenas `.gif`** |
| Conversão FFmpeg | Detecta tipo | Sempre GIF animado |

## 🛠️ Implementação

### 1. Modificação da Query

```javascript
// /criar-fig
const searchQuery = query; // Ex: "gato"

// /criar-gif
const searchQuery = `${query} gif animated`; // Ex: "gato gif animated"
```

✅ Adiciona "gif animated" automaticamente para filtrar resultados do Pinterest

### 2. Filtro de Arquivos

```javascript
// /criar-fig - aceita vários formatos
if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
  results.push(fullPath);
}

// /criar-gif - apenas GIFs
if (ext === '.gif') {
  results.push(fullPath);
}
```

✅ Garante que apenas GIFs sejam baixados

### 3. Cache Separado

```javascript
// /criar-fig
const CACHE_FILE = "database/pinterest-cache.json";

// /criar-gif
const GIF_CACHE_FILE = "database/pinterest-gif-cache.json";
```

✅ Evita conflito entre buscas de imagens e GIFs

### 4. Diretórios Temporários Distintos

```javascript
// /criar-fig
const searchDir = path.join(TEMP_DIR, `pinterest_${timestamp}`);

// /criar-gif
const searchDir = path.join(TEMP_DIR, `pinterest_gif_${timestamp}`);
```

✅ Organização e limpeza mais fácil

## 🎨 Processamento de GIFs

### FFmpeg - Otimizado para Performance e Qualidade:

```bash
ffmpeg -y -t 10 -i "input.gif" \
  -vcodec libwebp -loop 0 \
  -compression_level 6 \
  -quality 85 -qscale 75 \
  -vf "scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black,fps=12" \
  -an -vsync 0 \
  -fs 0.95M "output.webp"
```

**Otimizações Aplicadas:**

| Parâmetro | Valor | Benefício |
|-----------|-------|-----------|
| `-t 10` | 10 segundos | ⏱️ Limita duração máxima |
| `-r 12` | 12 fps | 🎬 Evita travamentos visuais |
| `flags=lanczos` | Algoritmo avançado | 🖼️ Melhor qualidade ao redimensionar |
| `pad=512:512` | Preenchimento | 📐 **Evita cortes visuais** |
| `(ow-iw)/2:(oh-ih)/2` | Centralizado | 🎯 Centraliza na área 512x512 |
| `color=black` | Fundo preto | ⬛ Preenchimento discreto |
| `-compression_level 6` | Nível 6 (0-6) | 📦 Máxima compressão |
| `-quality 85` | 85/100 | ⚖️ Qualidade balanceada |
| `-qscale 75` | 75/100 | 🎯 Controle fino de qualidade WebP |
| `-fs 0.95M` | 0.95 MB | 💾 Garante <1MB com margem |
| `-an` | Remove áudio | 🔇 Stickers não têm áudio |
| `-vsync 0` | Sem sincronização | ✨ Evita frames duplicados |
| `-loop 0` | Loop infinito | 🔄 Reprodução contínua |

### Por que Padding ao invés de Crop?

**❌ Problema Anterior (sem padding):**
```
GIF 800x600 → scale → 512x384 → ❌ Cortado visualmente
```

**✅ Solução Atual (com padding):**
```
GIF 800x600 → scale → 512x384 → pad → 512x512 ✅
                                    (64px preto em cima/baixo)
```

### Como Funciona o Padding:

```
Original: 800x600 (landscape)

1. Scale: Reduz proporcionalmente para caber em 512x512
   → Resultado: 512x384

2. Pad: Adiciona barras pretas para completar 512x512
   → Top: (512-384)/2 = 64px preto
   → Bottom: (512-384)/2 = 64px preto
   → Left: 0px (já tem 512px)
   → Right: 0px (já tem 512px)

Resultado Final: 512x512 com GIF centralizado ✅
```

### Por que 12 FPS?

- **WhatsApp**: Ideal para stickers (suporta até 30 fps, mas 12 fps é suficiente)
- **Tamanho**: Reduz drasticamente o tamanho do arquivo
- **Fluidez**: Mantém animação suave sem travamentos
- **Compatibilidade**: Funciona em todos os dispositivos

## 📂 Estrutura de Arquivos

### Cache de GIFs:

```json
{
  "gato dançando": {
    "timestamp": 1735123456789,
    "results": [
      { "filePath": "/temp/pinterest_gif_123/...", "type": "gif" },
      { "filePath": "/temp/pinterest_gif_123/...", "type": "gif" },
      { "filePath": "/temp/pinterest_gif_123/...", "type": "gif" }
    ],
    "currentIndex": 1
  }
}
```

**Localização**: `database/pinterest-gif-cache.json`

### Diretórios Temporários:

```
assets/temp/
├── pinterest_123456789/          (/criar-fig)
│   └── gallery-dl/pinterest/...
└── pinterest_gif_987654321/      (/criar-gif)
    └── gallery-dl/pinterest/...
```

## 🔧 Funções Específicas

### `searchAndDownloadGif(query)`

- Busca especificamente GIFs no Pinterest
- Adiciona "gif animated" à query
- Filtra apenas arquivos `.gif`
- Cache separado de imagens normais
- Retorna sempre `type: 'gif'`

### `invalidateGifCacheEntry(query)`

- Invalida entrada específica do cache de GIFs
- Usado quando arquivo do cache não existe mais
- Força nova busca no Pinterest

### `loadGifCache()` / `saveGifCache()`

- Gerencia cache específico para GIFs
- Arquivo: `pinterest-gif-cache.json`
- Separado do cache de imagens

## 📝 Exemplos de Uso

### Comandos:

```
/criar-gif gato dançando
/criar-gif meme engraçado
/criar-gif anime happy
/gif-fig cachorro pulando
/gif-sticker reação surpresa
```

### Aliases:

- `/criar-gif` (principal)
- `/gif-fig`
- `/gif-sticker`

## 🚨 Mensagens de Erro Específicas

```
❌ Nenhum GIF encontrado!
Não encontrei GIFs para: "query"
Tente usar termos diferentes ou mais específicos.
```

## 🎯 Casos de Uso

### 1. Primeira Busca

```
Usuário: /criar-gif gato dançando
Bot: [Busca "gato dançando gif animated" no Pinterest]
Bot: [Baixa 5 GIFs]
Bot: [Cria sticker animado do 1º GIF]
Bot: [Envia figurinha animada] 🎬✅
```

### 2. Segunda Busca (Cache)

```
Usuário: /criar-gif gato dançando
Bot: [Verifica cache - encontrado!]
Bot: [Usa 2º GIF do cache]
Bot: [Cria sticker animado]
Bot: [Envia figurinha animada] 🎬✅
```

### 3. Cache Inválido

```
Usuário: /criar-gif gato dançando
Bot: [Cache - arquivo não existe]
Bot: [Invalida cache de GIFs]
Bot: [Nova busca no Pinterest]
Bot: [Baixa 5 novos GIFs]
Bot: [Cria e envia] 🎬✅
```

## ⚠️ Limitações

1. **Apenas GIFs**: Ignora imagens estáticas
2. **Tamanho**: Máximo **0.95MB** (garante <1MB)
3. **Duração**: Máximo **10 segundos** (cortado automaticamente)
4. **FPS**: Limitado a **12 fps** (evita travamentos)
5. **Cache**: Expira em 30 minutos
6. **Dependências**: gallery-dl + FFmpeg

## 🔮 Vantagens

✅ **Busca Focada**: Apenas GIFs, sem imagens estáticas  
✅ **Cache Separado**: Não mistura com buscas de imagens  
✅ **Query Otimizada**: Adiciona "gif animated" automaticamente  
✅ **Conversão Garantida**: Sempre processa como GIF animado  
✅ **Recuperação Automática**: Invalida cache se arquivo não existe  
✅ **Sem Travamentos**: 12 fps evita bugs visuais  
✅ **Sempre <1MB**: Compressão otimizada com margem de segurança  
✅ **Duração Controlada**: Corta GIFs longos em 10 segundos  
✅ **Alta Qualidade**: Algoritmo Lanczos para redimensionamento

## 📚 Logs

```
[CRIAR-GIF] Buscando GIF: "gato dançando"
[PINTEREST-GIF] Buscando GIFs no Pinterest: "gato dançando"
[PINTEREST-GIF] 3 GIF(s) encontrado(s)
[CRIAR-GIF] GIF encontrado (nova busca): pinterest_123.gif
[CRIAR-GIF] Figurinha animada enviada com sucesso!
[CRIAR-GIF] Diretório removido: pinterest_gif_1761775341045
```

---

**Data de Criação**: Janeiro 2025
**Versão do Bot**: 6.5.1+
**Relacionado**: `/criar-fig` (comando de imagens)
