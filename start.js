#!/usr/bin/env node

console.log(`
🤖 BOT DE WHATSAPP PARA ATENCIÓN AL CLIENTE
============================================

¡Bienvenido! Este script te ayudará a configurar y ejecutar tu bot de WhatsApp.

PASOS PARA INICIAR:

1️⃣ INSTALAR DEPENDENCIAS
   npm install

2️⃣ CONFIGURAR VARIABLES DE ENTORNO
   cp env.example .env
   # Edita el archivo .env con tu información

3️⃣ EJECUTAR EL BOT
   npm start

4️⃣ ESCANEAR QR
   - Aparecerá un código QR en la consola
   - Escanéalo con WhatsApp Web
   - ¡El bot estará listo!

COMANDOS ÚTILES:

📊 Ver estadísticas:     npm run stats
🧹 Limpiar logs:         npm run clean
📤 Exportar conversaciones: npm run export
💾 Crear backup:         npm run backup
🛠️ Utilidades:          npm run utils

MONITOREO:

🌐 Panel de estado:      http://localhost:3000/status
📝 Ver logs:            http://localhost:3000/logs

PERSONALIZACIÓN:

✏️ Edita src/config.js para personalizar respuestas
✏️ Edita .env para configurar tu empresa
✏️ Modifica src/index.js para agregar funcionalidades

¿Necesitas ayuda? Revisa el README.md para más detalles.

¡Que tengas éxito con tu bot! 🚀
`);

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
    console.log(`
⚠️  DEPENDENCIAS NO INSTALADAS

Ejecuta primero:
npm install
`);
    process.exit(1);
}

// Verificar si existe el archivo .env
if (!fs.existsSync(path.join(__dirname, '.env'))) {
    console.log(`
⚠️  ARCHIVO .env NO ENCONTRADO

Ejecuta:
cp env.example .env

Y luego edita el archivo .env con tu información.
`);
}

console.log(`
✅ Todo listo para ejecutar:
npm start
`);
