import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import whatsapp from 'whatsapp-web.js';
import config from './config.js';
import { getBcvRates, setManualRates } from './bcvScraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CommandManager {
    constructor(productManager, client, vendedoresFilePath) {
        this.commands = new Map();
        this.productManager = productManager; // Usar la instancia pasada
        this.client = client; // Guardar la instancia del cliente de WhatsApp
        this.clientStatesFilePath = path.join(__dirname, 'data', 'client_data.json');
        this.clientStates = this._loadClientStates(); // Carga los estados desde el archivo
        this.statsFilePath = path.join(__dirname, 'data', 'bot_stats.json');
        this.botStats = this._loadBotStats(); // Carga las estadísticas del bot
        this.vendedoresFilePath = vendedoresFilePath; // Usar la ruta pasada como argumento
        this.vendedores = this._loadVendedores(); // Carga los vendedores desde el archivo
        this.pendingApprovals = new Map(); // Almacena solicitudes de cambio de tipo de cliente pendientes
        this.lastQuote = new Map(); // Almacena la última cotización por número de contacto
        this.MAX_QUOTE_QUANTITY = parseInt(process.env.MAX_QUOTE_QUANTITY, 10) || 1000; // Límite para diferenciar cantidad de código
        this.clientTypes = {
            GENERAL: process.env.CLIENT_TYPE_GENERAL || 'general',
            TIENDA: process.env.CLIENT_TYPE_TIENDA || 'tienda',
            INSTALADOR: process.env.CLIENT_TYPE_INSTALADOR || 'instalador'
        };
        this.initializeCommands();
    }

    // Cargar los estados de los clientes desde un archivo JSON
    _loadClientStates() {
        try {
            if (fs.existsSync(this.clientStatesFilePath)) {
                const data = fs.readFileSync(this.clientStatesFilePath, 'utf8');
                const clientStatesObject = JSON.parse(data);
                console.log('Tipos de cliente cargados desde archivo.');
                return new Map(Object.entries(clientStatesObject));
            } else {
                console.log('No se encontró archivo de tipos de cliente. Se creará uno nuevo al primer uso.');
                return new Map();
            }
        } catch (error) {
            console.error('Error al cargar los tipos de cliente, iniciando con un mapa vacío:', error);
            return new Map(); // En caso de error, empezar de cero para no bloquear el bot.
        }
    }

    // Cargar los vendedores desde un archivo JSON
    _loadVendedores() {
        try {
            if (fs.existsSync(this.vendedoresFilePath)) {
                const data = fs.readFileSync(this.vendedoresFilePath, 'utf8');
                const vendedoresObject = JSON.parse(data);
                // Convertir todas las claves (nombres de vendedores) a minúsculas para una búsqueda insensible a mayúsculas/minúsculas
                const lowerCaseVendedores = Object.entries(vendedoresObject).map(([key, value]) => [key.toLowerCase(), value]);
                console.log('Vendedores cargados desde archivo.');
                return new Map(lowerCaseVendedores);
            } else {
                console.warn('No se encontró archivo de vendedores (src/data/vendedores.json). La función /enviar no funcionará.');
                return new Map();
            }
        } catch (error) {
            console.error('Error al cargar los vendedores, iniciando con un mapa vacío:', error);
            return new Map();
        }
    }

    // Cargar estadísticas del bot desde un archivo JSON
    _loadBotStats() {
        try {
            if (fs.existsSync(this.statsFilePath)) {
                const data = fs.readFileSync(this.statsFilePath, 'utf8');
                const stats = JSON.parse(data);
                // Asegurarse de que todas las claves necesarias existan para evitar errores de NaN
                stats.totalQuotes = stats.totalQuotes || 0;
                stats.codigoQuotes = stats.codigoQuotes || 0;
                stats.divisasQuotes = stats.divisasQuotes || 0;
                stats.quoteHistory = stats.quoteHistory || []; // Asegurar que el historial exista
                console.log('Estadísticas del bot cargadas desde archivo.');
                return stats;
            } else {
                console.log('No se encontró archivo de estadísticas. Se creará uno nuevo.');
                return { totalQuotes: 0, codigoQuotes: 0, divisasQuotes: 0, quoteHistory: [] };
            }
        } catch (error) {
            console.error('Error al cargar las estadísticas del bot, iniciando con valores por defecto:', error);
            return { totalQuotes: 0, codigoQuotes: 0, divisasQuotes: 0, quoteHistory: [] };
        }
    }

    // Guardar los estados de los clientes en el archivo JSON
    _saveClientStates() {
        try {
            const clientStatesObject = Object.fromEntries(this.clientStates);
            fs.writeFileSync(this.clientStatesFilePath, JSON.stringify(clientStatesObject, null, 2));
        } catch (error) {
            console.error('Error al guardar los tipos de cliente:', error);
        }
    }

    // Guardar las estadísticas del bot en el archivo JSON
    _saveBotStats() {
        try {
            fs.writeFileSync(this.statsFilePath, JSON.stringify(this.botStats, null, 2));
        } catch (error) {
            console.error('Error al guardar las estadísticas del bot:', error);
        }
    }

    // Incrementar el contador de cotizaciones
    _incrementQuoteCount(type) {
        this.botStats.totalQuotes = (this.botStats.totalQuotes || 0) + 1;
        if (type) {
            this.botStats[type] = (this.botStats[type] || 0) + 1;
            // Agregar registro al historial con marca de tiempo
            this.botStats.quoteHistory.push({
                type: type,
                timestamp: new Date().toISOString()
            });
        }
        this._saveBotStats();
        const typeCount = type ? this.botStats[type] : 'N/A';
        console.log(`📈 Cotización registrada. Total: ${this.botStats.totalQuotes}. Tipo: ${type || 'N/A'}. Total por tipo: ${typeCount}`);
    }

    // Helper para enviar mensajes de forma segura
    async sendMessageSafe(chatId, content, options = {}) {
        try {
            return await this.client.sendMessage(chatId, content, { linkPreview: false, ...options });
        } catch (error) {
            if (error.message && (error.message.includes('markedUnread') || error.message.includes('Evaluation failed'))) {
                console.log(`Advertencia: Error conocido '${error.message}' ignorado. Se asume enviado.`);
                // Devolvemos un objeto mock para evitar que el código que espera 'id._serialized' falle
                return { id: { _serialized: `mock_msg_${Date.now()}` } };
            }
            throw error;
        }
    }

    // Inicializar todos los comandos
    initializeCommands() {
        this.registerCommand('help', this.handleHelp.bind(this));
        this.registerCommand('ayuda', this.handleHelp.bind(this));

        this.registerCommand('info', this.handleInfo.bind(this));
        this.registerCommand('informacion', this.handleInfo.bind(this));

        this.registerCommand('horario', this.handleHorarios.bind(this));
        this.registerCommand('horarios', this.handleHorarios.bind(this));

        this.registerCommand('producto', this.handleProductos.bind(this));
        this.registerCommand('productos', this.handleProductos.bind(this));

        this.registerCommand('categorías', this.handleCategorias.bind(this));
        this.registerCommand('categoría', this.handleCategorias.bind(this));
        this.registerCommand('categorias', this.handleCategorias.bind(this));
        this.registerCommand('categoria', this.handleCategorias.bind(this));

        this.registerCommand('buscar', this.handleBuscar.bind(this));
        this.registerCommand('search', this.handleBuscar.bind(this));

        // El comando principal para precios y cotizaciones ahora es /precio
        this.registerCommand('precio', this.handlePrecio.bind(this));
        this.registerCommand('precios', this.handlePrecio.bind(this));

        // El comando /codigo ahora muestra información general sobre precios (lo que antes hacía /precios)
        this.registerCommand('codigo', this.handleCodigoInfo.bind(this));
        this.registerCommand('código', this.handleCodigoInfo.bind(this));

        // Comandos de tipo de cliente (dinámicos desde .env)
        this.registerCommand(this.clientTypes.TIENDA.toLowerCase(), this.handleTienda.bind(this));
        this.registerCommand(this.clientTypes.INSTALADOR.toLowerCase(), this.handleInstalador.bind(this));
        this.registerCommand(this.clientTypes.GENERAL.toLowerCase(), this.handleGeneral.bind(this));

        // Comandos de administración
        this.registerCommand('stats', this.handleStats.bind(this));

        this.registerCommand('divisa', this.handleDivisas.bind(this));
        this.registerCommand('divisas', this.handleDivisas.bind(this));

        this.registerCommand('enviar', this.handleEnviar.bind(this));

        this.registerCommand('foto', this.handleFoto.bind(this));
        this.registerCommand('imagen', this.handleFoto.bind(this));

        // Registrar comandos de aprobación/rechazo para vendedores (movido dentro de initializeCommands)
        this.registerCommand('aprobar', this.handleAprobar.bind(this));
        this.registerCommand('rechazar', this.handleRechazar.bind(this));

        this.registerCommand('bcv', this.handleBcv.bind(this));
        this.registerCommand('actualizarbcv', this.handleActualizarBcv.bind(this));

        // Nuevo comando para precios generales
        this.registerCommand('preciog', this.handlePrecioGeneral.bind(this));
    }

    // Registrar un comando
    registerCommand(command, handler) {
        this.commands.set(command.toLowerCase(), handler);
    }

    // Procesar comando
    async processCommand(message, contact) {
        const parts = message.body.trim().split(' ');
        const command = parts[0].substring(1).toLowerCase(); // Eliminar el "/" del inicio
        const args = parts.slice(1);

        const handler = this.commands.get(command);
        if (handler) {
            return await handler(args, contact);
        }

        // Si el comando no se encuentra, devuelve la ayuda directamente, pero con un mensaje de error.
        // Se utiliza una copia del manejador de ayuda para evitar un bucle si /ayuda no existiera.
        const helpMessage = await this.handleHelp([], contact); // Llama al manejador de ayuda
        return `❌ *Comando no reconocido*.\n\n${helpMessage}`; // Combina el mensaje de error con la ayuda
    }

    // Obtener tipo de cliente desde el contexto (puede ser mejorado con base de datos)
    getClientType(contact) {
        if (this.clientStates.has(contact.number)) {
            return this.clientStates.get(contact.number);
        }
        // Retorna el tipo de cliente por defecto si no se ha establecido uno
        return config.productos.defaultClientType;
    }

    // Verificar si un contacto es un vendedor
    isVendedor(contact) {
        return Array.from(this.vendedores.values()).includes(contact.number);
    }

    // Comando de ayuda
    async handleHelp(args, contact) {
        const clientType = this.getClientType(contact);

        let response = `🤖 *Bot de Atención al Cliente*

*Comandos generales:*
*/ayuda* - Muestra este menú
*/info* - Información de contacto
*/horarios* - Horarios de atención
*/bcv* - Muestra la tasa de cambio del BCV

*Comandos de productos:*
*/precio [código]* - Información y cotización de producto(s)

*/buscar [término]* - Buscar productos específicos según un término`;

        // Documentación adicional exclusiva para INSTALADORES
        if (clientType === this.clientTypes.INSTALADOR) {
            response += `\n\n*Herramienta de Reventa (Instalador):*
Puedes agregar un porcentaje de ganancia a tus cotizaciones.
*Uso:* /precio [Ganancia]% [Código] [Cantidad]
*Ejemplo:* /precio 15% 11050 1 (Suma 15% al costo)`;
        }

        response += `\n\n*Ejemplos:*
• /buscar breaker
• /precio 11050`;

        return response;
    }

    // Comando de información
    async handleInfo(args, contact) {
        return `📞 *Información de Contacto*

🏢 *Empresa:* ${config.empresa.nombre}

📧 *Email:* ${config.empresa.email}

🌐 *Web:* ${config.empresa.web}

📍 *Dirección:* ${config.empresa.direccion}

*Horarios de atención:*
*Lunes a Viernes:* ${config.horarios.lunesViernes}
*Sábados:* ${config.horarios.sabados}
*Domingos:* ${config.horarios.domingos}`;
    }

    // Comando de horarios
    async handleHorarios(args, contact) {
        return `🕒 *Horarios de Atención*

*Lunes a Viernes:* ${config.horarios.lunesViernes}
*Sábados:* ${config.horarios.sabados}
*Domingos:* ${config.horarios.domingos}`;
    }

    // Comando de productos
    async handleProductos(args, contact) {
        const clientType = this.getClientType(contact);
        const stats = this.productManager.getStats();

        return `🛍️ *Catálogo de Productos* *v${process.env.CATALOG_VERSION || '1.0'}*

📊 *Estadísticas:*
• Total de productos: ${stats.totalProductos}
• Categorías disponibles: ${stats.categorias}

*Comandos útiles:*
/buscar *término* - Buscar productos específicos según un término

/precio *código* - Ver producto por código`;
    }

    // Comando de categorías
    async handleCategorias(args, contact) {
        const categories = this.productManager.getCategories();

        if (categories.length === 0) {
            return `📂 *Categorías de Productos*

No hay categorías disponibles en este momento.

Usa /productos para ver más información.`;
        }

        let response = `📂 *Categorías de Productos*\n\n`;
        categories.forEach((category, index) => {
            response += `${index + 1}️⃣ *${category}*\n`;
        });

        response += `\n*Para ver productos de una categoría:*
/buscar *Nombre de Categoría*

*Ejemplo:* /buscar protectores`;

        return response;
    }

    // Comando de búsqueda
    async handleBuscar(args, contact) {
        if (args.length === 0) {
            return `🔍 *Búsqueda de Productos*

Para buscar productos, escribe:
/buscar *término de búsqueda*

*Ejemplos:*
/buscar breaker
/buscar protector
/buscar wifi`;
        }

        const clientType = this.getClientType(contact);
        const searchTerm = args.join(' ');

        // Función para normalizar texto (eliminar acentos y convertir a minúsculas)
        const normalizeText = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

        // Búsqueda mejorada: permite palabras en cualquier orden
        const searchTerms = args.filter(arg => arg.trim() !== '').map(term => normalizeText(term));
        const allProducts = this.productManager.getAllProductsForClient(clientType);

        const results = allProducts.filter(product => {
            const textToSearch = normalizeText(`${product.codigo} ${product.descripcion}`);
            return searchTerms.every(term => textToSearch.includes(term));
        });

        if (results.length === 0) {
            return `🔍 *Búsqueda: "${searchTerm}"*

No se encontraron productos que coincidan con tu búsqueda.

*Sugerencias:*
• Verifica la ortografía
• Usa términos más generales
• Usa /categorias para ver las categorías de los productos disponibles`;
        }

        let response = `🔍 *Búsqueda: "${searchTerm}"*\n\n`;
        response += `*Encontrados ${results.length} producto(s):*\n\n`;

        results.slice(0, 20).forEach((product, index) => {
            const productInfo = this.productManager.getProductInfo(product, clientType);
            response += `${index + 1}️⃣ *${productInfo.codigo}* - ${productInfo.descripcion}\n`;
            response += `💰 ${productInfo.precio}\n\n`;
        });

        if (results.length > 20) {
            response += `... y ${results.length - 20} producto(s) más.\n\n`;
        }

        response += `*Para ver detalles completos:*
/precio [código del producto]`;

        return response;
    }

    // Manejador para cotizaciones de múltiples productos (puede recibir un tipo de cliente forzado)
    async _handleMultiProductQuote(args, contact, clientTypeOverride = null) {
        const clientType = clientTypeOverride || this.getClientType(contact);
        let commissionMultiplier = 1.0;
        let processedArgs = [...args]; // Trabajar sobre una copia para no modificar el original directamente

        // --- Lógica para comisión de instalador ---
        if (processedArgs.length > 0 && processedArgs[0].endsWith('%')) {
            // Solo los instaladores pueden usar esta función
            if (clientType === this.clientTypes.INSTALADOR) {
                const percentageStr = processedArgs[0].slice(0, -1);
                const percentage = parseFloat(percentageStr);
                if (!isNaN(percentage) && percentage > 0) {
                    commissionMultiplier = 1 + (percentage / 100);
                    console.log(`Aplicando comisión del ${percentage}% para instalador ${contact.number}. Multiplicador: ${commissionMultiplier}`);
                }
            }
            // Se remueve el argumento de porcentaje para que no sea procesado como un código de producto.
            // Para no-instaladores, esto simplemente lo ignora.
            processedArgs.shift();
        }
        // Limpiar argumentos, eliminando comas y espacios extra
        const cleanArgs = processedArgs.join(' ').replace(/,/g, ' ').split(' ').filter(Boolean);

        const items = [];
        const invalidFormatItems = [];
        let i = 0;
        while (i < cleanArgs.length) {
            const currentArg = cleanArgs[i];

            // El argumento actual debe ser un código de producto válido (numérico).
            if (isNaN(parseInt(currentArg))) {
                invalidFormatItems.push(`"${currentArg}" (no es un código válido)`);
                i++;
                continue;
            }

            const code = currentArg;
            let quantity = 1;

            // --- Validación de existencia del producto ---
            if (!this.productManager.getProductByCode(code)) {
                invalidFormatItems.push(`"${code}" (código de producto no válido)`);
                i++;
                continue;
            }
            // --- Fin de la validación ---

            if (i + 1 < cleanArgs.length) {
                const nextArg = cleanArgs[i + 1];
                const nextArgAsInt = parseInt(nextArg);

                // Si el siguiente argumento es un número y es <= MAX_QUOTE_QUANTITY, se considera una cantidad.
                if (!isNaN(nextArgAsInt) && nextArgAsInt <= this.MAX_QUOTE_QUANTITY) {
                    quantity = nextArgAsInt;
                    i++; // Avanzar el índice para saltar el número de cantidad.
                } else if (isNaN(nextArgAsInt)) {
                    // Si el siguiente argumento NO es un número, es un error de formato para el código actual.
                    // No se asume cantidad 1, se descarta el item.
                    invalidFormatItems.push(`"${code}" (cantidad inválida: "${nextArg}")`);
                    i += 2; // Saltamos tanto el código como la cantidad inválida.
                    continue;
                }
                // Si el siguiente argumento es un número pero > MAX_QUOTE_QUANTITY, se asume que es el siguiente código
                // y la cantidad para el código actual es 1 (comportamiento por defecto).
            }

            items.push({ code, quantity });
            i++;
        }

        if (items.length === 0 && invalidFormatItems.length > 0) {
            let errorResponse = `❌ *Error en la Cotización*\n\n`;
            errorResponse += `No se encontraron productos válidos en tu solicitud. Por favor, verifica los códigos o cantidades ingresados.\n\n`;
            errorResponse += `*Argumentos con formato inválido:*\n• ${invalidFormatItems.join('\n• ')}\n\n`;
            errorResponse += `*Aquí tienes ayuda sobre cómo usar el comando de precios:*\n\n`;
            errorResponse += `Después del comando */precio* solo debe ingresar códigos válidos, seguido de la cantidad de ese producto.\n\n`;
            errorResponse += `*/precio [código]* - Para ver información y cotizar uno o más productos.\n`;
            errorResponse += `*Ejemplo:*\n`;
            errorResponse += `*/precio* 11050 3\n\n`;
            errorResponse += `*/buscar [término de búsqueda]* - Para encontrar productos por su nombre o descripción.\n`;
            errorResponse += `*Ejemplo:*\n`;
            errorResponse += `*/buscar* breaker\n`;
            return errorResponse;
        }

        if (items.length === 0 && invalidFormatItems.length === 0) {
            return `📝 *Cotización*\n\nNo se especificaron productos.`;
        }

        // Se ajusta el mensaje para indicar el tipo de cliente si no es el por defecto o si se forzó.
        let response = `📝 *Cotización Rápida*\n`;

        const quoteDate = new Date().toLocaleDateString('es-VE', { timeZone: 'America/Caracas' });
        response += `*Fecha:* ${quoteDate}\n\n`;

        response += `---------------------------------------\n\n`;

        let grandTotal = 0;
        let notFoundItems = [];
        let totalPiezas = 0;

        const { dolar, updateFailed, lastUpdated } = await getBcvRates(); // Obtener dolar al principio

        for (const item of items) {
            const product = this.productManager.getProductByCode(item.code);
            if (product) {
                const baseUnitPrice = this.productManager.getRawPrice(product, clientType);
                const finalUnitPrice = baseUnitPrice * commissionMultiplier; // Aplicar comisión
                const subTotal = finalUnitPrice * item.quantity;
                grandTotal += subTotal;
                totalPiezas += item.quantity;

                const formattedUnitPrice = `$${finalUnitPrice.toFixed(2)}`;
                const formattedSubTotal = `$${subTotal.toFixed(2)}`; // Asegurar 2 decimales

                response += `✅ *Producto:* ${product.descripcion}\n`;
                response += `*Código:* ${item.code}\n`;
                response += `*Cantidad:* ${item.quantity}\n`;
                response += `*Precio Unitario:* ${formattedUnitPrice}\n`;
                response += `*Subtotal:* ${formattedSubTotal}\n\n`;
            } else {
                notFoundItems.push(item.code);
            }
        }

        response += `---------------------------------------\n`;

        response += `*Total de la Cotización:* $${grandTotal.toFixed(2)}\n`;

        if (dolar && dolar !== -1) { // Mostrar la tasa BCV aquí
            response += `*Tasa BCV (USD):* ${dolar.toFixed(2)} Bs.\n`;
            if (updateFailed) {
                const dateStr = lastUpdated ? new Date(lastUpdated).toLocaleDateString('es-VE') : 'N/A';
                response += `⚠️ *Aviso:* No se pudo actualizar la tasa (BCV lento/caído). Usando valor del ${dateStr}.\n`;
            }
        }

        if (dolar && dolar !== -1) {
            const totalBs = grandTotal * dolar;
            response += `*Total Bs:* ${totalBs.toFixed(2)} Bs.\n`;
        }

        response += `*Total de Artículos:* ${totalPiezas}\n`;

        response += `---------------------------------------\n\n`;

        if (invalidFormatItems.length > 0) {
            response += `❌ *Argumentos con formato inválido (ignorados):*\n• ${invalidFormatItems.join('\n• ')}\n\n`;
        }
        if (notFoundItems.length > 0) {
            response += `❌ *Productos no encontrados:*\n${notFoundItems.join(', ')}\n\n`;
        }

        response += `Los Precios *NO INCLUYEN IVA*`;

        // Guardar la cotización para poder enviarla luego
        this.lastQuote.set(contact.number, response);

        // Incrementar el contador de cotizaciones si se encontró al menos un producto
        if (items.length > 0 && items.some(item => this.productManager.getProductByCode(item.code))) {
            this._incrementQuoteCount('codigoQuotes');
        }

        return response;
    }

    // Manejador para cotizaciones de múltiples productos en divisas (sin multiplicador, puede recibir un tipo de cliente forzado)
    async _handleMultiDivisaQuote(args, contact, clientTypeOverride = null) {
        const clientType = clientTypeOverride || this.getClientType(contact);
        let commissionMultiplier = 1.0;
        let processedArgs = [...args]; // Trabajar sobre una copia

        // --- Lógica para comisión de instalador ---
        if (processedArgs.length > 0 && processedArgs[0].endsWith('%')) {
            // Solo los instaladores pueden usar esta función
            if (clientType === this.clientTypes.INSTALADOR) {
                const percentageStr = processedArgs[0].slice(0, -1);
                const percentage = parseFloat(percentageStr);
                if (!isNaN(percentage) && percentage > 0) {
                    commissionMultiplier = 1 + (percentage / 100);
                    console.log(`Aplicando comisión del ${percentage}% para instalador ${contact.number} en /divisas. Multiplicador: ${commissionMultiplier}`);
                }
            }
            // Se remueve el argumento de porcentaje para que no sea procesado como un código de producto.
            // Para no-instaladores, esto simplemente lo ignora.
            processedArgs.shift();
        }
        const cleanArgs = processedArgs.join(' ').replace(/,/g, ' ').split(' ').filter(Boolean);

        const items = [];
        const invalidFormatItems = [];
        let i = 0;
        while (i < cleanArgs.length) {
            const currentArg = cleanArgs[i];

            // El argumento actual debe ser un código de producto válido (numérico).
            if (isNaN(parseInt(currentArg))) {
                invalidFormatItems.push(`"${currentArg}" (no es un código válido)`);
                i++;
                continue;
            }

            const code = currentArg;
            let quantity = 1;

            // --- Validación de existencia del producto ---
            if (!this.productManager.getProductByCode(code)) {
                invalidFormatItems.push(`"${code}" (código de producto no válido)`);
                i++;
                continue;
            }
            // --- Fin de la validación ---

            if (i + 1 < cleanArgs.length) {
                const nextArg = cleanArgs[i + 1];
                const nextArgAsInt = parseInt(nextArg);

                // Si el siguiente argumento es un número y es <= MAX_QUOTE_QUANTITY, se considera una cantidad.
                if (!isNaN(nextArgAsInt) && nextArgAsInt <= this.MAX_QUOTE_QUANTITY) {
                    quantity = nextArgAsInt;
                    i++; // Avanzar el índice para saltar el número de cantidad.
                } else if (isNaN(nextArgAsInt)) {
                    // Si el siguiente argumento NO es un número, es un error de formato para el código actual.
                    invalidFormatItems.push(`"${code}" (cantidad inválida: "${nextArg}")`);
                    i += 2; // Saltamos tanto el código como la cantidad inválida.
                    continue;
                }
            }

            items.push({ code, quantity });
            i++;
        }

        if (items.length === 0 && invalidFormatItems.length > 0) {
            let errorResponse = `❌ *Error en la Cotización*\n\n`;
            errorResponse += `No se encontraron productos válidos en tu solicitud. Por favor, verifica los códigos o cantidades ingresados.\n\n`;
            errorResponse += `*Argumentos con formato inválido:*\n• ${invalidFormatItems.join('\n• ')}\n\n`;
            errorResponse += `*Aquí tienes ayuda sobre cómo usar el comando de divisas:*\n\n`;
            errorResponse += `Después del comando */divisas* solo debe ingresar códigos válidos, seguido de la cantidad de ese producto.\n\n`;
            errorResponse += `*/divisas [código]* - Para ver información y cotizar uno o más productos.\n`;
            errorResponse += `*Ejemplo:*\n`;
            errorResponse += `*/divisas* 11050 3\n\n`;
            errorResponse += `*/buscar [término de búsqueda]* - Para encontrar productos por su nombre o descripción.\n`;
            errorResponse += `*Ejemplo:*\n`;
            errorResponse += `*/buscar* breaker\n`;
            return errorResponse;
        }

        if (items.length === 0 && invalidFormatItems.length === 0) {
            return `💱 *Cotización en Divisas*\n\nNo se especificaron productos.`;
        }

        let response = `💱 *Cotización Especial*\n`;

        const quoteDate = new Date().toLocaleDateString('es-VE', { timeZone: 'America/Caracas' });
        response += `*Fecha:* ${quoteDate}\n\n`;

        response += `---------------------------------------\n\n`;

        let grandTotal = 0;
        let notFoundItems = [];
        let totalPiezas = 0;

        for (const item of items) {
            const product = this.productManager.getProductByCode(item.code);
            if (product) {
                const baseUnitPrice = this.productManager.getBasePrice(product, clientType);
                const finalUnitPrice = baseUnitPrice * commissionMultiplier; // Aplicar comisión
                const subTotal = finalUnitPrice * item.quantity;
                grandTotal += subTotal;
                totalPiezas += item.quantity;

                response += `✅ *Producto:* ${product.descripcion}\n`;
                response += `*Código:* ${item.code}\n`;
                response += `*Cantidad:* ${item.quantity}\n`;
                response += `*Precio Especial Unitario:* $${finalUnitPrice.toFixed(2)}\n`;
                response += `*Subtotal:* $${subTotal.toFixed(2)}\n\n`;
            } else {
                notFoundItems.push(item.code);
            }
        }

        if (clientTypeOverride) {
            response += `*Precios calculados para tipo de cliente:* ${clientType.toUpperCase()}\n\n`;
        }

        response += `---------------------------------------\n`;

        response += `*Total de la Cotización:* $${grandTotal.toFixed(2)}\n\n`;

        response += `*Total de Artículos:* ${totalPiezas}\n`;

        response += `---------------------------------------\n\n`;

        if (invalidFormatItems.length > 0) response += `❌ *Argumentos inválidos (ignorados):*\n• ${invalidFormatItems.join('\n• ')}\n\n`;
        if (notFoundItems.length > 0) response += `❌ *Productos no encontrados:*\n${notFoundItems.join(', ')}\n\n`;
        response += `Los Precios *NO INCLUYEN IVA*`;

        // Guardar la cotización para poder enviarla luego
        this.lastQuote.set(contact.number, response);

        // Incrementar el contador de cotizaciones si se encontró al menos un producto
        if (items.length > 0 && items.some(item => this.productManager.getProductByCode(item.code))) {
            this._incrementQuoteCount('divisasQuotes');
        }

        return response;
    }

    // Comando de precio por código
    async handlePrecio(args, contact) {
        if (args.length === 0) {
            return `🔍 *Consulta de Precios*

Para consultar el precio de un producto específico, escribe:
/precio *Código Producto*

*Ejemplo:* /precio *11050*


Para cotizaciones rápidas, escribe:
/precio *CódigoProducto1, cantidad, CódigoProductoN, cantidad*

*Ejemplo:* /precio *11050, 1, 10000, 3, 10050, 2*

También  puedes hacer la misma consulta de la siguiente manera:
/precio *CódigoProducto1 cantidad CódigoProductoN cantidad*

*Ejemplo:* /precio *11050 1 10000 3 10050 2*

*Para enviar la cotización a un vendedor:*
Después de hacer tu cotización, usa el comando: 
/enviar *Nombre del Vendedor*

*NOTAS:*
Se permiten máximo 20 productos para la cotización rápida.
Si no se indica la cantidad, se asume que es 1.`;
        }

        // Se delega toda la lógica de cotización a _handleMultiProductQuote
        return this._handleMultiProductQuote(args, contact, null);
    }

    // Comando de precio general
    async handlePrecioGeneral(args, contact) {
        const clientTypeGeneral = this.clientTypes.GENERAL;

        if (args.length === 0) {
            return `🔍 *Consulta de Precios*

Para consultar el precio general de un producto, escribe:
/preciog *Código Producto*

*Ejemplo:* /preciog *11050*


Para cotizaciones rápidas, escribe:
/preciog *CódigoProducto1, cantidad, CódigoProductoN, cantidad*

*Ejemplo:* /preciog *11050, 1, 10000, 3, 10050, 2*

También  puedes hacer la misma consulta de la siguiente manera:
/preciog *CódigoProducto1 cantidad CódigoProductoN cantidad*

*Ejemplo:* /preciog *11050 1 10000 3 10050 2*

*Para enviar la cotización a un vendedor:*
Después de hacer tu cotización, usa el comando: 
/enviar *Nombre del Vendedor*

*NOTAS:*
Se permiten máximo 20 productos para la cotización rápida.
Si no se indica la cantidad, se asume que es 1.`;
        }

        // Se delega toda la lógica de cotización a _handleMultiProductQuote, forzando el tipo de cliente a 'general'
        return this._handleMultiProductQuote(args, contact, clientTypeGeneral);
    }

    // Comando de precios
    async handleCodigoInfo(args, contact) {
        const clientType = this.getClientType(contact);
        const stats = this.productManager.getStats();

        return `💰 *Información de Precios*

*Tu tipo de cliente actual es:* ${clientType.toUpperCase()}

*Para consultar precios específicos:*
*/precio *código* - Ver precio de producto específico

/buscar *término* - Buscar productos específicos según un término y sus precios`;
    }

    // --- Flujo de Aprobación para Cambio de Tipo de Cliente ---

    async _requestClientTypeChange(contact, requestedType) {
        if (this.vendedores.size === 0) {
            return `❌ No hay vendedores configurados para aprobar tu solicitud. Por favor, contacta a soporte.`;
        }

        const clientNumber = contact.number;
        const clientName = contact.pushname || clientNumber;

        // Guardar la solicitud pendiente
        this.pendingApprovals.set(clientNumber, { requestedType, timestamp: Date.now() });

        const infoMessage = `*Solicitud de Cambio de Tipo de Cliente*

*Cliente:* ${clientName}
*Número:* ${clientNumber}
*Tipo Solicitado:* ${requestedType.toUpperCase()}`;

        const approveCommand = `/aprobar ${clientNumber} ${requestedType}`;
        const rejectCommand = `/rechazar ${clientNumber}`;

        // Enviar solicitud a todos los vendedores
        for (const [vendedorName, vendedorNumber] of this.vendedores.entries()) {
            try {
                const chatId = `${vendedorNumber}@c.us`;
                // Enviar mensajes por separado para facilitar el copiado y pegado
                await this.sendMessageSafe(chatId, infoMessage);

                // Enviamos el comando de aprobación en un mensaje separado
                const approveMsg = await this.sendMessageSafe(chatId, approveCommand);
                // No necesitamos registrar el ID de este mensaje para el eco, ya que el vendedor lo copiará, no lo reenviará.

                // Enviamos el comando de rechazo en un mensaje separado
                const rejectMsg = await this.sendMessageSafe(chatId, rejectCommand);

                console.log(`Solicitud de aprobación enviada al vendedor ${vendedorName} en mensajes separados.`);
            } catch (error) {
                console.error(`Error al enviar mensajes de solicitud al vendedor ${vendedorName}:`, error);
            }
        }

        return `✅ *Solicitud Enviada*

Tu solicitud para cambiar a tipo de cliente *${requestedType.toUpperCase()}* ha sido enviada a nuestros vendedores para su aprobación.

Te notificaremos tan pronto como sea procesada.`;
    }

    async handleTienda(args, contact) {
        return this._requestClientTypeChange(contact, this.clientTypes.TIENDA);
    }

    async handleInstalador(args, contact) {
        return this._requestClientTypeChange(contact, this.clientTypes.INSTALADOR);
    }

    async handleGeneral(args, contact) {
        return this._requestClientTypeChange(contact, this.clientTypes.GENERAL);
    }

    async handleAprobar(args, contact) {
        if (!this.isVendedor(contact)) {
            return `❌ Este comando solo puede ser usado por vendedores autorizados.`;
        }

        if (args.length < 2) {
            return `Formato incorrecto. Usa: /aprobar <numero_cliente> <tipo_cliente>`;
        }

        const clientNumber = args[0];
        const newType = args[1].toLowerCase();
        const clientChatId = `${clientNumber}@c.us`;

        if (!this.pendingApprovals.has(clientNumber)) {
            return `⚠️ No hay una solicitud pendiente para el cliente ${clientNumber}, o ya fue procesada.`;
        }

        this.clientStates.set(clientNumber, newType);
        this._saveClientStates();
        this.pendingApprovals.delete(clientNumber); // Eliminar la solicitud pendiente

        const confirmationToClient = `🎉 ¡Tu solicitud ha sido aprobada! 🎉\n\nAhora tienes acceso a los precios de *${newType.toUpperCase()}*.`;
        await this.sendMessageSafe(clientChatId, confirmationToClient);

        return `✅ Solicitud del cliente ${clientNumber} aprobada. Se le ha asignado el tipo *${newType.toUpperCase()}*.`;
    }

    async handleRechazar(args, contact) {
        if (!this.isVendedor(contact)) {
            return `❌ Este comando solo puede ser usado por vendedores autorizados.`;
        }

        if (args.length < 1) {
            return `Formato incorrecto. Usa: /rechazar <numero_cliente>`;
        }

        const clientNumber = args[0];
        const clientChatId = `${clientNumber}@c.us`;

        if (!this.pendingApprovals.has(clientNumber)) {
            return `⚠️ No hay una solicitud pendiente para el cliente ${clientNumber}, o ya fue procesada.`;
        }

        this.pendingApprovals.delete(clientNumber); // Eliminar la solicitud pendiente

        const rejectionToClient = `Lo sentimos, tu solicitud de cambio de tipo de cliente ha sido rechazada. Por favor, contacta a un vendedor para más información.`;
        await this.sendMessageSafe(clientChatId, rejectionToClient);

        return `🚫 Solicitud del cliente ${clientNumber} ha sido rechazada y notificada.`;
    }

    // Comando de estadísticas
    async handleStats(args, contact) {
        const stats = this.productManager.getStats();

        return `📊 *Estadísticas del Sistema*

*Productos:*
• Total de productos: ${stats.totalProductos}
• Categorías disponibles: ${stats.categorias}
*Cotizaciones:*
• Total de cotizaciones: ${this.botStats.totalQuotes || 0}
  - Vía /precios: ${this.botStats.codigoQuotes || 0}
  - Vía /divisas: ${this.botStats.divisasQuotes || 0}
• Registros en historial: ${this.botStats.quoteHistory ? this.botStats.quoteHistory.length : 0}

*Configuración:*
• Multiplicador de precios: ${stats.multiplicadorPrecio}x
• Última actualización: ${stats.ultimaActualizacion ? stats.ultimaActualizacion.toLocaleString() : 'N/A'}

*Archivo Excel:*
• Ruta: ${stats.archivoExcel}
• Estado: ${stats.ultimaActualizacion ? 'Actualizado' : 'No disponible'}

*Comandos registrados:* ${this.commands.size}`;
    }

    // Comando de divisas (precio sin multiplicador)
    async handleDivisas(args, contact) {
        const clientType = this.getClientType(contact);

        // Restringir acceso a tiendas e instaladores
        if (clientType !== this.clientTypes.TIENDA && clientType !== this.clientTypes.INSTALADOR) {
            return `❌ *Acceso Denegado*\n\nEl comando /divisas NO está disponible para usted.`;
        }

        if (args.length === 0) {
            return `💱 *Consulta de Precios en Divisas*\n\nEste comando muestra el precio en divisas de un producto.\n\nPara consultar el precio de un producto específico, escribe:\n/divisas *Código Producto*\n\n*Ejemplo:* /divisas *11050*\n\n\nPara cotizaciones rápidas, escribe:\n/divisas *CódigoProducto1, cantidad, CódigoProductoN, cantidad*\n\n*Ejemplo:* /divisas *11050, 1, 10000, 3, 10050, 2*\n\nTambién  puedes hacer la misma consulta de la siguiente manera:\n/divisas *CódigoProducto1 cantidad CódigoProductoN cantidad*\n\n*Ejemplo:* /divisas *11050 1 10000 3 10050 2*\n\n*Para enviar la cotización a un vendedor:*\nDespués de hacer tu cotización, usa el comando: \n/enviar *Nombre del Vendedor*\n\n*NOTAS:*\nSe permiten máximo 20 productos para la cotización rápida.\nSi no se indica la cantidad, se asume que es 1.`;
        }

        // Se delega toda la lógica de cotización a _handleMultiDivisaQuote
        return this._handleMultiDivisaQuote(args, contact, null);
    }

    // Comando para enviar cotización a un vendedor
    async handleEnviar(args, contact) {
        if (args.length === 0) {
            const vendedoresDisponibles = Array.from(this.vendedores.keys()).join(', ');
            return `Para enviar tu última cotización a un vendedor, escribe:\n/enviar *Nombre del Vendedor*\n\nVendedores disponibles: ${vendedoresDisponibles || 'Ninguno configurado'}`;
        }

        const vendedorName = args[0].toLowerCase();
        const vendedorNumber = this.vendedores.get(vendedorName);

        if (!vendedorNumber) {
            return `❌ Vendedor "${vendedorName}" no encontrado.`;
        }

        const lastQuote = this.lastQuote.get(contact.number);

        if (!lastQuote) {
            return `📝 No tienes una cotización reciente para enviar. Por favor, genera una cotización primero con el comando /precio.`;
        }

        const clientType = this.getClientType(contact);

        const messageToVendedor = `*Nueva Cotización Solicitada*\n\n*Cliente:* ${contact.pushname || contact.number}\n*Número:* ${contact.number}\n*Tipo de Cliente:* ${clientType.toUpperCase()}\n\n-----------------------------------\n${lastQuote}`;

        try {
            // El número del vendedor debe estar en formato internacional con @c.us
            const chatId = `${vendedorNumber}@c.us`;
            const sentMessage = await this.sendMessageSafe(chatId, messageToVendedor);

            // Devolver el ID del mensaje enviado para evitar que el bot reaccione a él
            this.lastQuote.delete(contact.number);
            return { response: `✅ ¡Éxito! Tu cotización ha sido enviada a *${vendedorName}*. Pronto se pondrá en contacto contigo.`, sentMessageId: sentMessage.id._serialized };

        } catch (error) {
            console.error(`Error al enviar mensaje al vendedor ${vendedorName}:`, error);
            return `❌ Ocurrió un error al intentar enviar la cotización. Por favor, intenta de nuevo más tarde o contacta directamente al vendedor.`;
        }
    }

    // Comando para enviar una foto de un producto
    async handleFoto(args, contact) {
        if (args.length === 0) {
            return `📷 Para solicitar la foto de un producto, escribe:\n/foto *Código del Producto*\n\n*Ejemplo:* /foto 11050`;
        }

        const codigo = args[0];
        const product = this.productManager.getProductByCode(codigo);

        if (!product) {
            return `❌ Producto con código "${codigo}" no encontrado.`;
        }

        // Define la ruta de la carpeta de imágenes
        const imageDir = path.join(__dirname, 'data', 'product_images');
        const extensions = ['.jpg', '.jpeg', '.png'];
        let imagePath = null;

        // Busca la imagen con extensiones comunes
        for (const ext of extensions) {
            const potentialPath = path.join(imageDir, `${codigo}${ext}`);
            if (fs.existsSync(potentialPath)) {
                imagePath = potentialPath;
                break;
            }
        }

        if (!imagePath) {
            return `🖼️ Lo sentimos, no se encontró una imagen para el producto *${product.descripcion}* (Código: ${codigo}).`;
        }

        try {
            const { MessageMedia } = whatsapp;
            const media = MessageMedia.fromFilePath(imagePath);
            // Devolvemos un objeto que contiene tanto el medio como un pie de foto.
            return { media, caption: `📷 *${product.descripcion}*\n*Código:* ${codigo}` };
        } catch (error) {
            console.error(`Error al cargar la imagen para el producto ${codigo}:`, error);
            return `❌ Ocurrió un error al intentar enviar la imagen. Por favor, contacta directamente al vendedor.`;
        }
    }

    // Comando para obtener la tasa del BCV
    async handleBcv(args, contact) {
        try {
            const { dolar, euro, lastUpdated, updateFailed } = await getBcvRates();

            // 2. Verificamos si hay argumentos para usar la calculadora
            let montoACalcular = null;
            if (args.length > 0) {
                // Reemplazamos coma por punto y parseamos
                const montoLimpio = args[0].replace(',', '.');
                const numero = parseFloat(montoLimpio);
                if (!isNaN(numero)) {
                    montoACalcular = numero;
                }
            }

            // --- ESCENARIO 1: MODO CALCULADORA ---
            if (montoACalcular !== null) {
                let response = `🧮 *Calculadora BCV*\n`;
                response += `Cantidad: *${montoACalcular}*\n\n`;

                if (updateFailed) {
                    response += `⚠️ *Nota:* Calculado con tasas de respaldo (BCV caído).\n\n`;
                }

                // Cálculo Dólar
                if (dolar && dolar !== -1) {
                    const totalBs = montoACalcular * dolar;
                    response += `🇺🇸 *USD:* ${totalBs.toFixed(2)} Bs.\n`;
                    response += `_(Tasa: ${dolar.toFixed(2)})_\n\n`;
                }

                // Cálculo Euro
                if (euro && euro !== -1) {
                    const totalBs = montoACalcular * euro;
                    response += `🇪🇺 *EUR:* ${totalBs.toFixed(2)} Bs.\n`;
                    response += `_(Tasa: ${euro.toFixed(2)})_\n`;
                }
                
                // Agregamos fecha al final
                if (lastUpdated) {
                    const dateStr = new Date(lastUpdated).toLocaleString('es-VE', { timeZone: 'America/Caracas' });
                    response += `\n📅 ${dateStr}`;
                }

                return response;
            }

            let response = `🏦 *Tasa de Cambio del BCV*\n\n`;

            if (updateFailed) {
                response += `⚠️ *Aviso:* No se pudo conectar con el BCV. Se muestran los últimos valores registrados.\n\n`;
            }

            if (dolar && dolar !== -1) {
                response += `💵 *Dólar:* ${dolar.toFixed(2)} Bs.\n`;
            } else {
                response += `💵 *Dólar:* No disponible\n`;
            }

            if (euro && euro !== -1) {
                response += `💶 *Euro:* ${euro.toFixed(2)} Bs.\n`;
            } else {
                response += `💶 *Euro:* No disponible\n`;
            }

            if (lastUpdated) {
                const updateDate = new Date(lastUpdated);
                const options = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'America/Caracas' };
                response += `\n*Actualizado:* ${updateDate.toLocaleString('es-VE', options)}\n`;
            }

            response += `\nFuente: Banco Central de Venezuela (BCV)`

            return response;
        } catch (error) {
            console.error("Error al obtener las tasas del BCV:", error);
            return "❌ Ocurrió un error al consultar las tasas de cambio. Por favor, intenta de nuevo más tarde.";
        }
    }

    // Comando para actualizar manualmente las tasas del BCV
    async handleActualizarBcv(args, contact) {
        // 1. Seguridad: Solo vendedores pueden usar esto
        if (!this.isVendedor(contact)) {
            return `❌ *Acceso Denegado*\nEste comando es exclusivo para vendedores autorizados.`;
        }

        // 2. Validación: Deben llegar exactamente 2 argumentos (USD y EUR)
        if (args.length < 2) {
            return `❌ *Error de Formato*\n\nDebes ingresar ambas tasas para realizar la actualización.\n\n*Uso correcto:*\n/actualizarbcv <TasaUSD> <TasaEUR>\n\n*Ejemplo:*\n/actualizarbcv 36.50 39.10`;
        }

        // 3. Normalización de decimales (Reemplazar coma por punto)
        const rawDolar = args[0].replace(',', '.');
        const rawEuro = args[1].replace(',', '.');

        const nuevoDolar = parseFloat(rawDolar);
        const nuevoEuro = parseFloat(rawEuro);

        // 4. Validación numérica
        if (isNaN(nuevoDolar) || isNaN(nuevoEuro)) {
            return `❌ *Valores Inválidos*\n\nPor favor verifica que las tasas ingresadas sean números válidos.\nRecibido: USD="${args[0]}", EUR="${args[1]}"`;
        }

        // 5. Ejecución
        try {
            setManualRates(nuevoDolar, nuevoEuro);
            
            const fecha = new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' });
            
            return `✅ *Tasas Actualizadas Manualmente*\n\n` +
                   `💵 *Dólar:* ${nuevoDolar.toFixed(2)} Bs.\n` +
                   `💶 *Euro:* ${nuevoEuro.toFixed(2)} Bs.\n` +
                   `📅 *Fecha:* ${fecha}\n\n` +
                   `⚠️ _Estos valores se usarán mientras la página del BCV no responda o hasta la próxima actualización oficial._`;
        } catch (error) {
            console.error("Error al establecer tasas manuales:", error);
            return `❌ Ocurrió un error interno al intentar guardar las tasas.`;
        }
    }

    // Obtener lista de comandos disponibles
    getAvailableCommands() {
        return Array.from(this.commands.keys());
    }

    // Public method to set client type and save it
    setClientType(contactNumber, type) {
        this.clientStates.set(contactNumber, type);
        this._saveClientStates();
        console.log(`Tipo de cliente para ${contactNumber} establecido a ${type} y guardado.`);
    }
}

export default CommandManager;
