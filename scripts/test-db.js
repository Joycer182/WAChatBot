// Smoke test de la capa de datos SQLite.
//
// Verifica que SqliteProductDataSource devuelve la información esperada desde
// LocalJose.db, sin necesidad de levantar el bot ni escanear el QR.
//
// Uso:
//   node scripts/test-db.js
//
// Se puede sobrescribir la ruta de la base de datos con la variable de entorno
// SQLITE_DB_PATH (relativa a la raíz del repositorio).

import path from 'path';
import { fileURLToPath } from 'url';
import SqliteProductDataSource from '../src/dataSources/SqliteProductDataSource.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const dbPath = path.resolve(repoRoot, process.env.SQLITE_DB_PATH || 'src/data/LocalJose.db');

let passed = 0;
let failed = 0;

function check(descripcion, condicion, extra = '') {
    if (condicion) {
        passed++;
        console.log(`✅ ${descripcion}`);
    } else {
        failed++;
        console.log(`❌ ${descripcion}${extra ? ` (${extra})` : ''}`);
    }
}

async function main() {
    console.log(`🔎 Probando la base de datos: ${dbPath}\n`);

    const dataSource = new SqliteProductDataSource(dbPath);
    const ok = await dataSource.initialize();
    check('Se conecta y prepara las consultas', ok === true);

    if (!ok) {
        await dataSource.close();
        process.exit(1);
    }

    const counts = await dataSource.getCounts();
    console.log(`   totalProductos=${counts.totalProductos}, categorias=${counts.categorias}`);
    check('Hay productos disponibles', counts.totalProductos > 0, `totalProductos=${counts.totalProductos}`);
    check('Hay categorías disponibles', counts.categorias > 0, `categorias=${counts.categorias}`);

    const product = await dataSource.getProductByCode('10000');
    console.log(`   getProductByCode('10000') =`, JSON.stringify(product));
    check('getProductByCode devuelve un producto', !!product);
    check('El producto mapea los precios (usd_g)', product && Number(product.precioGeneral) === 25, `precioGeneral=${product && product.precioGeneral}`);
    check('El producto incluye la categoría (INNER JOIN)', product && typeof product.categoria === 'string' && product.categoria.length > 0);

    const missing = await dataSource.getProductByCode('999999');
    check('getProductByCode con código inexistente devuelve null', missing === null);

    const search = await dataSource.searchProducts('breaker');
    console.log(`   searchProducts('breaker') = ${search.length} resultados`);
    check('searchProducts encuentra resultados', search.length > 0, `resultados=${search.length}`);

    const categories = await dataSource.getAllCategories();
    console.log(`   getAllCategories() = ${categories.length} categorías`);
    check('getAllCategories devuelve nombres de categorías', categories.length > 0 && categories.every(c => typeof c === 'string' && c.length > 0));

    const allProducts = await dataSource.getAllProducts();
    check('getAllProducts es consistente con el total', allProducts.length === counts.totalProductos, `allProducts=${allProducts.length}, total=${counts.totalProductos}`);

    await dataSource.close();

    console.log(`\nResultado: ${passed} correctas, ${failed} fallidas.`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
    console.error('❌ Error inesperado durante el smoke test:', error);
    process.exit(1);
});
