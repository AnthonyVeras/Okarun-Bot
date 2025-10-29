/**
 * Comando para criar figurinhas a partir de busca no Pinterest
 * 
 * Funcionalidades:
 * - Busca imagem no Pinterest baseada na descrição do usuário
 * - Cria figurinha automaticamente da imagem encontrada
 * - Sistema de cache para variar resultados em buscas repetidas
 * - Suporte a GIFs
 * 
 * @author Dev Gui
 */

const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const { PREFIX, BOT_NAME, BOT_EMOJI, TEMP_DIR } = require(`${BASE_DIR}/config`);
const { InvalidParameterError } = require(`${BASE_DIR}/errors`);
const { getRandomName } = require(`${BASE_DIR}/utils`);
const { addStickerMetadata } = require(`${BASE_DIR}/services/sticker`);
const { searchAndDownloadImage, cleanupFile } = require(`${BASE_DIR}/services/pinterestService`);

module.exports = {
  name: "criar-fig",
  description: "Busca uma imagem no Pinterest e cria uma figurinha automaticamente",
  commands: ["criar-fig", "criar-figurinha", "fig-pinterest"],
  usage: `${PREFIX}criar-fig gato fofo`,
  /**
   * @param {CommandHandleProps} props
   * @returns {Promise<void>}
   */
  handle: async ({
    fullArgs,
    sendWaitReact,
    sendSuccessReact,
    sendErrorReply,
    sendStickerFromFile,
    webMessage,
    userJid,
  }) => {
    if (!fullArgs || fullArgs.trim().length === 0) {
      throw new InvalidParameterError(
        "Você precisa informar o que deseja buscar!\n\n" +
        `Exemplo: ${PREFIX}criar-fig gato fofo`
      );
    }

    const query = fullArgs.trim();

    if (query.length < 3) {
      throw new InvalidParameterError(
        "A busca precisa ter pelo menos 3 caracteres!"
      );
    }

    await sendWaitReact();

    let downloadedImagePath = null;
    let outputTempPath = null;
    let stickerPath = null;

    try {
      // 1. Buscar e baixar imagem do Pinterest
      console.log(`[CRIAR-FIG] Buscando: "${query}"`);
      const result = await searchAndDownloadImage(query);
      downloadedImagePath = result.filePath;
      
      const fromCacheMsg = result.fromCache ? " (do cache)" : " (nova busca)";
      console.log(`[CRIAR-FIG] Imagem encontrada${fromCacheMsg}: ${path.basename(downloadedImagePath)}`);

      // Verificar se o arquivo existe (se do cache, pode ter sido deletado)
      if (!fs.existsSync(downloadedImagePath)) {
        if (result.fromCache) {
          console.log("[CRIAR-FIG] Arquivo do cache não existe mais, invalidando cache e fazendo nova busca...");
          // Invalidar cache desta query e fazer nova busca
          const { invalidateCacheEntry } = require(`${BASE_DIR}/services/pinterestService`);
          invalidateCacheEntry(query);
          
          // Nova busca (agora vai buscar no Pinterest)
          const newResult = await searchAndDownloadImage(query);
          downloadedImagePath = newResult.filePath;
          
          if (!fs.existsSync(downloadedImagePath)) {
            throw new Error("Erro ao baixar imagem do Pinterest");
          }
          
          console.log(`[CRIAR-FIG] Nova imagem baixada: ${path.basename(downloadedImagePath)}`);
        } else {
          throw new Error("Arquivo baixado não foi encontrado");
        }
      }

      // 2. Preparar metadados da figurinha
      const username = webMessage?.pushName || 
                       webMessage?.notifyName || 
                       (userJid ? userJid.replace(/@s.whatsapp.net/, "") : "Usuário");

      const metadata = {
        username: username,
        botName: `${BOT_EMOJI} ${BOT_NAME}`,
      };

      // 3. Converter para figurinha usando FFmpeg
      outputTempPath = path.resolve(TEMP_DIR, getRandomName("webp"));

      await new Promise((resolve, reject) => {
        let cmd;
        
        if (result.type === 'gif') {
          // Processar GIF animado com otimizações para evitar bugs visuais
          // Estratégia: scale=increase + crop (preenche 512x512 sem esticar)
          // - scale aumenta mantendo proporção até cobrir todo o quadrado
          // - crop corta o centro para 512x512 exato
          // Isso evita GIFs cortados e mantém proporção original
          // 
          // - t 10: Limita duração máxima a 10 segundos
          // - fps=12: Taxa de 12 fps (evita travamentos)
          // - flags=lanczos: Melhor qualidade de redimensionamento
          // - loop 0: Loop infinito
          // - compression_level 6: Melhor compressão
          // - quality 85: Qualidade balanceada
          // - qscale 75: Controle adicional de qualidade
          // - fs 0.95M: Limite de 0.95MB (margem de segurança)
          // - an: Remove áudio
          // - vsync 0: Evita duplicação de frames
          cmd = `ffmpeg -y -t 10 -i "${downloadedImagePath}" -vcodec libwebp -loop 0 -compression_level 6 -quality 85 -qscale 75 -vf "scale=512:512:force_original_aspect_ratio=increase:flags=lanczos,crop=512:512,fps=12" -an -vsync 0 -fs 0.95M "${outputTempPath}"`;
        } else {
          // Processar imagem estática com crop inteligente
          cmd = `ffmpeg -i "${downloadedImagePath}" -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512" -f webp -quality 90 "${outputTempPath}"`;
        }

        exec(cmd, (error, stdout, stderr) => {
          if (error) {
            console.error("[CRIAR-FIG] FFmpeg error:", stderr);
            reject(error);
          } else {
            resolve();
          }
        });
      });

      // 4. Verificar se a conversão foi bem-sucedida
      if (!fs.existsSync(outputTempPath)) {
        throw new Error("Erro ao converter imagem para figurinha");
      }

      // 5. Adicionar metadados à figurinha
      stickerPath = await addStickerMetadata(
        await fs.promises.readFile(outputTempPath),
        metadata
      );

      // 6. Enviar figurinha
      await sendSuccessReact();
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await sendStickerFromFile(stickerPath);
          console.log(`[CRIAR-FIG] Figurinha enviada com sucesso!`);
          break;
        } catch (stickerError) {
          console.error(
            `[CRIAR-FIG] Tentativa ${attempt} de envio falhou:`,
            stickerError.message
          );

          if (attempt === 3) {
            throw new Error(
              `Falha ao enviar figurinha após 3 tentativas: ${stickerError.message}`
            );
          }

          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }

    } catch (error) {
      console.error("[CRIAR-FIG] Erro:", error);
      
      if (error.message.includes("Nenhuma imagem encontrada")) {
        await sendErrorReply(
          `❌ *Nenhuma imagem encontrada!*\n\n` +
          `Não encontrei resultados para: "${query}"\n` +
          `Tente usar termos diferentes ou mais específicos.`
        );
      } else if (error.message.includes("Tempo esgotado")) {
        await sendErrorReply(
          `⏱️ *Tempo esgotado!*\n\n` +
          `A busca demorou muito. Tente novamente em alguns segundos.`
        );
      } else if (error.message.includes("gallery-dl")) {
        await sendErrorReply(
          `❌ *Erro na busca!*\n\n` +
          `Verifique se o gallery-dl está instalado corretamente.\n` +
          `Comando: pip install gallery-dl`
        );
      } else {
        await sendErrorReply(
          `❌ *Erro ao criar figurinha!*\n\n${error.message}`
        );
      }
    } finally {
      // 7. Limpar arquivos temporários
      if (downloadedImagePath && fs.existsSync(downloadedImagePath)) {
        // Se for um arquivo direto, deletar
        const stat = fs.statSync(downloadedImagePath);
        if (stat.isFile()) {
          cleanupFile(downloadedImagePath);
        }
        
        // Se faz parte de um diretório pinterest_, deletar o diretório inteiro
        const dirname = path.dirname(downloadedImagePath);
        const dirBasename = path.basename(dirname);
        if (dirBasename.startsWith("pinterest_")) {
          try {
            fs.rmSync(dirname, { recursive: true, force: true });
            console.log(`[CRIAR-FIG] Diretório removido: ${dirBasename}`);
          } catch (err) {
            console.error(`[CRIAR-FIG] Erro ao remover diretório: ${err.message}`);
          }
        }
      }
      
      if (outputTempPath && fs.existsSync(outputTempPath)) {
        fs.unlinkSync(outputTempPath);
      }
      
      if (stickerPath && fs.existsSync(stickerPath)) {
        fs.unlinkSync(stickerPath);
      }
    }
  },
};
