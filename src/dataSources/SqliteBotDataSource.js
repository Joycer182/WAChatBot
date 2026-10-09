// Implementación de BotDataSource usando SQLite (better-sqlite3).
//
// Persiste los datos operativos del bot (antes en archivos JSON) en una única
// base de datos separada de la de productos (LocalJose.db):
//   clientes (tipo de cliente), vendedores, conversaciones, caché del BCV y
//   estadísticas de cotizaciones.
//
// Se abre en modo lectura/escritura y crea las tablas si no existen.

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import BotDataSource from './BotDataSource.js';

export const BOT_DB_DDL = `
CREATE TABLE IF NOT EXISTS clientes (
    telefono        TEXT PRIMARY KEY,
    tipo_cliente    TEXT NOT NULL,
    actualizado_en  TEXT
);

CREATE TABLE IF NOT EXISTS vendedores (
    alias           TEXT PRIMARY KEY,
    telefono        TEXT NOT NULL,
    actualizado_en  TEXT
);

CREATE TABLE IF NOT EXISTS conversaciones (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    telefono        TEXT NOT NULL,
    contacto        TEXT,
    mensaje         TEXT NOT NULL,
    es_del_bot      INTEGER NOT NULL DEFAULT 0,
    tipo_mensaje    TEXT,
    timestamp       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversaciones_telefono_timestamp
    ON conversaciones (telefono, timestamp);

CREATE TABLE IF NOT EXISTS bcv_cache (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    dolar       REAL,
    euro        REAL,
    last_updated TEXT
);

CREATE TABLE IF NOT EXISTS bot_stats (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    total_quotes    INTEGER NOT NULL DEFAULT 0,
    codigo_quotes   INTEGER NOT NULL DEFAULT 0,
    divisas_quotes  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quote_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo        TEXT NOT NULL,
    timestamp   TEXT NOT NULL
);
`;

class SqliteBotDataSource extends BotDataSource {
    constructor(dbFilePath) {
        super();
        this.dbFilePath = dbFilePath;
        this.db = null;
        this.st = {};
    }

    // Abre la base de datos (lectura/escritura), crea las tablas y prepara las consultas.
    async initialize() {
        try {
            const dir = path.dirname(this.dbFilePath);
            if (dir && !fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            this.db = new Database(this.dbFilePath);
            this.db.pragma('journal_mode = WAL');
            this.db.exec(BOT_DB_DDL);

            // Filas únicas con valores por defecto (id = 1).
            this.db.prepare('INSERT OR IGNORE INTO bot_stats (id) VALUES (1)').run();
            this.db.prepare('INSERT OR IGNORE INTO bcv_cache (id) VALUES (1)').run();

            this.st.getClientType = this.db.prepare('SELECT tipo_cliente FROM clientes WHERE telefono = ?');
            this.st.setClientType = this.db.prepare(`
                INSERT INTO clientes (telefono, tipo_cliente, actualizado_en) VALUES (?, ?, ?)
                ON CONFLICT(telefono) DO UPDATE SET
                    tipo_cliente = excluded.tipo_cliente,
                    actualizado_en = excluded.actualizado_en
            `);
            this.st.hasClient = this.db.prepare('SELECT 1 AS x FROM clientes WHERE telefono = ?');
            this.st.getAllClients = this.db.prepare('SELECT telefono, tipo_cliente FROM clientes');

            this.st.getAllVendors = this.db.prepare('SELECT alias, telefono FROM vendedores');
            this.st.getVendor = this.db.prepare('SELECT telefono FROM vendedores WHERE alias = ?');
            this.st.isVendorPhone = this.db.prepare('SELECT 1 AS x FROM vendedores WHERE telefono = ?');

            this.st.saveConversation = this.db.prepare(`
                INSERT INTO conversaciones (telefono, contacto, mensaje, es_del_bot, tipo_mensaje, timestamp)
                VALUES (@telefono, @contacto, @mensaje, @esDelBot, @tipoMensaje, @timestamp)
            `);
            this.st.getConversations = this.db.prepare(`
                SELECT timestamp, contacto, mensaje, es_del_bot AS esDelBot, tipo_mensaje AS tipoMensaje
                FROM conversaciones WHERE telefono = ? ORDER BY id ASC
            `);
            this.st.getAllConversations = this.db.prepare(`
                SELECT telefono, timestamp, contacto, mensaje, es_del_bot AS esDelBot, tipo_mensaje AS tipoMensaje
                FROM conversaciones ORDER BY telefono, id ASC
            `);
            this.st.countConversations = this.db.prepare(`
                SELECT COUNT(*) AS totalMensajes, COUNT(DISTINCT telefono) AS contactosUnicos
                FROM conversaciones
            `);

            this.st.getBcvCache = this.db.prepare('SELECT dolar, euro, last_updated FROM bcv_cache WHERE id = 1');
            this.st.setBcvCache = this.db.prepare(`
                INSERT INTO bcv_cache (id, dolar, euro, last_updated) VALUES (1, @dolar, @euro, @lastUpdated)
                ON CONFLICT(id) DO UPDATE SET
                    dolar = excluded.dolar,
                    euro = excluded.euro,
                    last_updated = excluded.last_updated
            `);

            this.st.getStatsCounters = this.db.prepare(`
                SELECT total_quotes, codigo_quotes, divisas_quotes FROM bot_stats WHERE id = 1
            `);
            this.st.getQuoteHistory = this.db.prepare('SELECT tipo AS type, timestamp FROM quote_history ORDER BY id ASC');
            this.st.incrementCounters = this.db.prepare(`
                UPDATE bot_stats SET
                    total_quotes   = total_quotes + 1,
                    codigo_quotes  = codigo_quotes  + CASE WHEN @tipo = 'codigoQuotes'  THEN 1 ELSE 0 END,
                    divisas_quotes = divisas_quotes + CASE WHEN @tipo = 'divisasQuotes' THEN 1 ELSE 0 END
                WHERE id = 1
            `);
            this.st.insertQuoteHistory = this.db.prepare('INSERT INTO quote_history (tipo, timestamp) VALUES (@tipo, @timestamp)');

            console.log(`✅ Base de datos del bot conectada: ${this.dbFilePath}`);
            return true;
        } catch (error) {
            console.error('❌ Error conectando con la base de datos del bot:', error.message);
            return false;
        }
    }

    // --- Clientes ---
    async getClientType(telefono) {
        if (!this.db) return null;
        const row = this.st.getClientType.get(telefono);
        return row ? row.tipo_cliente : null;
    }

    async setClientType(telefono, tipo) {
        if (!this.db) return;
        this.st.setClientType.run(telefono, tipo, new Date().toISOString());
    }

    async hasClient(telefono) {
        if (!this.db) return false;
        return !!this.st.hasClient.get(telefono);
    }

    async getAllClients() {
        if (!this.db) return new Map();
        const map = new Map();
        for (const row of this.st.getAllClients.all()) {
            map.set(row.telefono, row.tipo_cliente);
        }
        return map;
    }

    // --- Vendedores ---
    async getAllVendors() {
        if (!this.db) return new Map();
        const map = new Map();
        for (const row of this.st.getAllVendors.all()) {
            map.set(row.alias, row.telefono);
        }
        return map;
    }

    async getVendor(alias) {
        if (!this.db) return null;
        const row = this.st.getVendor.get(String(alias).toLowerCase());
        return row ? row.telefono : null;
    }

    async isVendorPhone(telefono) {
        if (!this.db) return false;
        return !!this.st.isVendorPhone.get(telefono);
    }

    // --- Conversaciones ---
    async saveConversation(entry) {
        if (!this.db) return;
        this.st.saveConversation.run({
            telefono: entry.telefono,
            contacto: entry.contacto ?? null,
            mensaje: entry.mensaje ?? '',
            esDelBot: entry.esDelBot ? 1 : 0,
            tipoMensaje: entry.tipoMensaje ?? null,
            timestamp: entry.timestamp
        });
    }

    async getConversations(telefono) {
        if (!this.db) return [];
        return this.st.getConversations.all(telefono);
    }

    async getAllConversations() {
        if (!this.db) return {};
        const grouped = {};
        for (const row of this.st.getAllConversations.all()) {
            const { telefono, ...entry } = row;
            if (!grouped[telefono]) grouped[telefono] = [];
            grouped[telefono].push(entry);
        }
        return grouped;
    }

    async countConversations() {
        if (!this.db) return { contactosUnicos: 0, totalMensajes: 0 };
        return this.st.countConversations.get();
    }

    // --- Caché del BCV ---
    async getBcvCache() {
        if (!this.db) return { dolar: null, euro: null, lastUpdated: null };
        const row = this.st.getBcvCache.get();
        return {
            dolar: row.dolar,
            euro: row.euro,
            lastUpdated: row.last_updated
        };
    }

    async setBcvCache(data) {
        if (!this.db) return;
        this.st.setBcvCache.run({
            dolar: data.dolar,
            euro: data.euro,
            lastUpdated: data.lastUpdated
        });
    }

    // --- Estadísticas del bot ---
    async getStats() {
        if (!this.db) {
            return { totalQuotes: 0, codigoQuotes: 0, divisasQuotes: 0, quoteHistory: [] };
        }
        const counters = this.st.getStatsCounters.get();
        const history = this.st.getQuoteHistory.all();
        return {
            totalQuotes: counters.total_quotes,
            codigoQuotes: counters.codigo_quotes,
            divisasQuotes: counters.divisas_quotes,
            quoteHistory: history
        };
    }

    async incrementQuote(type) {
        if (!this.db) return;
        const timestamp = new Date().toISOString();
        const tx = this.db.transaction(() => {
            this.st.incrementCounters.run({ tipo: type });
            this.st.insertQuoteHistory.run({ tipo: type, timestamp });
        });
        tx();
    }

    async close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log('🔌 Base de datos del bot cerrada.');
        }
    }
}

export default SqliteBotDataSource;
