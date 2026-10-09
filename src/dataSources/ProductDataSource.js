// Interfaz abstracta (contrato) para el acceso a los datos de productos.
//
// Define los métodos agnósticos de origen de datos. Cualquier implementación
// (SQLite, API REST vía fetch, Excel, etc.) debe extender esta clase y
// sobrescribir cada método manteniendo la misma firma asíncrona.
//
// La forma de los objetos devueltos es siempre:
//   {
//     codigo,          // código del producto
//     descripcion,     // descripción
//     categoria,       // nombre de la categoría
//     precioTienda,    // usd_m
//     precioInstalador,// usd_i
//     precioGeneral    // usd_g
//   }

class ProductDataSource {
    // Abre/conecta la fuente de datos y valida que esté disponible.
    async initialize() {
        throw new Error('Método initialize() no implementado en la fuente de datos.');
    }

    // Devuelve un producto por su código, o null si no existe.
    async getProductByCode(codigo) {
        throw new Error('Método getProductByCode() no implementado en la fuente de datos.');
    }

    // Devuelve los productos cuya categoría coincida (parcialmente).
    async getProductsByCategory(categoria) {
        throw new Error('Método getProductsByCategory() no implementado en la fuente de datos.');
    }

    // Busca productos por descripción (o código) que contengan el término.
    async searchProducts(query) {
        throw new Error('Método searchProducts() no implementado en la fuente de datos.');
    }

    // Devuelve la lista de nombres de categorías.
    async getAllCategories() {
        throw new Error('Método getAllCategories() no implementado en la fuente de datos.');
    }

    // Devuelve todos los productos disponibles.
    async getAllProducts() {
        throw new Error('Método getAllProducts() no implementado en la fuente de datos.');
    }

    // Devuelve contadores agregados: { totalProductos, categorias }.
    async getCounts() {
        throw new Error('Método getCounts() no implementado en la fuente de datos.');
    }

    // Cierra la conexión con la fuente de datos.
    async close() {
        throw new Error('Método close() no implementado en la fuente de datos.');
    }
}

export default ProductDataSource;
