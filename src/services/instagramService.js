/**
 * Serviço para download de vídeos/imagens do Instagram usando yt-dlp
 * 
 * Limitações:
 * - Apenas a verificação de tamanho (100MB) é aplicada após o download
 * - Funciona apenas com posts públicos do Instagram
 * - Posts com múltiplas mídias (carrossel) são suportados
 * 
 * @author Dev Gui
 */

const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const execPromise = promisify(exec);
const TEMP_DIR = path.join(__dirname, "../../assets/temp");
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB em bytes

/**
 * Valida se a URL é uma URL válida do Instagram
 * @param {string} url - URL a ser validada
 * @returns {boolean} True se a URL for válida
 */
function isValidInstagramUrl(url) {
  const instagramPattern = /^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(p|reel|tv|reels)\/[A-Za-z0-9_-]+/i;
  return instagramPattern.test(url);
}

/**
 * Remove arquivo temporário
 * @param {string} filePath - Caminho do arquivo
 */
function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`[INSTAGRAM] Erro ao remover arquivo: ${error.message}`);
  }
}

/**
 * Baixa vídeos ou imagens do Instagram usando yt-dlp
 * @param {string} url - URL do post do Instagram
 * @returns {Promise<{files: Array<{filePath: string, type: string}>, info: object}>} Arquivos baixados e informações
 * @throws {Error} Se a URL for inválida, o post não for encontrado, ou exceder 100MB
 */
async function downloadInstagramMedia(url) {
  // Validar URL
  if (!isValidInstagramUrl(url)) {
    throw new Error("URL inválida! A URL deve ser do Instagram (instagram.com/p/, /reel/, /reels/ ou /tv/).");
  }

  const timestamp = Date.now();
  const outputTemplate = path.join(TEMP_DIR, `instagram_${timestamp}_%(autonumber)s.%(ext)s`);

  try {
    console.log("[INSTAGRAM] Iniciando download...");

    // Baixar usando yt-dlp
    const command = `yt-dlp --no-warnings --quiet --no-playlist -o "${outputTemplate}" "${url}"`;
    
    await execPromise(command);

    // Procurar arquivos baixados
    const files = fs.readdirSync(TEMP_DIR).filter(file => file.startsWith(`instagram_${timestamp}_`));

    if (files.length === 0) {
      throw new Error("Nenhum arquivo foi baixado! Verifique se a URL está correta e se o post é público.");
    }

    const downloadedFiles = [];

    // Verificar cada arquivo baixado
    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      const stats = fs.statSync(filePath);
      const fileSizeInBytes = stats.size;

      // Verificar tamanho (limite de 100MB)
      if (fileSizeInBytes > MAX_FILE_SIZE) {
        // Limpar todos os arquivos baixados
        files.forEach(f => cleanupFile(path.join(TEMP_DIR, f)));
        
        const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);
        throw new Error(
          `Arquivo muito grande! Tamanho: ${fileSizeInMB}MB. O limite é de 100MB.`
        );
      }

      // Determinar tipo baseado na extensão
      const ext = path.extname(file).toLowerCase();
      const type = ['.mp4', '.webm', '.mov'].includes(ext) ? 'video' : 'image';

      downloadedFiles.push({
        filePath,
        type,
      });
    }

    console.log("[INSTAGRAM] Download concluído com sucesso!");

    return {
      files: downloadedFiles,
      info: {
        count: downloadedFiles.length,
        types: downloadedFiles.map(f => f.type),
      },
    };
  } catch (error) {
    // Re-lançar erro com mensagem mais amigável
    if (error.message.includes("URL inválida")) {
      throw error;
    } else if (error.message.includes("muito grande")) {
      throw error;
    } else if (error.message.includes("Nenhum arquivo foi baixado")) {
      throw error;
    } else {
      throw new Error(
        `Erro ao baixar do Instagram: ${error.message}\n` +
        "Possíveis causas: post privado, removido ou yt-dlp não instalado."
      );
    }
  }
}

module.exports = {
  downloadInstagramMedia,
  cleanupFile,
  isValidInstagramUrl,
};
