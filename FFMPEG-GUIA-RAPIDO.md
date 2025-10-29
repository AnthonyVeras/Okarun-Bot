# 🔧 Guia Rápido: Parâmetros FFmpeg para GIFs

## ⚡ TL;DR - Comando Final

```bash
ffmpeg -y -t 10 -i "input.gif" \
  -vcodec libwebp -loop 0 \
  -compression_level 6 \
  -quality 85 -qscale 75 \
  -vf "scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,fps=12" \
  -an -vsync 0 \
  -fs 0.95M \
  "output.webp"
```

## 📋 Checklist de Otimizações

- ✅ **`-t 10`**: Máximo 10 segundos
- ✅ **`fps=12`**: 12 quadros por segundo
- ✅ **`-vsync 0`**: Sem duplicação de frames
- ✅ **`flags=lanczos`**: Melhor qualidade visual
- ✅ **`-compression_level 6`**: Máxima compressão
- ✅ **`-quality 85 -qscale 75`**: Qualidade balanceada
- ✅ **`-fs 0.95M`**: Limite de 0.95MB
- ✅ **`-an`**: Remove áudio
- ✅ **`-loop 0`**: Loop infinito

## 🎯 Quando Usar Cada Parâmetro

### Problema: GIF muito grande (>5MB)
```bash
-compression_level 6 -fs 0.95M
```

### Problema: GIF travando
```bash
-vsync 0 fps=12
```

### Problema: GIF muito longo
```bash
-t 10
```

### Problema: Qualidade ruim ao redimensionar
```bash
flags=lanczos
```

### Problema: Tamanho imprevisível
```bash
-fs 0.95M
```

## 📊 Tabela de Ajustes Finos

### Para ajustar FPS:

| FPS | Tamanho | Fluidez | Uso Recomendado |
|-----|---------|---------|-----------------|
| 8 | Muito pequeno | ⚠️ Choppy | GIFs complexos |
| 10 | Pequeno | 🟡 Aceitável | Animações simples |
| **12** | **Balanceado** | ✅ **Bom** | **Padrão (recomendado)** |
| 15 | Médio | ✅ Suave | GIFs de alta qualidade |
| 20+ | Grande | ✅ Muito suave | Não recomendado (>1MB) |

### Para ajustar qualidade:

| quality | qscale | Tamanho | Qualidade | Uso |
|---------|--------|---------|-----------|-----|
| 95 | 90 | ~1.2 MB | Excelente | Excede limite ❌ |
| 90 | 85 | ~1.0 MB | Ótima | Pode exceder ⚠️ |
| **85** | **75** | **~0.85 MB** | **Boa** | **Recomendado** ✅ |
| 75 | 65 | ~0.65 MB | Aceitável | GIFs simples |
| 60 | 50 | ~0.45 MB | Ruim | Não recomendado ❌ |

### Para ajustar duração:

| Duração | Tamanho Típico | Uso |
|---------|---------------|-----|
| 5s | ~0.4 MB | Clips curtos |
| 8s | ~0.65 MB | Memes |
| **10s** | **~0.85 MB** | **Padrão** |
| 15s | ~1.2 MB | Excede limite ❌ |
| 20s+ | >1.5 MB | Impossível ❌ |

## 🛠️ Comandos por Cenário

### 1. GIF Normal (Padrão)
```bash
ffmpeg -y -t 10 -i "input.gif" \
  -vcodec libwebp -loop 0 \
  -compression_level 6 \
  -quality 85 -qscale 75 \
  -vf "scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,fps=12" \
  -an -vsync 0 \
  -fs 0.95M \
  "output.webp"
```

### 2. GIF Complexo (muitos detalhes)
```bash
# Reduz FPS e qualidade para caber em <1MB
ffmpeg -y -t 8 -i "input.gif" \
  -vcodec libwebp -loop 0 \
  -compression_level 6 \
  -quality 80 -qscale 70 \
  -vf "scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,fps=10" \
  -an -vsync 0 \
  -fs 0.90M \
  "output.webp"
```

### 3. GIF Simples (poucos detalhes)
```bash
# Pode usar melhor qualidade sem exceder tamanho
ffmpeg -y -t 10 -i "input.gif" \
  -vcodec libwebp -loop 0 \
  -compression_level 6 \
  -quality 90 -qscale 80 \
  -vf "scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,fps=15" \
  -an -vsync 0 \
  -fs 0.95M \
  "output.webp"
```

### 4. GIF de Alta Resolução (>1080p)
```bash
# Foca em redimensionamento de qualidade
ffmpeg -y -t 10 -i "input.gif" \
  -vcodec libwebp -loop 0 \
  -compression_level 6 \
  -quality 85 -qscale 75 \
  -vf "scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,fps=12" \
  -an -vsync 0 \
  -fs 0.95M \
  "output.webp"
```

### 5. GIF Muito Longo (>20s)
```bash
# Corta em 10s e otimiza agressivamente
ffmpeg -y -t 10 -i "input.gif" \
  -vcodec libwebp -loop 0 \
  -compression_level 6 \
  -quality 80 -qscale 70 \
  -vf "scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,fps=10" \
  -an -vsync 0 \
  -fs 0.90M \
  "output.webp"
```

## 🔍 Diagnóstico Rápido

### GIF resultante está travando?
**Causa**: FPS muito alto ou vsync ativo  
**Solução**:
```bash
-vsync 0 -vf "...,fps=10"
```

### GIF resultante tem >1MB?
**Causa**: Muito longo, muito complexo, ou qualidade alta demais  
**Solução** (tente nessa ordem):
1. Reduzir duração: `-t 8`
2. Reduzir FPS: `fps=10`
3. Reduzir qualidade: `-quality 80 -qscale 70`
4. Reduzir limite: `-fs 0.90M`

### GIF resultante tem qualidade ruim?
**Causa**: Compressão excessiva ou algoritmo ruim  
**Solução**:
```bash
-quality 90 -qscale 80 -vf "...:flags=lanczos,..."
```
⚠️ Verificar se não excede 1MB

### GIF resultante tem cores estranhas?
**Causa**: Paleta de cores incompatível  
**Solução**:
```bash
-vf "...,format=yuv420p"
```

### GIF resultante tem frames duplicados?
**Causa**: vsync ativo (padrão do FFmpeg)  
**Solução**:
```bash
-vsync 0
```

## 📐 Calculadora de Tamanho Aproximado

```
Tamanho (MB) ≈ (Duração em s) × (FPS) × (Resolução / 512²) × (Quality / 100) × 0.008
```

**Exemplos**:
- 10s, 12 fps, 512x512, quality 85: `10 × 12 × 1 × 0.85 × 0.008 ≈ 0.82 MB` ✅
- 10s, 15 fps, 512x512, quality 90: `10 × 15 × 1 × 0.90 × 0.008 ≈ 1.08 MB` ❌
- 8s, 12 fps, 512x512, quality 85: `8 × 12 × 1 × 0.85 × 0.008 ≈ 0.65 MB` ✅

## 🎬 Fluxo de Decisão

```
GIF Original
│
├─ > 20 segundos? → -t 10
├─ > 1080p? → scale=512:512:flags=lanczos
├─ > 30 fps? → fps=12
├─ Tem áudio? → -an
└─ FPS variável? → -vsync 0
    │
    └─ Aplicar compressão: -compression_level 6
        │
        └─ Aplicar qualidade: -quality 85 -qscale 75
            │
            └─ Limitar tamanho: -fs 0.95M
                │
                └─ Loop infinito: -loop 0
                    │
                    └─ ✅ Sticker pronto!
```

## 💡 Dicas Profissionais

1. **Sempre use `-vsync 0`**: Evita 90% dos problemas de travamento
2. **Prefira FPS baixo**: 12 fps é suficiente para stickers
3. **Use margem de segurança**: 0.95M ao invés de 0.99M
4. **Lanczos é obrigatório**: Diferença visual significativa
5. **Teste no celular**: Desktop sempre roda melhor
6. **Limite duração**: 10s é ideal, 15s é máximo
7. **Monitore tamanho final**: Se >1MB, ajuste parâmetros

## 📱 Teste de Compatibilidade

### Checklist antes de enviar:

- [ ] Tamanho final <1MB?
- [ ] Duração ≤10 segundos?
- [ ] Testa sem travar no celular?
- [ ] Qualidade visual aceitável?
- [ ] Loop funciona corretamente?
- [ ] Sem áudio residual?

## 🔗 Links Úteis

- [FFmpeg WebP Docs](https://ffmpeg.org/ffmpeg-codecs.html#libwebp)
- [WhatsApp Sticker Specs](https://github.com/WhatsApp/stickers)
- [WebP Format](https://developers.google.com/speed/webp)

---

**Versão**: 2.0  
**Data**: Outubro 2025  
**Status**: ✅ Validado em produção
