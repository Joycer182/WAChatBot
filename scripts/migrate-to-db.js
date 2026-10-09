// Migración única de los datos JSON históricos del bot a la base de datos SQLite.
//
// Importa (una sola vez) desde:
//   src/data/client_data.json      -> tabla clientes
//   src/data/vendedores.json       -> tabla vendedores
//   src/data/conversations/*.json  -> tabla conversaciones
//   src/data/bcv_cache.json        -> tabla bcv_cache
//   src/data/bot_stats.json        -> tablas bot_stats y quote_history
//
// Uso:
//   node scripts/migrate-to-db.js
//
// Es idempotente: clientes/vendedores usan INSERT OR IGNORE; conversaciones y
// quote_history solo se importan si están vacías. No borra los archivos JSON.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { BOT_DB_DDL } from '../src/dataSources/SqliteBotDataSource.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const dataDir = path.join(repoRoot, 'src', 'data');
const dbFilePath = path.resolve(repoRoot, process.env.BOT_DB_PATH || 'src/data/bot.db');

function readJson(relativePath) {
    const fullPath = path.join(dataDir, relativePath);
    if (!fs.existsSync(fullPath)) return null;
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function main() {
    console.log(`🔀 Migrando datos JSON a: ${dbFilePath}\n`);

    const db = new Database(dbFilePath);
    db.exec(BOT_DB_DDL);
    db.prepare('INSERT OR IGNORE INTO bot_stats (id) VALUES (1)').run();
    db.prepare('INSERT OR IGNORE INTO bcv_cache (id) VALUES (1)').run();

    // --- Clientes ---
    const clients = readJson('client_data.json');
    if (clients) {
        const stmt = db.prepare('INSERT OR IGNORE INTO clientes (telefono, tipo_cliente) VALUES (?, ?)');
        const insert = db.transaction((rows) => rows.forEach(([t, c]) => stmt.run(t, c)));
        insert(Object.entries(clients));
        console.log(`✅ Clientes: ${Object.keys(clients).length} registrados.`);
    } else {
        console.log('ℹ️  No se encontró client_data.json.');
    }

    // --- Vendedores ---
    const vendors = readJson('vendedores.json');
    if (vendors) {
        const stmt = db.prepare('INSERT OR IGNORE INTO vendedores (alias, telefono) VALUES (?, ?)');
        const insert = db.transaction((rows) => rows.forEach(([a, t]) => stmt.run(String(a).toLowerCase(), t)));
        insert(Object.entries(vendors));
        console.log(`✅ Vendedores: ${Object.keys(vendors).length} registrados.`);
    } else {
        console.log('ℹ️  No se encontró vendedores.json.');
    }

    // --- Conversaciones ---
    const conversationsDir = path.join(dataDir, 'conversations');
    const existingConversations = db.prepare('SELECT COUNT(*) AS c FROM conversaciones').get().c;
    if (existingConversations > 0) {
        console.log('ℹ️  La tabla conversaciones ya tiene datos; se omite la importación.');
    } else if (fs.existsSync(conversationsDir)) {
        const files = fs.readdirSync(conversationsDir).filter(f => f.endsWith('.json'));
        const stmt = db.prepare(`
            INSERT INTO conversaciones (telefono, contacto, mensaje, es_del_bot, tipo_mensaje, timestamp)
            VALUES (@telefono, @contacto, @mensaje, @esDelBot, @tipoMensaje, @timestamp)
        `);
        let total = 0;
        const importFile = db.transaction((entries) => {
            for (const e of entries) stmt.run(e);
        });
        for (const file of files) {
            const telefono = file.replace('.json', '');
            const entries = JSON.parse(fs.readFileSync(path.join(conversationsDir, file), 'utf8'));
            const rows = entries.map(e => ({
                telefono,
                contacto: e.contact ?? null,
                mensaje: e.message ?? '',
                esDelBot: e.isFromBot ? 1 : 0,
                tipoMensaje: e.messageType ?? null,
                timestamp: e.timestamp
            }));
            importFile(rows);
            total += rows.length;
        }
        console.log(`✅ Conversaciones: ${total} mensajes importados desde ${files.length} archivos.`);
    } else {
        console.log('ℹ️  No se encontró la carpeta de conversaciones.');
    }

    // --- Caché del BCV ---
    const bcv = readJson('bcv_cache.json');
    if (bcv && bcv.lastUpdated) {
        const current = db.prepare('SELECT last_updated FROM bcv_cache WHERE id = 1').get();
        if (!current.last_updated) {
            db.prepare('UPDATE bcv_cache SET dolar = ?, euro = ?, last_updated = ? WHERE id = 1')
                .run(bcv.dolar, bcv.euro, bcv.lastUpdated);
            console.log('✅ Caché del BCV: importado.');
        } else {
            console.log('ℹ️  La caché del BCV ya tiene datos; se omite.');
        }
    } else {
        console.log('ℹ️  No se encontró bcv_cache.json.');
    }

    // --- Estadísticas del bot ---
    const stats = readJson('bot_stats.json');
    if (stats) {
        db.prepare(`
            INSERT INTO bot_stats (id, total_quotes, codigo_quotes, divisas_quotes)
            VALUES (1, @total, @codigo, @divisas)
            ON CONFLICT(id) DO UPDATE SET
                total_quotes  = excluded.total_quotes,
                codigo_quotes = excluded.codigo_quotes,
                divisas_quotes = excluded.divisas_quotes
        `).run({ total: stats.totalQuotes || 0, codigo: stats.codigoQuotes || 0, divisas: stats.divisasQuotes || 0 });

        const existingHistory = db.prepare('SELECT COUNT(*) AS c FROM quote_history').get().c;
        const history = Array.isArray(stats.quoteHistory) ? stats.quoteHistory : [];
        if (existingHistory === 0 && history.length > 0) {
            const stmt = db.prepare('INSERT INTO quote_history (tipo, timestamp) VALUES (?, ?)');
            const insert = db.transaction((rows) => rows.forEach(h => stmt.run(h.type, h.timestamp)));
            insert(history);
            console.log(`✅ Estadísticas: contadores importados y ${history.length} registros de historial.`);
        } else {
            console.log(`✅ Estadísticas: contadores importados (historial ya existente, se omite).`);
        }
    } else {
        console.log('ℹ️  No se encontró bot_stats.json.');
    }

    db.close();
    console.log('\n✅ Migración completada.');
}

main();
