import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

// Clase para manejar productos desde Excel
class ProductManager {
    constructor(config) {
        this.products = [];
        this.lastModified = null;
        this.excelFilePath = path.resolve(config.productos.excelFilePath);
        this.excelSheetName = config.productos.excelSheetName;
        this.priceMultiplier = config.productos.priceMultiplier;
    }

    // Cargar productos desde Excel
    async loadProducts() {
        try {
            if (!fs.existsSync(this.excelFilePath)) {
                console.warn(`⚠️ Archivo Excel no encontrado: ${this.excelFilePath}`);
                return false;
            }

            const workbook = XLSX.readFile(this.excelFilePath, { cellDates: true });
            const sheetName = this.excelSheetName;
            const worksheet = workbook.Sheets[sheetName];

            if (!worksheet) {
                console.error(`❌ No se encontró la hoja de cálculo "${sheetName}" en el archivo Excel.`);
                return false;
            }
            
            // Convertir a JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            this.products = jsonData.map(row => ({
                codigo: row.Codigo || row.codigo || '',
                descripcion: row.Descripcion || row.descripcion || '',
                categoria: row.Categoria || row.categoria || '',
                precioTienda: parseFloat(row.UsdM || row.usdM || 0),
                precioInstalador: parseFloat(row.UsdI || row.usdI || 0),
                precioGeneral: parseFloat(row.UsdG || row.usdG || 0)
            })).filter(product => product.codigo && product.descripcion);

            this.lastModified = fs.statSync(this.excelFilePath).mtime;
            console.log(`✅ Cargados ${this.products.length} productos desde Excel`);
            return true;

        } catch (error) {
            console.error('❌ Error cargando productos desde Excel:', error.message);
            return false;
        }
    }

    // Verificar si el archivo Excel ha sido modificado
    checkForUpdates() {
        try {
            if (!fs.existsSync(this.excelFilePath)) {
                return false;
            }

            const currentModified = fs.statSync(this.excelFilePath).mtime;
            if (!this.lastModified || currentModified > this.lastModified) {
                console.log('📄 Archivo Excel actualizado, recargando productos...');
                return this.loadProducts();
            }
            return false;
        } catch (error) {
            console.error('❌ Error verificando actualizaciones:', error.message);
            return false;
        }
    }

    // Obtener producto por código
    getProductByCode(codigo) {
        this.checkForUpdates(); // Verificar actualizaciones antes de buscar
        return this.products.find(product => 
            product.codigo.toString().toLowerCase() === codigo.toString().toLowerCase()
        );
    }

    // Obtener productos por categoría
    getProductsByCategory(categoria) {
        this.checkForUpdates();
        return this.products.filter(product => 
            product.categoria.toLowerCase().includes(categoria.toLowerCase())
        );
    }

    // Buscar productos por descripción
    searchProducts(query) {
        this.checkForUpdates();
        const searchTerm = query.toLowerCase();
        return this.products.filter(product => 
            product.descripcion.toLowerCase().includes(searchTerm) ||
            product.categoria.toLowerCase().includes(searchTerm)
        );
    }

    // Obtener todas las categorías únicas
    getCategories() {
        this.checkForUpdates();
        const categories = [...new Set(this.products.map(p => p.categoria))];
        return categories.filter(cat => cat && cat.trim() !== '');
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
        // Corregido: Asegurarse de que siempre se use getFormattedPrice
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
    getStats() {
        this.checkForUpdates();
        return {
            totalProductos: this.products.length,
            categorias: this.getCategories().length,
            ultimaActualizacion: this.lastModified,
            multiplicadorPrecio: this.priceMultiplier,
            archivoExcel: this.excelFilePath
        };
    }

    // Actualizar multiplicador de precios
    updatePriceMultiplier(newMultiplier) {
        this.priceMultiplier = parseFloat(newMultiplier) || 1.0;
        console.log(`💰 Multiplicador de precios actualizado a: ${this.priceMultiplier}`);
    }

    // Obtener todos los productos con precios para un tipo de cliente
    getAllProductsForClient(clientType = 'general') {
        this.checkForUpdates();
        return this.products.map(product => this.getProductInfo(product, clientType));
    }
}

export default ProductManager;
