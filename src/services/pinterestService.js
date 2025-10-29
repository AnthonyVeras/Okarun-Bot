/**
 * Serviço para buscar e baixar imagens do Pinterest usando gallery-dl
 * 
 * Funcionalidades:
 * - Busca imagens no Pinterest por query
 * - Sistema de cache para evitar downloads repetidos
 * - Suporte a imagens e GIFs
 * 
 * @author Dev Gui
 */

const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const execPromise = promisify(exec);
const TEMP_DIR = path.join(__dirname, "../../assets/temp");
const CACHE_FILE = path.join(__dirname, "../../database/pinterest-cache.json");
const GIF_CACHE_FILE = path.join(__dirname, "../../database/pinterest-gif-cache.json");
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutos

/**
 * Carrega o cache de buscas
 * @returns {Object} Cache de buscas
 */
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("[PINTEREST] Erro ao carregar cache:", error.message);
  }
  return {};
}

/**
 * Salva o cache de buscas
 * @param {Object} cache - Cache a ser salvo
 */
function saveCache(cache) {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error("[PINTEREST] Erro ao salvar cache:", error.message);
  }
}

/**
 * Limpa entradas antigas do cache
 * @param {Object} cache - Cache a ser limpo
 * @returns {Object} Cache limpo
 */
function cleanCache(cache) {
  const now = Date.now();
  const cleaned = {};
  
  for (const [key, value] of Object.entries(cache)) {
    if (now - value.timestamp < CACHE_EXPIRY) {
      cleaned[key] = value;
    }
  }
  
  return cleaned;
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
    console.error(`[PINTEREST] Erro ao remover arquivo: ${error.message}`);
  }
}

/**
 * Busca e baixa uma imagem do Pinterest baseada na query
 * @param {string} query - Termo de busca
 * @returns {Promise<{filePath: string, type: string, fromCache: boolean}>} Informações do arquivo baixado
 * @throws {Error} Se não encontrar resultados ou falhar no download
 */
async function searchAndDownloadImage(query) {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Carregar e limpar cache
  let cache = loadCache();
  cache = cleanCache(cache);
  
  // Verificar se existe no cache e alternar resultado
  if (cache[normalizedQuery]) {
    const cachedData = cache[normalizedQuery];
    const currentIndex = cachedData.currentIndex || 0;
    const cachedResult = cachedData.results[currentIndex];
    
    console.log(`[PINTEREST] Usando resultado ${currentIndex + 1}/${cachedData.results.length} do cache para: "${query}"`);
    
    // Atualizar índice para próxima chamada (rotação circular)
    const nextIndex = (currentIndex + 1) % cachedData.results.length;
    cache[normalizedQuery].currentIndex = nextIndex;
    saveCache(cache);
    
    return {
      filePath: cachedResult.filePath,
      type: cachedResult.type,
      fromCache: true,
    };
  }
  
  try {
    console.log(`[PINTEREST] Buscando no Pinterest: "${query}"`);
    
    const timestamp = Date.now();
    const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;
    
    // Usar diretório temporário do bot e criar subdiretório para esta busca
    const searchDir = path.join(TEMP_DIR, `pinterest_${timestamp}`);
    if (!fs.existsSync(searchDir)) {
      fs.mkdirSync(searchDir, { recursive: true });
    }
    
    // Buscar e baixar usando gallery-dl
    // --range 1-5: baixar até 5 imagens
    // -D: diretório de destino
    const command = `gallery-dl --range 1-5 --no-mtime -D "${searchDir}" "${searchUrl}"`;
    
    const { stdout, stderr } = await execPromise(command, {
      timeout: 60000, // 60 segundos timeout
    });
    
    if (stderr && !stderr.includes("warning")) {
      console.error("[PINTEREST] Gallery-dl stderr:", stderr);
    }
    
    // Procurar arquivos baixados recursivamente no diretório
    const findFiles = (dir) => {
      let results = [];
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          results = results.concat(findFiles(fullPath));
        } else {
          // Filtrar apenas imagens
          const ext = path.extname(item).toLowerCase();
          if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
            results.push(fullPath);
          }
        }
      }
      
      return results;
    };
    
    const files = findFiles(searchDir).sort();
    
    if (files.length === 0) {
      // Limpar diretório vazio
      fs.rmSync(searchDir, { recursive: true, force: true });
      throw new Error(`Nenhuma imagem encontrada para "${query}". Tente outro termo de busca.`);
    }
    
    console.log(`[PINTEREST] ${files.length} imagem(ns) encontrada(s)`);
    
    // Salvar resultados no cache
    const cacheResults = files.map(filePath => {
      const ext = path.extname(filePath).toLowerCase();
      const type = ['.gif', '.webp'].includes(ext) ? 'gif' : 'image';
      
      return { filePath, type };
    });
    
    cache[normalizedQuery] = {
      timestamp: Date.now(),
      results: cacheResults,
      currentIndex: 1, // Próximo será o índice 1
    };
    
    saveCache(cache);
    
    // Retornar primeiro resultado
    return {
      filePath: cacheResults[0].filePath,
      type: cacheResults[0].type,
      fromCache: false,
    };
    
  } catch (error) {
    if (error.message.includes("timeout")) {
      throw new Error("Tempo esgotado ao buscar no Pinterest. Tente novamente.");
    }
    
    if (error.message.includes("Nenhuma imagem encontrada")) {
      throw error;
    }
    
    throw new Error(
      `Erro ao buscar no Pinterest: ${error.message}\n` +
      "Verifique se o gallery-dl está instalado: pip install gallery-dl"
    );
  }
}

/**
 * Limpa todos os arquivos temporários do Pinterest
 */
function cleanupAllPinterestFiles() {
  try {
    const items = fs.readdirSync(TEMP_DIR);
    let count = 0;
    
    for (const item of items) {
      if (item.startsWith("pinterest_")) {
        const fullPath = path.join(TEMP_DIR, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          count++;
        } else {
          fs.unlinkSync(fullPath);
          count++;
        }
      }
    }
    
    if (count > 0) {
      console.log(`[PINTEREST] ${count} item(s) temporário(s) removido(s)`);
    }
  } catch (error) {
    console.error("[PINTEREST] Erro ao limpar arquivos:", error.message);
  }
}

/**
 * Invalida uma entrada específica do cache
 * @param {string} query - Query a ser removida do cache
 */
function invalidateCacheEntry(query) {
  try {
    const normalizedQuery = query.toLowerCase().trim();
    let cache = loadCache();
    
    if (cache[normalizedQuery]) {
      delete cache[normalizedQuery];
      saveCache(cache);
      console.log(`[PINTEREST] Cache invalidado para: "${query}"`);
    }
  } catch (error) {
    console.error("[PINTEREST] Erro ao invalidar cache:", error.message);
  }
}

/**
 * Carrega o cache de buscas de GIFs
 * @returns {Object} Cache de buscas de GIFs
 */
function loadGifCache() {
  try {
    if (fs.existsSync(GIF_CACHE_FILE)) {
      const data = fs.readFileSync(GIF_CACHE_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("[PINTEREST-GIF] Erro ao carregar cache:", error.message);
  }
  return {};
}

/**
 * Salva o cache de buscas de GIFs
 * @param {Object} cache - Cache a ser salvo
 */
function saveGifCache(cache) {
  try {
    const dir = path.dirname(GIF_CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(GIF_CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error("[PINTEREST-GIF] Erro ao salvar cache:", error.message);
  }
}

/**
 * Invalida uma entrada específica do cache de GIFs
 * @param {string} query - Query a ser removida do cache
 */
function invalidateGifCacheEntry(query) {
  try {
    const normalizedQuery = query.toLowerCase().trim();
    let cache = loadGifCache();
    
    if (cache[normalizedQuery]) {
      delete cache[normalizedQuery];
      saveGifCache(cache);
      console.log(`[PINTEREST-GIF] Cache invalidado para: "${query}"`);
    }
  } catch (error) {
    console.error("[PINTEREST-GIF] Erro ao invalidar cache:", error.message);
  }
}

/**
 * Busca e baixa especificamente GIFs do Pinterest
 * @param {string} query - Termo de busca
 * @returns {Promise<{filePath: string, type: string, fromCache: boolean}>} Informações do GIF baixado
 * @throws {Error} Se não encontrar GIFs ou falhar no download
 */
async function searchAndDownloadGif(query) {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Carregar e limpar cache de GIFs
  let cache = loadGifCache();
  cache = cleanCache(cache);
  
  // Verificar se existe no cache e alternar resultado
  if (cache[normalizedQuery]) {
    const cachedData = cache[normalizedQuery];
    const currentIndex = cachedData.currentIndex || 0;
    const cachedResult = cachedData.results[currentIndex];
    
    console.log(`[PINTEREST-GIF] Usando resultado ${currentIndex + 1}/${cachedData.results.length} do cache para: "${query}"`);
    
    // Atualizar índice para próxima chamada (rotação circular)
    const nextIndex = (currentIndex + 1) % cachedData.results.length;
    cache[normalizedQuery].currentIndex = nextIndex;
    saveGifCache(cache);
    
    return {
      filePath: cachedResult.filePath,
      type: 'gif',
      fromCache: true,
    };
  }
  
  try {
    console.log(`[PINTEREST-GIF] Buscando GIFs no Pinterest: "${query}"`);
    
    const timestamp = Date.now();
    // Adicionar "gif animated" à query para buscar especificamente GIFs
    const searchQuery = `${query} gif animated`;
    const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(searchQuery)}`;
    
    // Usar diretório temporário do bot e criar subdiretório para esta busca
    const searchDir = path.join(TEMP_DIR, `pinterest_gif_${timestamp}`);
    if (!fs.existsSync(searchDir)) {
      fs.mkdirSync(searchDir, { recursive: true });
    }
    
    // Buscar e baixar usando gallery-dl
    const command = `gallery-dl --range 1-5 --no-mtime -D "${searchDir}" "${searchUrl}"`;
    
    const { stdout, stderr } = await execPromise(command, {
      timeout: 60000, // 60 segundos timeout
    });
    
    if (stderr && !stderr.includes("warning")) {
      console.error("[PINTEREST-GIF] Gallery-dl stderr:", stderr);
    }
    
    // Procurar apenas GIFs recursivamente
    const findGifs = (dir) => {
      let results = [];
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          results = results.concat(findGifs(fullPath));
        } else {
          // Filtrar apenas GIFs
          const ext = path.extname(item).toLowerCase();
          if (ext === '.gif') {
            results.push(fullPath);
          }
        }
      }
      
      return results;
    };
    
    const gifFiles = findGifs(searchDir).sort();
    
    if (gifFiles.length === 0) {
      // Limpar diretório vazio
      fs.rmSync(searchDir, { recursive: true, force: true });
      throw new Error(`Nenhum GIF encontrado para "${query}". Tente outro termo de busca.`);
    }
    
    console.log(`[PINTEREST-GIF] ${gifFiles.length} GIF(s) encontrado(s)`);
    
    // Salvar resultados no cache
    const cacheResults = gifFiles.map(filePath => ({
      filePath,
      type: 'gif',
    }));
    
    cache[normalizedQuery] = {
      timestamp: Date.now(),
      results: cacheResults,
      currentIndex: 1, // Próximo será o índice 1
    };
    
    saveGifCache(cache);
    
    // Retornar primeiro resultado
    return {
      filePath: cacheResults[0].filePath,
      type: 'gif',
      fromCache: false,
    };
    
  } catch (error) {
    if (error.message.includes("timeout")) {
      throw new Error("Tempo esgotado ao buscar GIFs no Pinterest. Tente novamente.");
    }
    
    if (error.message.includes("Nenhum GIF encontrado")) {
      throw error;
    }
    
    throw new Error(
      `Erro ao buscar GIFs no Pinterest: ${error.message}\n` +
      "Verifique se o gallery-dl está instalado: pip install gallery-dl"
    );
  }
}

/**
 * Limpa cache antigo (mais de 24h)
 */
function clearOldCache() {
  try {
    let cache = loadCache();
    const before = Object.keys(cache).length;
    cache = cleanCache(cache);
    const after = Object.keys(cache).length;
    
    if (before !== after) {
      saveCache(cache);
      console.log(`[PINTEREST] Cache limpo: ${before - after} entrada(s) removida(s)`);
    }
  } catch (error) {
    console.error("[PINTEREST] Erro ao limpar cache:", error.message);
  }
}

module.exports = {
  searchAndDownloadImage,
  searchAndDownloadGif,
  cleanupFile,
  cleanupAllPinterestFiles,
  clearOldCache,
  invalidateCacheEntry,
  invalidateGifCacheEntry,
};
