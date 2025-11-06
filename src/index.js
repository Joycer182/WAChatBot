import 'dotenv/config'; // Carga las variables de entorno desde .env

import whatsapp from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = whatsapp;
import qrcode from 'qrcode-terminal';
import express from 'express';
import cors from 'cors'; // 1. Importar la librería
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import ProductManager from './productManager.js';
import CommandManager from './commandManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración del servidor Express
const app = express();
const PORT = config.bot.port;

// 2. Configurar CORS de forma segura y flexible
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || config.bot.corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Acceso no permitido por CORS'));
    }
  }
};
app.use(cors(corsOptions));


// Middleware para parsear JSON
app.use(express.json());

// Crear cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: path.join(__dirname, 'data', '.wwebjs_auth')
    }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Variables globales para el estado del bot
let isReady = false;
let qrCodeGenerated = false;
let botStartupTimestamp = null; // Para ignorar mensajes antiguos al iniciar
const sentMessagesToVendors = new Set(); // Para ignorar mensajes enviados a vendedores

// Inicializar gestor de comandos
let productManager;
let commandManager;

// Función para generar logs
function logMessage(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;
    
    // Crear directorio de logs si no existe
    const logsDir = path.join(__dirname, 'data', 'logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir);
    }
    
    // Escribir log
    fs.appendFileSync(path.join(logsDir, 'chatbot.log'), logEntry);
    console.log(logEntry.trim());
}

// Función para guardar conversaciones
function saveConversation(contact, message, isFromBot = false) {
    // Respetar la configuración global para guardar conversaciones
    if (!config.bot.logConversations) return;

    const timestamp = new Date().toISOString();
    const conversationEntry = {
        timestamp,
        contact: contact.pushname || contact.number, // Usar pushname para consistencia
        message: message.body,
        isFromBot,
        messageType: message.type
    };
    
    const conversationsDir = path.join(__dirname, 'data', 'conversations');
    if (!fs.existsSync(conversationsDir)) {
        fs.mkdirSync(conversationsDir);
    }
    
    const conversationFile = path.join(conversationsDir, `${contact.number.replace('+', '')}.json`);
    
    let conversations = [];
    if (fs.existsSync(conversationFile)) {
        conversations = JSON.parse(fs.readFileSync(conversationFile, 'utf8'));
    }
    
    conversations.push(conversationEntry);
    fs.writeFileSync(conversationFile, JSON.stringify(conversations, null, 2));
}

// Función para respuestas automáticas inteligentes
function getAutoResponse(message, contact) {
    const text = message.body.toLowerCase();
    
    // Saludos
    if (config.palabrasClave.saludos.some(keyword => text.includes(keyword))) {
        return config.mensajes.saludo.replace('cliente', contact.pushname || 'cliente');
    }
    
    // Despedidas
    if (config.palabrasClave.despedidas.some(keyword => text.includes(keyword))) {
        return config.mensajes.despedida;
    }
    
    // Consultas sobre precios
    if (config.palabrasClave.precios.some(keyword => text.includes(keyword))) {
        return `💰 *Información de Precios*

Para obtener información detallada sobre precios, puedes:

• Escribir */precio* para ver información general

• Usar */precio [Código del Producto]* para consultar un producto por código

• Usar */buscar [término]* - Buscar productos específicos según un término`;
    }
    
    // Consultas sobre productos
    if (config.palabrasClave.productos.some(keyword => text.includes(keyword))) {
        return `🛍️ *Nuestros Productos*

Escribe */productos* para ver información completa del catálogo.

También puedes:
/buscar *[término]* - Buscar productos específicos

/precio *[código]* - Consultar producto por código`;
    }
    
    // Consultas sobre horarios
    if (config.palabrasClave.horarios.some(keyword => text.includes(keyword))) {
        return `🕒 *Horarios de Atención*

Escribe /horarios para ver nuestros horarios completos.

*Respuesta rápida:*
${config.horarios.lunesViernes} (Lunes a Viernes)
${config.horarios.sabados} (Sábados)
${config.horarios.domingos} (Domingos)

¿Necesitas atención fuera de estos horarios?`;
    }
    
    // Problemas o quejas
    if (config.palabrasClave.problemas.some(keyword => text.includes(keyword))) {
        return `🛠️ *Soporte Técnico*

Lamento escuchar que tienes un problema. Para ayudarte mejor:

1️⃣ Describe el problema detalladamente
2️⃣ Menciona cuándo comenzó
3️⃣ Si es posible, envía capturas de pantalla y algún video.

Escribe a tu vendedor para más información.`;
    }
    
    // Búsquedas
    if (config.palabrasClave.busqueda.some(keyword => text.includes(keyword))) {
        return `🔍 *Búsqueda de Productos*

Para buscar productos específicos, puedes usar:

/buscar [término] - Buscar por nombre o descripción

/productos - Ver información del catálogo

/precio *[código]* - Consultar producto por código

*Ejemplo:* /buscar breaker 2x20A`;
    }
    
    return null;
}

// Eventos del cliente WhatsApp
client.on('qr', (qr) => {
    if (!qrCodeGenerated) {
        console.log('\n🔗 Escanea este código QR con WhatsApp:');

        qrcode.generate(qr, { small: true });

        qrCodeGenerated = true;
        logMessage('Código QR generado para autenticación');
    }
});

client.on('ready', () => {
    isReady = true;
    console.log('\n✅ ¡Bot de WhatsApp listo!');
    logMessage('Bot iniciado y listo para recibir mensajes');
});

client.on('authenticated', () => {
    // Guardar el momento exacto de la autenticación para ignorar mensajes antiguos.
    // Esto se hace aquí porque es el primer punto seguro antes de que el bot empiece a recibir mensajes.
    botStartupTimestamp = Date.now();
    console.log('\n🔐 Autenticación exitosa');
    logMessage('Cliente autenticado correctamente');
});

client.on('auth_failure', (msg) => {
    console.error('\n❌ Error de autenticación:', msg);
    logMessage(`Error de autenticación: ${msg}`, 'error');
});

client.on('disconnected', (reason) => {
    isReady = false;
    console.log('\n📱 Cliente desconectado:', reason);
    logMessage(`Cliente desconectado: ${reason}`, 'warn');
});

// Manejo de mensajes
client.on('message', async (message) => {
    // Ignorar mensajes de estado
    if (message.isStatus) {
        return;
    }

    try {
        // Ignorar mensajes que el bot acaba de enviar a un vendedor
        if (sentMessagesToVendors.has(message.id._serialized)) {
            logMessage(`Ignorando eco de mensaje enviado a vendedor: ${message.id._serialized}`, 'info');
            sentMessagesToVendors.delete(message.id._serialized); // Limpiar el set
            return;
        }

        // Ignorar mensajes antiguos recibidos antes de que el bot estuviera listo
        if (botStartupTimestamp && (message.timestamp * 1000) < botStartupTimestamp) {
            logMessage(`Ignorando mensaje antiguo de ${message.from}`, 'info');
            return;
        }

        // Ignorar mensajes del bot mismo
        if (message.fromMe) return;
        
        // Ignorar mensajes de grupos por ahora
        if (message.from.includes('@g.us')) return;
        
        // Asegurarse de que los managers estén listos
        if (!commandManager || !productManager) {
            logMessage('Managers no inicializados. Ignorando mensaje.', 'warn');
            return;
        }

        const contact = await message.getContact();
        logMessage(`Mensaje recibido de ${contact.pushname || contact.number}: ${message.body}`);

        // --- NUEVA LÓGICA: Mensaje de bienvenida para nuevos clientes ---
        const isNewClient = !commandManager.clientStates.has(contact.number);
        if (isNewClient) {
            const welcomeMessage = config.mensajes.saludo.replace('cliente', contact.pushname || 'cliente');
            await message.reply(welcomeMessage);
            logMessage(`Mensaje de bienvenida enviado a nuevo cliente: ${contact.pushname || contact.number}`);

            // Establecer el tipo de cliente por defecto y guardarlo usando el nuevo método
            commandManager.setClientType(contact.number, config.productos.defaultClientType);
        }
        // --- FIN NUEVA LÓGICA ---
        
        // Guardar conversación
        saveConversation(contact, message, false);
        
        let response;
        
        // Procesar comandos primero
        if (message.body.startsWith('/')) {
            response = await commandManager.processCommand(message, contact);
            // Si el comando devolvió un ID de mensaje (porque envió algo a un vendedor)
            if (response && typeof response === 'object' && response.sentMessageId) {
                sentMessagesToVendors.add(response.sentMessageId);
                logMessage(`Registrando mensaje enviado a vendedor para ignorar eco: ${response.sentMessageId}`, 'info');
                response = response.response; // Usar solo el texto de la respuesta para el cliente
            }
        } else {
            // Respuestas automáticas
            response = getAutoResponse(message, contact);
        }
        
        // Si no hay respuesta, usar el mensaje por defecto
        if (response === null || response === undefined) {
            // Si no se entiende el mensaje, mostrar la ayuda directamente.
            const helpMessage = await commandManager.handleHelp([], contact);
            response = `${config.mensajes.noEntendido}\n\n${helpMessage}`;
        }

        let botMessageBody = '';

        // Manejar diferentes tipos de respuesta (texto, media, objeto con respuesta)
        if (typeof response === 'object' && response.media) {
            // Es un objeto con media y caption (para /foto)
            await message.reply(response.media, undefined, { caption: response.caption });
            botMessageBody = `[Imagen: ${response.caption}]`;
        } else if (typeof response === 'string') {
            // Es una respuesta de texto simple
            await message.reply(response);
            botMessageBody = response;
        } else {
            // Otro tipo de objeto (como el de /enviar) que ya fue manejado
            botMessageBody = response; // Ya es un string
        }

        logMessage(`Respuesta enviada a ${contact.pushname || contact.number}`);
        // Guardar respuesta del bot
        const botMessage = {
            body: botMessageBody,
            type: 'text'
        };
        saveConversation(contact, botMessage, true);
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        logMessage(`Error procesando mensaje: ${error.message}`, 'error');
    }
});

// Rutas de la API REST
app.get('/', (req, res) => {
    res.json({
        status: 'Bot de WhatsApp Activo',
        ready: isReady,
        timestamp: new Date().toISOString()
    });
});

app.get('/status', (req, res) => {
    res.json({
        botReady: isReady,
        qrGenerated: qrCodeGenerated,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/products', (req, res) => {
    try {
        const stats = productManager.getStats();
        res.json({
            stats: stats,
            products: productManager.getAllProductsForClient('general').slice(0, 50), // Limitar a 50 productos
            categories: productManager.getCategories()
        });
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo productos' });
    }
});

app.get('/products/search/:query', (req, res) => {
    try {
        const query = req.params.query;
        const results = productManager.searchProducts(query);
        res.json({
            query: query,
            results: results.slice(0, 20), // Limitar a 20 resultados
            total: results.length
        });
    } catch (error) {
        res.status(500).json({ error: 'Error buscando productos' });
    }
});

// Función principal de inicialización
async function main() {
    console.log('🔄 Inicializando el bot...');

    // Verificar y crear vendedores.json si no existe
    const vendedoresFilePath = path.join(__dirname, 'data', 'vendedores.json');
    if (!fs.existsSync(vendedoresFilePath)) {
        console.log('📝 Creando archivo vendedores.json...');
        fs.writeFileSync(vendedoresFilePath, '{}', 'utf8');
        logMessage('Archivo vendedores.json creado.');
    }


    // 1. Inicializar ProductManager con la configuración
    productManager = new ProductManager(config);

    // 2. Cargar productos desde Excel
    await productManager.loadProducts();

    // 3. Inicializar CommandManager, pasándole la instancia de productManager y la ruta del archivo de vendedores
    commandManager = new CommandManager(productManager, client, vendedoresFilePath);

    // 4. Iniciar el servidor Express
    app.listen(PORT, () => {
        console.log(`\n🚀 Servidor iniciado en puerto ${PORT}`);
        console.log(`📊 Panel de estado: http://localhost:${PORT}/status`);
        logMessage(`Servidor iniciado en puerto ${PORT}`);
    });

    // 5. Inicializar el cliente de WhatsApp
    client.initialize();
}


// --- Manejo de cierre graceful ---
process.on('SIGINT', async () => {
    console.log('\n🛑 Cerrando bot...');
    logMessage('Bot cerrando por solicitud del usuario');
    
    try {
        await client.destroy();
        process.exit(0);
    } catch (error) {
        console.error('Error cerrando cliente:', error);
        process.exit(1);
    }
});

// --- Iniciar la aplicación ---
main();

export { client, app };
