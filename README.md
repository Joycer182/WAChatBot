# 🤖 Bot de WhatsApp para Atención al Cliente

Un chatbot de WhatsApp robusto y modular diseñado para automatizar la atención al cliente, gestionar consultas de productos y ofrecer precios diferenciados, todo integrado con una base de datos de productos en Excel.

## ✨ Características

- **Integración con Excel**: Lee productos directamente desde archivo `TablaProductos.xlsx`
- **Consulta Robusta de Tasa de Cambio (BCV)**: Sistema de caché inteligente y persistente para las tasas del BCV. La lógica de actualización garantiza tener siempre la tasa más reciente:
  - **Actualización Diaria Asegurada**: Si la tasa en caché es de un día anterior, se actualiza automáticamente.
  - **Captura Agresiva**: Durante la ventana de publicación del BCV (3-6 PM VET), el bot consulta constantemente para obtener la nueva tasa apenas esté disponible.
  - **Mecanismo de Recuperación**: Si el bot estuvo inactivo durante la ventana de actualización, al reactivarse detecta que no tiene la tasa del día y realiza la consulta para ponerse al día. Esto minimiza las llamadas a la API fuera de hora, pero garantiza que la tasa esté siempre vigente.
  - **Resiliencia ante Fallos (Timeout & Fallback)**: Se implementó un timeout de 5 segundos para las consultas al BCV. Si la página tarda en responder o está caída, el bot evita quedarse "colgado" y automáticamente utiliza la última tasa exitosa almacenada en caché, advirtiendo al usuario que la información podría no estar actualizada.
  - **Actualización Manual de Tasas (Contingencia)**: Permite a los vendedores autorizados establecer manualmente las tasas de cambio mediante un comando. Esta función es vital cuando la página del BCV presenta fallas prolongadas. Las tasas manuales son utilizadas por el sistema hasta que se logra una conexión exitosa con el BCV, momento en el cual la tasa oficial toma prioridad nuevamente.
- **Múltiples Tipos de Cliente**: Precios diferenciados para Tiendas, Instaladores y Clientes Generales
- **Flujo de Aprobación para Tipos de Cliente**: Implementa un proceso de aprobación por parte de los vendedores para los cambios de tipo de cliente (Tienda, Instalador, General), asegurando un control y gestión adecuados.
- **Mensaje de Bienvenida Automático**: Saluda a los nuevos usuarios en su primera interacción, independientemente del mensaje que envíen, y los registra automáticamente con un tipo de cliente predeterminado, mejorando la experiencia inicial.
- **Identificación Personalizada del Cliente**: Utiliza el nombre de perfil de WhatsApp (`pushname`) del cliente para una comunicación más personal y profesional, en lugar de depender del nombre guardado en los contactos del teléfono.
- **Persistencia de Datos del Cliente**: Recuerda el tipo de cliente seleccionado por cada usuario entre reinicios.
- **Estadísticas de Uso**: Rastrea el número de cotizaciones por comando y guarda un historial con marcas de tiempo para análisis futuros.
- **Cotización Rápida**: Permite cotizar múltiples productos y cantidades en un solo comando.
- **Multiplicador de Precios**: Factor configurable para ajustar precios globalmente.
- **Sistema de Comandos Modular**: Arquitectura limpia que permite agregar nuevos comandos fácilmente en `commandManager.js`.
- **Búsqueda Inteligente**: Busca productos por código, descripción o categoría
- **Respuestas Automáticas**: Responde automáticamente a saludos, consultas sobre precios, productos y horarios
- **Mensajes y Respuestas Configurables**: Centraliza todos los textos del bot en `config.js` para una fácil personalización.
- **Logging Completo**: Registra todas las conversaciones y eventos del bot
- **API REST**: Endpoints para monitorear el estado del bot y productos
- **Configuración Flexible**: Variables de entorno para personalizar respuestas
- **Manejo de Errores**: Sistema robusto de manejo de errores y reconexión
- **Prevención de Eco de Mensajes**: El bot identifica y descarta los mensajes que él mismo envía a los vendedores para evitar bucles de respuesta.

## 🚀 Instalación y Configuración

### 1. Instalar Dependencias
```bash
npm install
```

### 2. Configurar Variables de Entorno
```bash
# Copia el archivo de ejemplo. No subas tu archivo .env a un repositorio.
cp env.example .env

# Edita el archivo .env con tu información
```

### 3. Configurar Archivo Excel
```bash
# Si no tienes un archivo de productos, puedes generar uno de ejemplo (opcional):
# node create-sample-excel.js 
# (Nota: este script no está incluido en el proyecto base, es un ejemplo de uso)
# O coloca tu propio archivo TablaProductos.xlsx en la raíz del proyecto
```

**Estructura del archivo Excel:**
- `Codigo`: ID único del producto
- `Descripcion`: Nombre del producto
- `Categoria`: Categoría del producto
- `UsdM`: Precio para tiendas
- `UsdI`: Precio para instaladores
- `UsdG`: Precio para clientes generales

### 4. Configurar Vendedores (Opcional)
Para utilizar el comando `/enviar`, es necesario crear un archivo `vendedores.json` en la carpeta `src/data/`. Este archivo contiene los alias y números de WhatsApp de los vendedores a quienes se les pueden enviar las cotizaciones.

**Formato del archivo `src/data/vendedores.json`:**
```json
{
  "nombre_vendedor1": "584140000001",
  "alias_vendedor2": "584120000002"
}
```
- La **clave** es el alias que el cliente usará en el comando (ej. `/enviar nombre_vendedor1`). Se recomienda usar minúsculas y sin espacios.
- El **valor** es el número de WhatsApp del vendedor en formato internacional, sin el símbolo `+`.

### 4. Personalizar Configuración
Edita el archivo `.env` con la información de tu empresa:

```env
EMPRESA_NOMBRE=Mi Empresa
EMPRESA_EMAIL=contacto@miempresa.com
EMPRESA_WEB=www.miempresa.com
EMPRESA_DIRECCION=Mi dirección comercial

# Configuración de precios
PRICE_MULTIPLIER=1.0  # Multiplicador global de precios
DEFAULT_CLIENT_TYPE=general
CLIENT_TYPE_GENERAL=general
CLIENT_TYPE_TIENDA=tienda
CLIENT_TYPE_INSTALADOR=instalador

# Versión del catálogo
CATALOG_VERSION=1.0 # Versión del catálogo de precios

# Configuración de cotizaciones
MAX_QUOTE_QUANTITY=10000 # Límite para diferenciar entre una cantidad y un código de producto en cotizaciones rápidas
```

### 5. Ejecutar el Bot
```bash
# Modo producción
npm start

# Modo desarrollo (con auto-reload)
npm run dev
```

## 📱 Primer Uso

1. **Ejecuta el bot**: `npm start`
2. **Escanea el QR**: Aparecerá un código QR en la consola
3. **Escanea con WhatsApp**: Usa WhatsApp Web para escanear el código
4. **¡Listo!**: El bot estará activo y responderá mensajes

## 🎯 Comandos Disponibles

### Comandos Generales
- `/help` o `/ayuda` - Muestra el menú de ayuda
- `/info` o `/informacion` - Información de contacto
- `/horarios` - Horarios de atención
- `/bcv` - Muestra la tasa de cambio del BCV

### Comandos de Productos
- `/productos` - Información del catálogo
- `/categorias` - Ver categorías disponibles
- `/buscar [término]` - Buscar productos
- `/precio [código] [cant] ...` - Consulta un producto o crea una cotización para varios. 
  - **Uso simple**: `/precio 11050`
  - **Cotización rápida**: `/precio 11050 5 11030 2 10000`
  - Si no se especifica cantidad, se asume 1.
  - El bot valida cada par de código-cantidad. Si un código no existe o la cantidad es inválida (ej. texto), el ítem se descarta de la cotización y se reporta como un error al final del mensaje.
- `/foto [código]` o `/imagen [código]` - Solicita una foto del producto.
- `/preciog [código] [cant] ...` - Consulta un producto o crea una cotización para varios, *siempre usando el precio general*.
  - Funciona con la misma lógica de cotización y validación de errores que el comando `/precio`, pero fuerza el tipo de cliente a "general".
- `/codigo` - Información general sobre cómo consultar precios.

### Comandos por Tipo de Cliente
Los comandos para solicitar acceso a los diferentes tipos de precios se configuran directamente en el archivo `.env`. Por ejemplo, si defines `CLIENT_TYPE_TIENDA=distribuidor`, el comando para solicitar ese rol será `/distribuidor`.

- `/[valor de CLIENT_TYPE_TIENDA]` - Solicita acceso a precios para tiendas.
- `/[valor de CLIENT_TYPE_INSTALADOR]` - Solicita acceso a precios para instaladores.
- `/[valor de CLIENT_TYPE_GENERAL]` - Solicita acceso a precios para clientes generales.
- `/divisas [código] [cant] ...` - (Para Tiendas/Instaladores) Muestra el precio base (sin multiplicador) para uno o varios productos.
  - **Uso simple**: `/divisas 11050`
  - **Cotización rápida**: `/divisas 11050 5 11030 2`
  - Funciona con la misma lógica de cotización y validación de errores que el comando `/precio`.

### Comandos Administrativos
- `/stats` - Muestra estadísticas del sistema, incluyendo total de productos, desglose de cotizaciones y registros históricos.
- `/enviar [vendedor]` - Envía la última cotización generada a un vendedor de la lista `vendedores.json`.
  - **Nota técnica**: Cuando el bot envía un mensaje a un vendedor, guarda el ID de ese mensaje. Si el mismo mensaje es recibido de vuelta (un "eco"), el bot lo ignora para evitar procesar sus propias respuestas.
- `/aprobar [número_cliente] [tipo]` - (Solo Vendedores) Aprueba una solicitud pendiente de cambio de tipo de cliente.
- `/rechazar [número_cliente]` - (Solo Vendedores) Rechaza una solicitud pendiente de cambio de tipo de cliente.
- `/actualizarbcv [TasaUSD] [TasaEUR]` - (Solo Vendedores) Establece manualmente las tasas de cambio del BCV.
  - Útil para contingencias cuando la página del BCV está caída. Acepta punto o coma como separador decimal.
  - **Ejemplo**: `/actualizarbcv 36.50 39.10`

## 🤖 Respuestas Automáticas

El bot responde automáticamente a:

- **Saludos**: "hola", "buenos días", "buenas tardes"
- **Despedidas**: "gracias", "chau", "adiós", "hasta luego"
- **Consultas de precios**: "precio", "costo", "cuánto cuesta"
- **Productos**: "producto", "catalogo", "qué ofrecen"
- **Horarios**: "horario", "cuándo", "disponible"
- **Problemas**: "problema", "error", "no funciona"
- **Búsquedas genéricas**: "buscar", "necesito", "quiero"
- **Mensajes no entendidos**: Si el bot no reconoce un comando o texto, responde con una guía.

## 📊 Monitoreo

### API Endpoints

- `GET /` - Estado general del bot
- `GET /status` - Estado detallado y métricas
- `GET /products` - Lista de productos y estadísticas
- `GET /products/search/:query` - Buscar productos por término

### Archivos de Log

- `src/data/logs/chatbot.log` - Logs del sistema
- `src/data/conversations/[numero].json` - Historial de conversaciones por cliente

## 🔧 Personalización

### Modificar Respuestas
Todas las respuestas predefinidas, mensajes de comandos y palabras clave se encuentran en el archivo `src/config.js`. Modifica el objeto `mensajes` y `palabrasClave` para adaptar el bot a tu tono de voz.

### Agregar Nuevos Comandos
1.  Abre el archivo `src/commandManager.js`.
2.  Crea una nueva función manejadora para tu comando (ej: `async handleMiComando(args, contact)`).
3.  Registra el comando y su alias en la función `initializeCommands()`:
    ```javascript
    this.registerCommand('micomando', this.handleMiComando.bind(this));
    ```

## 🛠️ Estructura del Proyecto

```
WSChatBot/
├── src/
│   ├── index.js            # Archivo principal del bot
│   ├── commandManager.js     # Gestiona todos los comandos y su lógica
│   ├── productManager.js     # Gestiona la carga y búsqueda de productos desde Excel
│   ├── config.js             # Configuración centralizada y textos del bot
│   └── data/                 # Carpeta para todos los datos generados y persistentes
│       ├── conversations/    # Conversaciones guardadas
│       ├── logs/             # Logs del sistema
│       ├── product_images/   # Imágenes de los productos (ej. 11050.jpg)
│       ├── client_data.json  # Almacena el tipo de cliente para persistencia
│       ├── vendedores.json   # Lista de vendedores para el comando /enviar
│       └── ...               # Otros archivos de datos (caché, estadísticas)
├── .env                    # Variables de entorno
├── env.example             # Ejemplo de configuración
├── package.json            # Dependencias y scripts
└── README.md               # Este archivo
```

## 🔒 Seguridad

- Las conversaciones se guardan localmente en la carpeta `src/data/conversations/`
- No se comparten datos con terceros
- La preferencia de tipo de cliente se guarda localmente en `src/data/client_data.json`
- Sesión de WhatsApp cifrada localmente
- Logs sensibles protegidos

## 🚨 Solución de Problemas

### Bot no responde
1. Verifica que el bot esté conectado: `GET http://localhost:3000/status`
2. Revisa los logs en la consola o en el archivo `logs/chatbot.log`
3. Reinicia el bot: `Ctrl+C` y `npm start`

### Error de autenticación
1. Elimina la carpeta `.wwebjs_auth`
2. Reinicia el bot
3. Escanea el QR nuevamente

### Problemas de conexión
1. Verifica tu conexión a internet
2. Revisa que WhatsApp Web funcione
3. Reinicia el bot

## 🛠️ Script de Utilidades (utils.js)

El proyecto incluye un script de utilidades (`src/utils.js`) para realizar tareas de mantenimiento y gestión del bot desde la línea de comandos.

Para usarlo, ejecuta `node src/utils.js [comando]`.

### Comandos Disponibles

-   `stats`: Muestra estadísticas generales del bot, como el número de logs, conversaciones guardadas y el estado de la sesión de WhatsApp.
-   `clean [días]`: Limpia los archivos de log más antiguos que el número de días especificado. Por defecto, mantiene los logs de los últimos 7 días.
-   `export [archivo]`: Exporta todas las conversaciones guardadas a un único archivo JSON. Por defecto, se guarda en `conversations_export.json`.
-   `clear-session`: Elimina la carpeta de sesión de WhatsApp (`.wwebjs_auth`). Esto es útil si tienes problemas de autenticación y necesitas escanear el código QR de nuevo.
-   `backup`: Crea una copia de seguridad de las conversaciones y los logs en una nueva carpeta dentro de `src/backups`.
-   `help`: Muestra un mensaje de ayuda con todos los comandos disponibles.

### Ejemplos de Uso

```bash
# Ver estadísticas
node src/utils.js stats

# Limpiar logs de más de 30 días
node src/utils.js clean 30

# Exportar conversaciones a un archivo específico
node src/utils.js export mis_chats.json

# Forzar un nuevo inicio de sesión
node src/utils.js clear-session
```

## 📈 Próximas Mejoras

- [x] Persistencia de datos de cliente (tipo de cliente)
- [ ] Integración con base de datos (SQLite, etc.) para productos y clientes
- [ ] Respuestas con IA/ML
- [ ] Integración con CRM
- [ ] Soporte para multimedia
- [ ] Programación de mensajes
- [ ] Analytics avanzados

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia ISC. Ver el archivo `LICENSE` para más detalles.

## 📞 Soporte

Si tienes problemas o preguntas:

1. Revisa la documentación
2. Consulta los logs del sistema
3. Abre un "Issue" en el repositorio de GitHub del proyecto.

---

**¡Disfruta usando tu bot de WhatsApp! 🎉**
