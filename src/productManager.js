// Capa de servicio / fachada para los productos.
//
// Antes cargaba el catálogo desde un Excel en memoria. Ahora delega todo el
// acceso a datos en una instancia de ProductDataSource (por defecto SQLite).
// El resto del bot no conoce el origen de datos: solo ve esta clase y sus
// métodos.
//
// Los métodos que tocan el origen de datos son asíncronos (async/await) para
// que, al cambiar SQLite por una llamada fetch a una API REST, la firma se
// mantenga idéntica y no haya que modificar los comandos del bot.
//
// Los métodos de cálculo de precios son puros y siguen siendo síncronos.

class ProductManager {
    constructor(config, dataSource) {
        this.dataSource = dataSource;
        this.priceMultiplier = config.productos.priceMultiplier;
        this.dbPath = config.productos.dbFilePath;
    }

    // Inicializa la fuente de datos (abre/conecta la base de datos).
    async loadProducts() {
        return await this.dataSource.initialize();
    }

    // Obtener producto por código
    async getProductByCode(codigo) {
        return await this.dataSource.getProductByCode(codigo);
    }

    // Obtener productos por categoría
    async getProductsByCategory(categoria) {
        return await this.dataSource.getProductsByCategory(categoria);
    }

    // Buscar productos por descripción
    async searchProducts(query) {
        return await this.dataSource.searchProducts(query);
    }

    // Obtener todas las categorías únicas
    async getCategories() {
        return await this.dataSource.getAllCategories();
    }

    // Calcular precio con multiplicador
    calculatePrice(basePrice, clientType = 'general') {
        if (!basePrice || basePrice <= 0) return 0;
        return basePrice * this.priceMultiplier;
    }

    // Obtener precio formateado para un tipo de cliente
    getFormattedPrice(product, clientType = 'general') {
        let basePrice = 0;

        switch (clientType.toLowerCase()) {
            case 'tienda':
            case 'store':
                basePrice = product.precioTienda;
                break;
            case 'instalador':
            case 'installer':
                basePrice = product.precioInstalador;
                break;
            case 'general':
            case 'general':
            default:
                basePrice = product.precioGeneral;
                break;
        }

        const finalPrice = this.calculatePrice(basePrice, clientType);
        return finalPrice > 0 ? `$${finalPrice.toFixed(2)}` : 'Precio no disponible';
    }

    // Obtener precio numérico para un tipo de cliente
    getRawPrice(product, clientType = 'general') {
        let basePrice = 0;

        switch (clientType.toLowerCase()) {
            case 'tienda':
            case 'store':
                basePrice = product.precioTienda;
                break;
            case 'instalador':
            case 'installer':
                basePrice = product.precioInstalador;
                break;
            case 'general':
            default:
                basePrice = product.precioGeneral;
                break;
        }

        return this.calculatePrice(basePrice, clientType);
    }

    // Obtener precio base numérico (sin multiplicador)
    getBasePrice(product, clientType = 'general') {
        let basePrice = 0;

        switch (clientType.toLowerCase()) {
            case 'tienda':
            case 'store':
                basePrice = product.precioTienda;
                break;
            case 'instalador':
            case 'installer':
                basePrice = product.precioInstalador;
                break;
            case 'general':
            default:
                basePrice = product.precioGeneral;
                break;
        }
        return basePrice || 0;
    }

    // Obtener precio en divisas (sin multiplicador) para un tipo de cliente
    getRawFormattedPrice(product, clientType = 'general') {
        let basePrice = 0;

        switch (clientType.toLowerCase()) {
            case 'tienda':
            case 'store':
                basePrice = product.precioTienda;
                break;
            case 'instalador':
            case 'installer':
                basePrice = product.precioInstalador;
                break;
            case 'general':
            default:
                basePrice = product.precioGeneral;
                break;
        }

        return basePrice > 0 ? `$${basePrice.toFixed(2)}` : 'Precio no disponible';
    }

    // Obtener información completa del producto para un tipo de cliente
    getProductInfo(product, clientType = 'general') {
        const price = this.getFormattedPrice(product, clientType);
        return {
            codigo: product.codigo,
            descripcion: product.descripcion,
            categoria: product.categoria,
            precio: price,
            tipoCliente: clientType,
            multiplicador: this.priceMultiplier
        };
    }

    // Obtener estadísticas de productos
    async getStats() {
        const counts = await this.dataSource.getCounts();
        return {
            totalProductos: counts.totalProductos,
            categorias: counts.categorias,
            multiplicadorPrecio: this.priceMultiplier,
            dbPath: this.dbPath
        };
    }

    // Actualizar multiplicador de precios
    updatePriceMultiplier(newMultiplier) {
        this.priceMultiplier = parseFloat(newMultiplier) || 1.0;
        console.log(`💰 Multiplicador de precios actualizado a: ${this.priceMultiplier}`);
    }

    // Obtener todos los productos con precios para un tipo de cliente
    async getAllProductsForClient(clientType = 'general') {
        const products = await this.dataSource.getAllProducts();
        return products.map(product => this.getProductInfo(product, clientType));
    }
}

export default ProductManager;
