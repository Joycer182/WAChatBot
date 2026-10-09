// Configuración del Bot de WhatsApp
// Personaliza estos valores según tu negocio

const config = {
    // Información de la empresa
    empresa: {
        nombre: process.env.EMPRESA_NOMBRE || 'Tu Empresa',
        email: process.env.EMPRESA_EMAIL || 'contacto@tuempresa.com',
        web: process.env.EMPRESA_WEB || 'www.tuempresa.com',
        direccion: process.env.EMPRESA_DIRECCION || 'Tu dirección aquí'
    },

    // Horarios de atención
    horarios: {
        lunesViernes: process.env.HORARIO_LUNES_VIERNES || '9:00 AM - 6:00 PM',
        sabados: process.env.HORARIO_SABADOS || '9:00 AM - 2:00 PM',
        domingos: process.env.HORARIO_DOMINGOS || 'Cerrado'
    },

    // Configuración de productos desde la base de datos SQLite
    productos: {
        dbFilePath: process.env.SQLITE_DB_PATH || 'src/data/LocalJose.db',
        priceMultiplier: parseFloat(process.env.PRICE_MULTIPLIER) || 1.0,
        defaultClientType: process.env.DEFAULT_CLIENT_TYPE || 'general',
        enableClientTypeCommands: process.env.ENABLE_CLIENT_TYPE_COMMANDS === 'true' || true,
        catalogVersion: process.env.CATALOG_VERSION || '1.0' // Versión del catálogo
    },

    // Configuración de la base de datos operativa del bot
    database: {
        dbFilePath: process.env.BOT_DB_PATH || 'src/data/bot.db'
    },

    // Configuración del bot
    bot: {
        port: process.env.PORT || 3000,
        sessionName: process.env.WHATSAPP_SESSION_NAME || 'wschatbot-session',
        logLevel: process.env.LOG_LEVEL || 'info',
        logConversations: process.env.LOG_CONVERSATIONS === 'true' || true,
        // Orígenes permitidos para CORS. Usa una lista separada por comas en .env
        // Ejemplo: CORS_ORIGINS=http://localhost:8080,https://mi-dashboard.com
        corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:8080', 'http://localhost:3000']
    },

    // Comandos disponibles
    comandos: {
        generales: ['help', 'ayuda', 'info', 'informacion', 'horarios', 'soporte'],
        productos: ['productos', 'categorias', 'buscar', 'search', 'precio', 'precios', 'codigo', 'producto'],
        tiposCliente: ['tienda', 'store', 'instalador', 'installer', 'general'],
        administracion: ['stats', 'estadisticas']
    },

    // Mensajes personalizados
    mensajes: {
        saludo: `¡Hola! 👋

Bienvenido al servicio automatizado de consulta de precios. 

Actualmente trabajo con el *Catálogo de precios v${process.env.CATALOG_VERSION || '1.0'}*
Asegúrate de tener el catálogo a mano para poder ayudarte.

Acá te dejo en enlace de descarga del catálogo:
${process.env.CATALOG_DOWNLOAD_LINK || 'https://www.dropbox.com/scl/fi/c2zahk30ats86o2r0vrdp/Catalogo-ACDC-Consultar-V-2.7.pdf?rlkey=ub3vuqtsveamu0ulnddtjd5fz&dl=0'}

Para consulta de precios usa el siguiente comando:
*/precio código* - Consulta del precio de un producto específico

*Ejempo:*
/precio 11050

Escribe */precio* sin ningún código y obtendrás más información sobre este comando.

Puedes escribir */ayuda* para ver todas las opciones disponibles.`,

        despedida: `¡De nada! 😊 

Fue un placer ayudarte. Si tienes más preguntas, no dudes en contactarnos.

¡Que tengas un excelente día!`,

        comandoNoReconocido: `¡Hola! 👋

Gracias por contactarnos. Para una mejor atención, puedes usar los siguientes comandos:

*/ayuda* - Ver todas las opciones
*/info* - Información de contacto
*/productos* - Información general de los productos disponibles
*/buscar* - Buscar productos específicos

¿En qué puedo ayudarte?`,

        noEntendido: `🤔 No he entendido tu mensaje.`,

        fueraHorario: `🕒 *Fuera de Horario de Atención*

Actualmente estamos fuera de nuestro horario de atención:
${process.env.HORARIO_LUNES_VIERNES || '9:00 AM - 6:00 PM'} (Lunes a Viernes)
${process.env.HORARIO_SABADOS || '9:00 AM - 2:00 PM'} (Sábados)

Te responderemos tan pronto como sea posible. ¡Gracias por tu paciencia!`,

        excelNoDisponible: `📄 *Archivo de Productos*

El archivo de productos Excel no está disponible en este momento.

*Información disponible:*
• Usa /ayuda para ver comandos generales
• Usa /info para información de contacto

Nuestro equipo técnico está trabajando para resolver este problema.`,

        productoNoEncontrado: `❌ *Producto no encontrado*

No se encontró el producto solicitado.

*Sugerencias:*
• Verifica el código o término de búsqueda
• Usa /buscar para explorar productos similares
• Usa /categorias para ver categorías disponibles`
    },

    // Palabras clave para respuestas automáticas
    palabrasClave: {
        saludos: ['hola', 'holis', 'buenos días', 'buenas tardes', 'buenas noches', 'hi', 'hello'],
        despedidas: ['gracias', 'chau', 'adiós', 'adios', 'hasta luego', 'bye', 'goodbye'],
        precios: ['precio', 'costo', 'cuánto cuesta', 'valor', 'tarifa', 'tarifas', 'precios'],
        productos: ['producto', 'servicio', 'qué ofrecen', 'catalogo', 'inventario'],
        horarios: ['horario', 'cuándo', 'cuando', 'disponible', 'abierto', 'cerrado'],
        problemas: ['problema', 'error', 'no funciona', 'no sirve', 'queja', 'reclamo', 'falla', 'fallas', 'soporte', 'problemas'],
        busqueda: ['buscar', 'encontrar', 'tengo', 'necesito', 'requiero', 'quiero']
    }
};

export default config;
