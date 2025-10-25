import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Script de utilidades para el Bot de WhatsApp
class BotUtils {
    constructor() {
        this.logsDir = path.join(__dirname, 'logs');
        this.conversationsDir = path.join(__dirname, 'conversations');
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

    // Exportar conversaciones
    exportConversations(outputFile = 'conversations_export.json') {
        try {
            if (!fs.existsSync(this.conversationsDir)) {
                console.log('No hay conversaciones para exportar');
                return;
            }

            const files = fs.readdirSync(this.conversationsDir);
            const allConversations = {};

            files.forEach(file => {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.conversationsDir, file);
                    const conversations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    allConversations[file.replace('.json', '')] = conversations;
                }
            });

            fs.writeFileSync(outputFile, JSON.stringify(allConversations, null, 2));
            console.log(`✅ Conversaciones exportadas a ${outputFile}`);
        } catch (error) {
            console.error('❌ Error exportando conversaciones:', error.message);
        }
    }

    // Mostrar estadísticas
    showStats() {
        try {
            console.log('\n📊 ESTADÍSTICAS DEL BOT\n');

            // Estadísticas de logs
            if (fs.existsSync(this.logsDir)) {
                const logFiles = fs.readdirSync(this.logsDir);
                console.log(`📝 Archivos de log: ${logFiles.length}`);
            } else {
                console.log('📝 Archivos de log: 0');
            }

            // Estadísticas de conversaciones
            if (fs.existsSync(this.conversationsDir)) {
                const conversationFiles = fs.readdirSync(this.conversationsDir);
                let totalMessages = 0;
                let uniqueContacts = 0;

                conversationFiles.forEach(file => {
                    if (file.endsWith('.json')) {
                        const filePath = path.join(this.conversationsDir, file);
                        const conversations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                        totalMessages += conversations.length;
                        uniqueContacts++;
                    }
                });

                console.log(`💬 Conversaciones únicas: ${uniqueContacts}`);
                console.log(`📨 Total de mensajes: ${totalMessages}`);
            } else {
                console.log('💬 Conversaciones únicas: 0');
                console.log('📨 Total de mensajes: 0');
            }

            // Estadísticas de sesión
            const sessionDir = path.join(__dirname, '..', '.wwebjs_auth');
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
            const sessionDir = path.join(__dirname, '..', '.wwebjs_auth');
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
    createBackup() {
        try {
            const backupDir = path.join(__dirname, 'backups');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir);
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `backup_${timestamp}`;
            const backupPath = path.join(backupDir, backupName);

            fs.mkdirSync(backupPath);

            // Backup de conversaciones
            if (fs.existsSync(this.conversationsDir)) {
                const conversationsBackup = path.join(backupPath, 'conversations');
                fs.cpSync(this.conversationsDir, conversationsBackup, { recursive: true });
            }

            // Backup de logs
            if (fs.existsSync(this.logsDir)) {
                const logsBackup = path.join(backupPath, 'logs');
                fs.cpSync(this.logsDir, logsBackup, { recursive: true });
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
  node utils.js stats          - Mostrar estadísticas del bot
  node utils.js clean          - Limpiar logs antiguos (7 días)
  node utils.js clean [días]   - Limpiar logs más antiguos que X días
  node utils.js export         - Exportar conversaciones
  node utils.js export [archivo] - Exportar a archivo específico
  node utils.js clear-session  - Limpiar sesión de WhatsApp
  node utils.js backup         - Crear backup completo
  node utils.js help           - Mostrar esta ayuda

Ejemplos:
  node utils.js stats
  node utils.js clean 30
  node utils.js export mis_conversaciones.json
        `);
    }
}

// Ejecutar comando
const command = process.argv[2];
const utils = new BotUtils();

switch (command) {
    case 'stats':
        utils.showStats();
        break;
    case 'clean':
        const days = parseInt(process.argv[3]) || 7;
        utils.cleanOldLogs(days);
        break;
    case 'export':
        const filename = process.argv[3] || 'conversations_export.json';
        utils.exportConversations(filename);
        break;
    case 'clear-session':
        utils.clearSession();
        break;
    case 'backup':
        utils.createBackup();
        break;
    case 'help':
    default:
        utils.showHelp();
        break;
}
