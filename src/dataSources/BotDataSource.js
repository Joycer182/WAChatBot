// Interfaz abstracta (contrato) para el acceso a los datos operativos del bot.
//
// Agrupa toda la persistencia del bot que antes vivía en archivos JSON:
// clientes (tipo de cliente), vendedores, conversaciones, caché del BCV y
// estadísticas. Cualquier implementación (SQLite, API REST vía fetch, etc.)
// debe extender esta clase y sobrescribir cada método manteniendo la firma
// asíncrona. Así, al migrar a una API no hay que tocar los comandos.

class BotDataSource {
    // Abre/conecta la fuente de datos y prepara las estructuras necesarias.
    async initialize() {
        throw new Error('Método initialize() no implementado en la fuente de datos.');
    }

    // --- Clientes (tipo de cliente) ---
    // Devuelve el tipo de cliente de un teléfono, o null si no existe.
    async getClientType(telefono) {
        throw new Error('Método getClientType() no implementado en la fuente de datos.');
    }

    // Guarda/actualiza el tipo de cliente de un teléfono.
    async setClientType(telefono, tipo) {
        throw new Error('Método setClientType() no implementado en la fuente de datos.');
    }

    // Indica si un teléfono ya está registrado como cliente.
    async hasClient(telefono) {
        throw new Error('Método hasClient() no implementado en la fuente de datos.');
    }

    // Devuelve todos los clientes: Map<telefono, tipo>.
    async getAllClients() {
        throw new Error('Método getAllClients() no implementado en la fuente de datos.');
    }

    // --- Vendedores ---
    // Devuelve todos los vendedores: Map<alias, telefono>.
    async getAllVendors() {
        throw new Error('Método getAllVendors() no implementado en la fuente de datos.');
    }

    // Devuelve el teléfono de un vendedor por su alias, o null.
    async getVendor(alias) {
        throw new Error('Método getVendor() no implementado en la fuente de datos.');
    }

    // Indica si un teléfono pertenece a un vendedor autorizado.
    async isVendorPhone(telefono) {
        throw new Error('Método isVendorPhone() no implementado en la fuente de datos.');
    }

    // --- Conversaciones ---
    // Guarda un mensaje de conversación.
    // entry: { telefono, contacto, mensaje, esDelBot, tipoMensaje, timestamp }
    async saveConversation(entry) {
        throw new Error('Método saveConversation() no implementado en la fuente de datos.');
    }

    // Devuelve las conversaciones de un teléfono.
    async getConversations(telefono) {
        throw new Error('Método getConversations() no implementado en la fuente de datos.');
    }

    // Devuelve todas las conversaciones agrupadas por teléfono.
    async getAllConversations() {
        throw new Error('Método getAllConversations() no implementado en la fuente de datos.');
    }

    // Devuelve estadísticas de conversaciones: { contactosUnicos, totalMensajes }.
    async countConversations() {
        throw new Error('Método countConversations() no implementado en la fuente de datos.');
    }

    // --- Caché del BCV ---
    // Devuelve la caché: { dolar, euro, lastUpdated }.
    async getBcvCache() {
        throw new Error('Método getBcvCache() no implementado en la fuente de datos.');
    }

    // Guarda la caché: { dolar, euro, lastUpdated }.
    async setBcvCache(data) {
        throw new Error('Método setBcvCache() no implementado en la fuente de datos.');
    }

    // --- Estadísticas del bot ---
    // Devuelve las estadísticas: { totalQuotes, codigoQuotes, divisasQuotes, quoteHistory }.
    async getStats() {
        throw new Error('Método getStats() no implementado en la fuente de datos.');
    }

    // Incrementa el contador de cotizaciones y registra en el historial.
    async incrementQuote(type) {
        throw new Error('Método incrementQuote() no implementado en la fuente de datos.');
    }

    // Cierra la conexión con la fuente de datos.
    async close() {
        throw new Error('Método close() no implementado en la fuente de datos.');
    }
}

export default BotDataSource;
