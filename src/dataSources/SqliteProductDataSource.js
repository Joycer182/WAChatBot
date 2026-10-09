// Implementación de ProductDataSource usando SQLite (better-sqlite3).
//
// Conecta con la base de datos LocalJose.db y adapta las consultas al esquema
// existente:
//   productos:  codigo, descripcion, usd_g, usd_i, usd_m, id_categoria, descontinuado
//   categorias: id, nombre
//
// Los productos descontinuados (descontinuado = 1) se excluyen de todas las
// consultas. El INNER JOIN con categorias permite devolver el nombre de la
// categoría igual que lo hacía el Excel.

import fs from 'fs';
import Database from 'better-sqlite3';
import ProductDataSource from './ProductDataSource.js';

// Columnas que se devuelven para cada producto (mismo formato que el Excel).
const PRODUCT_COLUMNS = `
    p.codigo             AS codigo,
    p.descripcion        AS descripcion,
    c.nombre             AS categoria,
    p.usd_m              AS precioTienda,
    p.usd_i              AS precioInstalador,
    p.usd_g              AS precioGeneral
`;

const PRODUCT_JOIN = `
    FROM productos p
    INNER JOIN categorias c ON p.id_categoria = c.id
`;

class SqliteProductDataSource extends ProductDataSource {
    constructor(dbFilePath) {
        super();
        this.dbFilePath = dbFilePath;
        this.db = null;
        this.statements = {};
    }

    // Abre la base de datos (solo lectura) y prepara las consultas.
    async initialize() {
        if (!fs.existsSync(this.dbFilePath)) {
            console.error(`❌ Base de datos no encontrada: ${this.dbFilePath}`);
            return false;
        }

        try {
            this.db = new Database(this.dbFilePath, { readonly: true });

            this.statements.byCode = this.db.prepare(`
                SELECT ${PRODUCT_COLUMNS}
                ${PRODUCT_JOIN}
                WHERE CAST(p.codigo AS TEXT) = ? AND p.descontinuado = 0
            `);

            this.statements.byCategory = this.db.prepare(`
                SELECT ${PRODUCT_COLUMNS}
                ${PRODUCT_JOIN}
                WHERE c.nombre LIKE ? AND p.descontinuado = 0
            `);

            this.statements.search = this.db.prepare(`
                SELECT ${PRODUCT_COLUMNS}
                ${PRODUCT_JOIN}
                WHERE p.descripcion LIKE ? AND p.descontinuado = 0
            `);

            this.statements.categories = this.db.prepare(`
                SELECT DISTINCT c.nombre AS nombre
                ${PRODUCT_JOIN}
                WHERE p.descontinuado = 0
                ORDER BY c.nombre
            `);

            this.statements.allProducts = this.db.prepare(`
                SELECT ${PRODUCT_COLUMNS}
                ${PRODUCT_JOIN}
                WHERE p.descontinuado = 0
                ORDER BY p.codigo
            `);

            this.statements.counts = this.db.prepare(`
                SELECT
                    COUNT(*)                    AS totalProductos,
                    COUNT(DISTINCT id_categoria) AS categorias
                FROM productos
                WHERE descontinuado = 0
            `);

            console.log(`✅ Base de datos conectada: ${this.dbFilePath}`);
            return true;
        } catch (error) {
            console.error('❌ Error conectando con la base de datos:', error.message);
            return false;
        }
    }

    async getProductByCode(codigo) {
        if (!this.db) return null;
        return this.statements.byCode.get(String(codigo)) || null;
    }

    async getProductsByCategory(categoria) {
        if (!this.db) return [];
        return this.statements.byCategory.all(`%${categoria}%`);
    }

    async searchProducts(query) {
        if (!this.db) return [];
        return this.statements.search.all(`%${query}%`);
    }

    async getAllCategories() {
        if (!this.db) return [];
        return this.statements.categories.all().map(row => row.nombre);
    }

    async getAllProducts() {
        if (!this.db) return [];
        return this.statements.allProducts.all();
    }

    async getCounts() {
        if (!this.db) return { totalProductos: 0, categorias: 0 };
        return this.statements.counts.get();
    }

    async close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log('🔌 Base de datos cerrada.');
        }
    }
}

export default SqliteProductDataSource;
