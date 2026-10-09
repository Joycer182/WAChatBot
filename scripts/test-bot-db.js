// Smoke test de la capa de datos operativos del bot (SqliteBotDataSource).
//
// Verifica clientes, vendedores, conversaciones, caché del BCV y estadísticas
// usando una base de datos temporal (NO toca bot.db), sin levantar el bot ni
// escanear el QR.
//
// Uso:
//   node scripts/test-bot-db.js

import fs from 'fs';
import os from 'os';
import path from 'path';
import SqliteBotDataSource from '../src/dataSources/SqliteBotDataSource.js';

const tempDbPath = path.join(os.tmpdir(), `bot-db-test-${Date.now()}.db`);

let passed = 0;
let failed = 0;

function check(descripcion, condicion, extra = '') {
    if (condicion) {
        passed++;
        console.log(`✅ ${descripcion}`);
    } else {
        failed++;
        console.log(`❌ ${descripcion}${extra ? ` (${extra})` : ''}`);
    }
}

async function main() {
    console.log(`🔎 Probando SqliteBotDataSource con base temporal: ${tempDbPath}\n`);

    const ds = new SqliteBotDataSource(tempDbPath);
    const ok = await ds.initialize();
    check('Se conecta y crea las tablas', ok === true);

    try {
        // --- Clientes ---
        await ds.setClientType('584120000000', 'general');
        await ds.setClientType('584121111111', 'instalador');
        check('setClientType + getClientType', (await ds.getClientType('584120000000')) === 'general');
        check('hasClient verdadero', (await ds.hasClient('584120000000')) === true);
        check('hasClient falso', (await ds.hasClient('584999999999')) === false);
        const clients = await ds.getAllClients();
        check('getAllClients devuelve los clientes', clients.size === 2, `size=${clients.size}`);

        // --- Vendedores (solo lectura, tabla vacía) ---
        const vendors = await ds.getAllVendors();
        check('getAllVendors devuelve mapa vacío', vendors instanceof Map && vendors.size === 0);
        check('getVendor alias inexistente → null', (await ds.getVendor('nadie')) === null);
        check('isVendorPhone falso', (await ds.isVendorPhone('584120000000')) === false);

        // --- Conversaciones ---
        await ds.saveConversation({
            telefono: '584120000000', contacto: 'Cliente A', mensaje: 'hola',
            esDelBot: false, tipoMensaje: 'chat', timestamp: new Date().toISOString()
        });
        await ds.saveConversation({
            telefono: '584120000000', contacto: 'Cliente A', mensaje: 'respuesta',
            esDelBot: true, tipoMensaje: 'chat', timestamp: new Date().toISOString()
        });
        const conv = await ds.getConversations('584120000000');
        check('saveConversation + getConversations', conv.length === 2, `length=${conv.length}`);
        const counts = await ds.countConversations();
        check('countConversations', counts.contactosUnicos === 1 && counts.totalMensajes === 2, JSON.stringify(counts));
        const allConv = await ds.getAllConversations();
        check('getAllConversations agrupa por teléfono', Object.keys(allConv).length === 1);

        // --- Caché del BCV ---
        await ds.setBcvCache({ dolar: 36.5, euro: 39.1, lastUpdated: '2026-10-09T00:00:00.000Z' });
        const bcv = await ds.getBcvCache();
        check('setBcvCache + getBcvCache', bcv.dolar === 36.5 && bcv.euro === 39.1, JSON.stringify(bcv));

        // --- Estadísticas ---
        let stats = await ds.getStats();
        check('getStats inicial en cero', stats.totalQuotes === 0 && stats.quoteHistory.length === 0);
        await ds.incrementQuote('codigoQuotes');
        await ds.incrementQuote('codigoQuotes');
        await ds.incrementQuote('divisasQuotes');
        stats = await ds.getStats();
        check('incrementQuote actualiza contadores',
            stats.totalQuotes === 3 && stats.codigoQuotes === 2 && stats.divisasQuotes === 1,
            `total=${stats.totalQuotes}, codigo=${stats.codigoQuotes}, divisas=${stats.divisasQuotes}`);
        check('incrementQuote registra historial', stats.quoteHistory.length === 3);
    } finally {
        await ds.close();
        // Limpiar la base temporal
        for (const suffix of ['', '-wal', '-shm']) {
            const p = `${tempDbPath}${suffix}`;
            if (fs.existsSync(p)) fs.rmSync(p, { force: true });
        }
    }

    console.log(`\nResultado: ${passed} correctas, ${failed} fallidas.`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
    console.error('❌ Error inesperado durante el smoke test:', error);
    process.exit(1);
});
