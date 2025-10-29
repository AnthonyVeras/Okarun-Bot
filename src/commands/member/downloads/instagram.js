const { PREFIX } = require(`${BASE_DIR}/config`);
const { downloadInstagramMedia, cleanupFile } = require(`${BASE_DIR}/services/instagramService`);
const { InvalidParameterError } = require(`${BASE_DIR}/errors`);
const fs = require("fs");

module.exports = {
  name: "instagram",
  description: "Faço o download de vídeos e imagens do Instagram",
  commands: ["instagram", "ig", "insta"],
  usage: `${PREFIX}instagram https://www.instagram.com/p/ABC123/`,
  /**
   * @param {CommandHandleProps} props
   * @returns {Promise<void>}
   */
  handle: async ({
    socket,
    remoteJid,
    webMessage,
    sendWaitReact,
    sendSuccessReact,
    sendErrorReply,
    fullArgs,
  }) => {
    if (!fullArgs.length) {
      throw new InvalidParameterError("Você precisa enviar uma URL do Instagram!");
    }

    await sendWaitReact();

    const filePaths = [];

    try {
      // Baixar mídia do Instagram
      const result = await downloadInstagramMedia(fullArgs);
      
      // Guardar paths para limpeza
      result.files.forEach(file => filePaths.push(file.filePath));

      // Enviar cada arquivo
      for (const file of result.files) {
        const fileBuffer = fs.readFileSync(file.filePath);

        if (file.type === "video") {
          // Enviar como vídeo com configurações para manter qualidade HD
          await socket.sendMessage(
            remoteJid,
            {
              video: fileBuffer,
              caption: "🎬 *Instagram Video*\n\n✅ Download concluído com sucesso!",
              gifPlayback: false,
              ptv: false,
            },
            { 
              quoted: webMessage,
              mediaUploadTimeoutMs: 120000,
            }
          );
        } else if (file.type === "image") {
          // Enviar como imagem
          await socket.sendMessage(
            remoteJid,
            {
              image: fileBuffer,
              caption: "📷 *Instagram Image*\n\n✅ Download concluído com sucesso!",
            },
            { 
              quoted: webMessage,
            }
          );
        }
      }

      await sendSuccessReact();
    } catch (error) {
      console.error("[INSTAGRAM] Erro:", error);
      await sendErrorReply(
        `❌ *Erro ao baixar do Instagram!*\n\n${error.message}`
      );
    } finally {
      // Limpar todos os arquivos temporários
      filePaths.forEach(filePath => {
        if (filePath) {
          cleanupFile(filePath);
        }
      });
    }
  },
};
