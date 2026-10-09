import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import SqliteBotDataSource from './dataSources/SqliteBotDataSource.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Script de utilidades para el Bot de WhatsApp
class BotUtils {
    constructor() {
        this.logsDir = path.join(__dirname, 'data', 'logs');
        // La ruta de config.database.dbFilePath es relativa a la raíz del repo.
        this.dbFilePath = path.resolve(__dirname, '..', config.database.dbFilePath);
    }

    // Crear una fuente de datos conectada (o null si falla).
    async _connect() {
        const dataSource = new SqliteBotDataSource(this.dbFilePath);
        const ok = await dataSource.initialize();
        return ok ? dataSource : null;
    }

    // Limpiar logs antiguos
    cleanOldLogs(daysToKeep = 7) {
        try {
            if (!fs.existsSync(this.logsDir)) {
                console.log('No hay logs para limpiar');
                return;
            }

            const files = fs.readdirSync(this.logsDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            let cleanedCount = 0;
            files.forEach(file => {
                const filePath = path.join(this.logsDir, file);
                const stats = fs.statSync(filePath);

                if (stats.mtime < cutoffDate) {
                    fs.unlinkSync(filePath);
                    cleanedCount++;
                }
            });

            console.log(`✅ Limpiados ${cleanedCount} archivos de log antiguos`);
        } catch (error) {
            console.error('❌ Error limpiando logs:', error.message);
        }
    }

    // Exportar conversaciones desde la base de datos
    async exportConversations(outputFile = 'conversations_export.json') {
        const dataSource = await this._connect();
        if (!dataSource) {
            console.error('❌ No se pudo conectar con la base de datos del bot.');
            return;
        }
        try {
            const allConversations = await dataSource.getAllConversations();
            fs.writeFileSync(outputFile, JSON.stringify(allConversations, null, 2));
            console.log(`✅ Conversaciones exportadas a ${outputFile}`);
        } catch (error) {
            console.error('❌ Error exportando conversaciones:', error.message);
        } finally {
            await dataSource.close();
        }
    }

    // Mostrar estadísticas
    async showStats() {
        try {
            console.log('\n📊 ESTADÍSTICAS DEL BOT\n');

            // Estadísticas de logs
            if (fs.existsSync(this.logsDir)) {
                const logFiles = fs.readdirSync(this.logsDir);
                console.log(`📝 Archivos de log: ${logFiles.length}`);
            } else {
                console.log('📝 Archivos de log: 0');
            }

            // Estadísticas de conversaciones (desde la base de datos)
            const dataSource = await this._connect();
            if (dataSource) {
                try {
                    const counts = await dataSource.countConversations();
                    console.log(`💬 Conversaciones únicas: ${counts.contactosUnicos}`);
                    console.log(`📨 Total de mensajes: ${counts.totalMensajes}`);
                } finally {
                    await dataSource.close();
                }
            } else {
                console.log('💬 Conversaciones únicas: 0');
                console.log('📨 Total de mensajes: 0');
            }

            // Estadísticas de sesión
            const sessionDir = path.join(__dirname, 'data', '.wwebjs_auth');
            if (fs.existsSync(sessionDir)) {
                console.log('🔐 Sesión de WhatsApp: Activa');
            } else {
                console.log('🔐 Sesión de WhatsApp: No encontrada');
            }

            console.log('\n');
        } catch (error) {
            console.error('❌ Error mostrando estadísticas:', error.message);
        }
    }

    // Limpiar sesión (útil para problemas de autenticación)
    clearSession() {
        try {
            const sessionDir = path.join(__dirname, 'data', '.wwebjs_auth');
            console.log(sessionDir);
            if (fs.existsSync(sessionDir)) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
                console.log('✅ Sesión de WhatsApp limpiada');
                console.log('⚠️  Necesitarás escanear el QR nuevamente');
            } else {
                console.log('ℹ️  No hay sesión para limpiar');
            }
        } catch (error) {
            console.error('❌ Error limpiando sesión:', error.message);
        }
    }

    // Crear backup
    async createBackup() {
        try {
            const backupDir = path.join(__dirname, 'backups');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir);
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `backup_${timestamp}`;
            const backupPath = path.join(backupDir, backupName);

            fs.mkdirSync(backupPath);

            // Backup de la base de datos del bot
            if (fs.existsSync(this.dbFilePath)) {
                fs.copyFileSync(this.dbFilePath, path.join(backupPath, 'bot.db'));
            }

            // Backup de logs
            if (fs.existsSync(this.logsDir)) {
                fs.cpSync(this.logsDir, path.join(backupPath, 'logs'), { recursive: true });
            }

            console.log(`✅ Backup creado en: ${backupPath}`);
        } catch (error) {
            console.error('❌ Error creando backup:', error.message);
        }
    }

    // Mostrar ayuda
    showHelp() {
        console.log(`
🤖 UTILIDADES DEL BOT DE WHATSAPP

Comandos disponibles:
  node src/utils.js stats          - Mostrar estadísticas del bot
  node src/utils.js clean          - Limpiar logs antiguos (7 días)
  node src/utils.js clean [días]   - Limpiar logs más antiguos que X días
  node src/utils.js export         - Exportar conversaciones
  node src/utils.js export [archivo] - Exportar a archivo específico
  node src/utils.js clear-session  - Limpiar sesión de WhatsApp
  node src/utils.js backup         - Crear backup completo
  node src/utils.js help           - Mostrar esta ayuda

Ejemplos:
  node src/utils.js stats
  node src/utils.js clean 30
  node src/utils.js export mis_conversaciones.json
        `);
    }
}

// Ejecutar comando
async function run() {
    const command = process.argv[2];
    const utils = new BotUtils();

    switch (command) {
        case 'stats':
            await utils.showStats();
            break;
        case 'clean':
            const days = parseInt(process.argv[3]) || 7;
            utils.cleanOldLogs(days);
            break;
        case 'export':
            const filename = process.argv[3] || 'conversations_export.json';
            await utils.exportConversations(filename);
            break;
        case 'clear-session':
            utils.clearSession();
            break;
        case 'backup':
            await utils.createBackup();
            break;
        case 'help':
        default:
            utils.showHelp();
            break;
    }
}

await run();
