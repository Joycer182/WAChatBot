import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

// --- Setup para obtener __dirname en módulos ES ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Gestión del Caché en Archivo JSON ---
const CACHE_FILE_PATH = path.join(__dirname, 'data', 'bcv_cache.json');

let cache = {
    dolar: null,
    euro: null,
    lastUpdated: null,
};

/**
 * Carga el caché desde el archivo JSON.
 */
function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE_PATH)) {
            const data = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
            cache = JSON.parse(data);
            console.log("Caché de tasas del BCV cargado desde archivo.");
        } else {
            console.log("No se encontró archivo de caché del BCV. Se creará uno nuevo en la primera consulta exitosa.");
            saveCache();
        }
    } catch (error) {
        console.error("Error al cargar el archivo de caché del BCV. Se usará un caché vacío.", error);
        cache = { dolar: null, euro: null, lastUpdated: null };
    }
}

/**
 * Guarda el caché actual en el archivo JSON.
 */
function saveCache() {
    try {
        fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2));
        console.log("Caché de tasas del BCV guardado en archivo.");
    } catch (error) {
        console.error("Error al guardar el archivo de caché del BCV.", error);
    }
}

// Cargar el caché al iniciar el módulo
loadCache();

/**
 * Obtiene la hora actual en Venezuela (UTC-4).
 * @returns {Date}
 */
function getVenezuelaTime() {
    const now = new Date();
    const vetOffset = -4 * 60 * 60 * 1000; // UTC-4
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + vetOffset);
}

/**
 * Determina si se debe realizar una nueva consulta al BCV basado en una lógica de caché inteligente.
 * La función devuelve `true` (consultar) bajo las siguientes condiciones, en orden de prioridad:
 * 1. Si el caché está vacío.
 * 2. Si la fecha del caché es de un día anterior.
 * 3. Si la hora actual está DENTRO de la ventana de actualización del BCV (3-6 PM VET), para capturar la tasa nueva tan pronto como se publique.
 * 4. Si la hora actual está DESPUÉS de la ventana de actualización, pero la última actualización en caché fue ANTES de que la ventana comenzara. Esto sirve como un mecanismo de recuperación si el bot estuvo inactivo.
 * 
 * En cualquier otro caso, devuelve `false` para usar el valor del caché.
 * @returns {boolean} - True si se debe realizar una nueva consulta, false si se puede usar el caché.
 */
function shouldFetchNewRates() {
    const now = getVenezuelaTime();
    const currentHour = now.getHours();

    // 1. Si el caché está vacío.
    if (!cache.lastUpdated) {
        console.log("Cache vacío. Se necesita consultar al BCV.");
        return true;
    }

    const lastUpdated = new Date(cache.lastUpdated);
    const lastUpdatedHour = lastUpdated.getHours();

    // 2. Si la fecha del caché es de un día anterior.
    if (now.toDateString() !== lastUpdated.toDateString()) {
        console.log("El caché es de un día anterior. Se necesita consultar al BCV.");
        return true;
    }

    // Si es el mismo día, aplicar lógica de ventana de actualización
    // 3. Si la hora actual está DENTRO de la ventana de actualización del BCV (3-6 PM VET),
    //    se fuerza la consulta para asegurar tener la tasa más reciente.
    const isWithinUpdateWindow = currentHour >= 15 && currentHour < 18; // 3 PM to 5:59 PM
    const wasUpdatedBeforeWindow = lastUpdatedHour < 15; // Before 3 PM

    if (isWithinUpdateWindow) {
        console.log("Dentro de la ventana de actualización. Forzando consulta al BCV.");
        return true;
    }

    // 4. Si la hora actual está DESPUÉS de la ventana de actualización (después de las 6 PM VET),
    //    pero la última actualización en caché fue ANTES de que la ventana comenzara.
    //    Esto sirve como un mecanismo de recuperación si el bot estuvo inactivo.
    const isAfterUpdateWindow = currentHour >= 18; // 6 PM or later
    if (isAfterUpdateWindow && wasUpdatedBeforeWindow) {
        console.log("Después de la ventana de actualización y caché antiguo. Se necesita consultar al BCV (recuperación).");
        return true;
    }

    console.log("Usando valores del caché. No se necesita consultar al BCV.");
    return false;
}

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Extraer valor de la página del BCV (función interna).
 * @param {number} moneda - 0 para euro, 4 para dólar.
 * @returns {Promise<number>} - El valor de la tasa de cambio, o -1 si hay un error.
 */
async function _extraerValorPaginaBCV(moneda) {
  const sURL = "https://www.bcv.org.ve/";
  try {
    const respuesta = await axios.get(sURL, { httpsAgent });
    const html = respuesta.data;
    const $ = cheerio.load(html);
    const div = $('.col-sm-6.col-xs-6.centrado').eq(moneda);
    if (div.length > 0) {
      const sValorCrudo = div.find('strong').first().text();
      const valorLimpio = sValorCrudo.replace(/\./g, '').replace(',', '.');
      const dValorFinal = parseFloat(valorLimpio);
      if (isNaN(dValorFinal)) {
        console.error(`No se pudo convertir el valor a número: "${valorLimpio}"`);
        return -1;
      }
      return Math.round(dValorFinal * 100) / 100;
    } else {
      console.error("No se encontró el elemento para la moneda especificada.");
      return -1;
    }
  } catch (error) {
    console.error("Ocurrió un error en la extracción de la tasa del BCV:", error.message);
    return -1;
  }
}

/**
 * Obtiene las tasas de cambio del BCV, usando un sistema de caché inteligente.
 * @returns {Promise<{dolar: number, euro: number}>}
 */
export async function getBcvRates() {
    if (shouldFetchNewRates()) {
        console.log("Consultando nuevas tasas del BCV...");
        const [dolar, euro] = await Promise.all([
            _extraerValorPaginaBCV(4), // 4 para dólar
            _extraerValorPaginaBCV(0)  // 0 para euro
        ]);

        // Solo actualiza el caché si AMBAS consultas fueron exitosas
        if (dolar && euro && dolar !== -1 && euro !== -1) {
            cache.dolar = dolar;
            cache.euro = euro;
            cache.lastUpdated = getVenezuelaTime().toISOString();

            saveCache(); // Guardar el nuevo caché en el archivo
        } else {
            console.warn("No se pudo actualizar el caché porque una o más consultas al BCV fallaron.");
            if (cache.dolar && cache.euro) {
                console.warn("Devolviendo valores antiguos del caché debido a un error de actualización.");
                return { dolar: cache.dolar, euro: cache.euro, lastUpdated: cache.lastUpdated };
            }
            return { dolar: -1, euro: -1 };
        }
    } else {
        console.log("Devolviendo valores del caché.");
        return { dolar: cache.dolar, euro: cache.euro, lastUpdated: cache.lastUpdated };
    }
    return { dolar: cache.dolar, euro: cache.euro, lastUpdated: cache.lastUpdated };
}