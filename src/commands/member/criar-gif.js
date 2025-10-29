/**
 * Comando para criar figurinhas animadas a partir de busca de GIFs no Pinterest
 * 
 * Funcionalidades:
 * - Busca especificamente GIFs no Pinterest
 * - Cria figurinha animada automaticamente
 * - Sistema de cache para variar resultados em buscas repetidas
 * - Otimizado para GIFs animados
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
const { searchAndDownloadGif, cleanupFile } = require(`${BASE_DIR}/services/pinterestService`);

module.exports = {
  name: "criar-gif",
  description: "Busca um GIF no Pinterest e cria uma figurinha animada automaticamente",
  commands: ["criar-gif", "gif-fig", "gif-sticker"],
  usage: `${PREFIX}criar-gif gato dançando`,
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
        `Exemplo: ${PREFIX}criar-gif cachorro dançando`
      );
    }

    const query = fullArgs.trim();

    if (query.length < 3) {
      throw new InvalidParameterError(
        "A busca precisa ter pelo menos 3 caracteres!"
      );
    }

    await sendWaitReact();

    let downloadedGifPath = null;
    let outputTempPath = null;
    let stickerPath = null;

    try {
      // 1. Buscar e baixar GIF do Pinterest
      console.log(`[CRIAR-GIF] Buscando GIF: "${query}"`);
      const result = await searchAndDownloadGif(query);
      downloadedGifPath = result.filePath;
      
      const fromCacheMsg = result.fromCache ? " (do cache)" : " (nova busca)";
      console.log(`[CRIAR-GIF] GIF encontrado${fromCacheMsg}: ${path.basename(downloadedGifPath)}`);

      // Verificar se o arquivo existe (se do cache, pode ter sido deletado)
      if (!fs.existsSync(downloadedGifPath)) {
        if (result.fromCache) {
          console.log("[CRIAR-GIF] Arquivo do cache não existe mais, invalidando cache e fazendo nova busca...");
          // Invalidar cache desta query e fazer nova busca
          const { invalidateGifCacheEntry } = require(`${BASE_DIR}/services/pinterestService`);
          invalidateGifCacheEntry(query);
          
          // Nova busca (agora vai buscar no Pinterest)
          const newResult = await searchAndDownloadGif(query);
          downloadedGifPath = newResult.filePath;
          
          if (!fs.existsSync(downloadedGifPath)) {
            throw new Error("Erro ao baixar GIF do Pinterest");
          }
          
          console.log(`[CRIAR-GIF] Novo GIF baixado: ${path.basename(downloadedGifPath)}`);
        } else {
          throw new Error("GIF baixado não foi encontrado");
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

      // 3. Converter GIF para figurinha animada usando FFmpeg
      outputTempPath = path.resolve(TEMP_DIR, getRandomName("webp"));

      await new Promise((resolve, reject) => {
        // Processar GIF animado otimizado para sticker
        // Estratégia de redimensionamento inteligente:
        // 1. scale=512:512:force_original_aspect_ratio=increase - Aumenta mantendo proporção (cobre todo o quadrado)
        // 2. crop=512:512 - Corta o centro para 512x512 exato (sem esticar!)
        // 
        // Parâmetros otimizados:
        // - t 10: Limita duração máxima a 10 segundos
        // - fps=12: Taxa de 12 fps (evita travamentos)
        // - flags=lanczos: Melhor qualidade de redimensionamento
        // - loop 0: Loop infinito no sticker
        // - compression_level 6: Melhor compressão
        // - quality 85: Qualidade balanceada
        // - qscale 75: Controle adicional de qualidade para WebP
        // - fs 0.95M: Limite de 0.95MB (margem de segurança)
        // - an: Remove áudio (stickers não têm áudio)
        // - vsync 0: Evita duplicação de frames (melhora fluidez)
        const cmd = `ffmpeg -y -t 10 -i "${downloadedGifPath}" -vcodec libwebp -loop 0 -compression_level 6 -quality 85 -qscale 75 -vf "scale=512:512:force_original_aspect_ratio=increase:flags=lanczos,crop=512:512,fps=12" -an -vsync 0 -fs 0.95M "${outputTempPath}"`;

        exec(cmd, (error, stdout, stderr) => {
          if (error) {
            console.error("[CRIAR-GIF] FFmpeg error:", stderr);
            reject(error);
          } else {
            resolve();
          }
        });
      });

      // 4. Verificar se a conversão foi bem-sucedida
      if (!fs.existsSync(outputTempPath)) {
        throw new Error("Erro ao converter GIF para figurinha");
      }

      // 5. Adicionar metadados à figurinha
      stickerPath = await addStickerMetadata(
        await fs.promises.readFile(outputTempPath),
        metadata
      );

      // 6. Enviar figurinha animada
      await sendSuccessReact();
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await sendStickerFromFile(stickerPath);
          console.log(`[CRIAR-GIF] Figurinha animada enviada com sucesso!`);
          break;
        } catch (stickerError) {
          console.error(
            `[CRIAR-GIF] Tentativa ${attempt} de envio falhou:`,
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
      console.error("[CRIAR-GIF] Erro:", error);
      
      if (error.message.includes("Nenhum GIF encontrado")) {
        await sendErrorReply(
          `❌ *Nenhum GIF encontrado!*\n\n` +
          `Não encontrei GIFs para: "${query}"\n` +
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
          `❌ *Erro ao criar figurinha animada!*\n\n${error.message}`
        );
      }
    } finally {
      // 7. Limpar arquivos temporários
      if (downloadedGifPath && fs.existsSync(downloadedGifPath)) {
        // Se for um arquivo direto, deletar
        try {
          const stat = fs.statSync(downloadedGifPath);
          if (stat.isFile()) {
            cleanupFile(downloadedGifPath);
          }
          
          // Se faz parte de um diretório pinterest_, deletar o diretório inteiro
          const dirname = path.dirname(downloadedGifPath);
          const dirBasename = path.basename(dirname);
          if (dirBasename.startsWith("pinterest_")) {
            fs.rmSync(dirname, { recursive: true, force: true });
            console.log(`[CRIAR-GIF] Diretório removido: ${dirBasename}`);
          }
        } catch (err) {
          console.error(`[CRIAR-GIF] Erro ao limpar: ${err.message}`);
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
