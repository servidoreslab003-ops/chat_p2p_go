const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Ruta del archivo usuarios.json
const USUARIOS_FILE = path.join(__dirname, 'usuarios.json');

// ============================================
// FUNCIONES
// ============================================

function leerUsuarios() {
    try {
        if (fs.existsSync(USUARIOS_FILE)) {
            const data = fs.readFileSync(USUARIOS_FILE, 'utf8');
            const parsed = JSON.parse(data);
            console.log(`📖 Leídos ${parsed.usuarios ? parsed.usuarios.length : 0} usuarios`);
            return parsed;
        } else {
            console.log('📄 Creando archivo usuarios.json');
            const empty = { usuarios: [] };
            fs.writeFileSync(USUARIOS_FILE, JSON.stringify(empty, null, 2));
            return empty;
        }
    } catch (error) {
        console.error('❌ Error al leer:', error.message);
        return { usuarios: [] };
    }
}

function guardarUsuarios(data) {
    try {
        // Verificar que data tenga la estructura correcta
        if (!data || typeof data !== 'object') {
            console.error('❌ Data inválida:', data);
            return false;
        }
        if (!data.usuarios || !Array.isArray(data.usuarios)) {
            console.error('❌ Data no tiene array usuarios:', data);
            return false;
        }
        
        fs.writeFileSync(USUARIOS_FILE, JSON.stringify(data, null, 2));
        console.log(`✅ Guardados ${data.usuarios.length} usuarios en el archivo`);
        return true;
    } catch (error) {
        console.error('❌ Error al guardar:', error.message);
        return false;
    }
}

// ============================================
// ENDPOINTS BÁSICOS
// ============================================

// GET: Obtener todos los usuarios
app.get('/usuarios', (req, res) => {
    console.log('📥 GET /usuarios');
    const data = leerUsuarios();
    res.json(data);
});

// GET: Obtener un usuario por ID
app.get('/usuarios/:id', (req, res) => {
    console.log(`📥 GET /usuarios/${req.params.id}`);
    const data = leerUsuarios();
    const usuario = data.usuarios.find(u => u.id === req.params.id);
    if (usuario) {
        res.json(usuario);
    } else {
        res.status(404).json({ error: 'Usuario no encontrado' });
    }
});

// POST: Guardar/Actualizar usuario (CORREGIDO)
app.post('/usuarios', (req, res) => {
    const { id, nombre, password, peer_id } = req.body;
    
    console.log('📝 POST /usuarios recibido:');
    console.log('  - id:', id);
    console.log('  - nombre:', nombre);
    console.log('  - password:', password ? '****' : 'sin password');
    console.log('  - peer_id:', peer_id);
    
    if (!id || !nombre) {
        console.log('❌ Error: Faltan id o nombre');
        return res.status(400).json({ error: 'Faltan id o nombre' });
    }
    
    // LEER TODOS LOS USUARIOS EXISTENTES
    let data = leerUsuarios();
    
    // Asegurar que data tenga la estructura correcta
    if (!data.usuarios || !Array.isArray(data.usuarios)) {
        data = { usuarios: [] };
    }
    
    // Buscar si el usuario ya existe por ID
    const indexExistente = data.usuarios.findIndex(u => u.id === id);
    
    // Buscar si el usuario ya existe por nombre (para evitar duplicados)
    const existePorNombre = data.usuarios.find(u => u.nombre === nombre && u.id !== id);
    
    if (existePorNombre) {
        console.log(`⚠️ Ya existe un usuario con el nombre "${nombre}"`);
        return res.status(400).json({ 
            error: `El nombre "${nombre}" ya está en uso`,
            usuario_existente: existePorNombre
        });
    }
    
    let usuario;
    
    if (indexExistente !== -1) {
        // Actualizar usuario existente
        usuario = data.usuarios[indexExistente];
        usuario.nombre = nombre;
        if (password) usuario.password = password;
        usuario.peer_id = peer_id || null;
        usuario.ultimo_activo = new Date().toISOString();
        // Asegurar que tenga los campos de amistad
        if (!usuario.amigos) usuario.amigos = [];
        if (!usuario.solicitudes) usuario.solicitudes = [];
        if (!usuario.mensajes_pendientes) usuario.mensajes_pendientes = [];
        console.log(`✏️ Usuario actualizado: ${nombre} (ID: ${id})`);
    } else {
        // Crear nuevo usuario
        usuario = {
            id: id,
            nombre: nombre,
            password: password || '',
            peer_id: peer_id || null,
            ultimo_activo: new Date().toISOString(),
            amigos: [],
            solicitudes: [],
            mensajes_pendientes: []
        };
        data.usuarios.push(usuario);
        console.log(`✅ Nuevo usuario creado: ${nombre} (ID: ${id})`);
    }
    
    // GUARDAR TODO EL ARRAY COMPLETO DE USUARIOS
    const success = guardarUsuarios(data);
    
    if (success) {
        console.log(`📤 Respondiendo con éxito. Total usuarios: ${data.usuarios.length}`);
        res.json({ success: true, usuario });
    } else {
        console.log('❌ Error al guardar');
        res.status(500).json({ error: 'Error al guardar' });
    }
});

// PUT: Actualizar peer_id
app.put('/usuarios/:id', (req, res) => {
    const { peer_id } = req.body;
    console.log(`✏️ PUT /usuarios/${req.params.id}: peer_id = ${peer_id}`);
    
    const data = leerUsuarios();
    const usuario = data.usuarios.find(u => u.id === req.params.id);
    
    if (!usuario) {
        console.log(`❌ Usuario ${req.params.id} no encontrado`);
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    usuario.peer_id = peer_id || null;
    usuario.ultimo_activo = new Date().toISOString();
    
    if (guardarUsuarios(data)) {
        res.json({ success: true, usuario });
    } else {
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

// ============================================
// ENDPOINTS DE AMISTAD
// ============================================

// Enviar solicitud de amistad
app.post('/amistad/solicitar', (req, res) => {
    const { emisorId, receptorId } = req.body;
    
    console.log(`🤝 Solicitud de amistad: ${emisorId} -> ${receptorId}`);
    
    if (!emisorId || !receptorId) {
        return res.status(400).json({ error: 'Faltan IDs' });
    }
    
    const data = leerUsuarios();
    const emisor = data.usuarios.find(u => u.id === emisorId);
    const receptor = data.usuarios.find(u => u.id === receptorId);
    
    if (!emisor || !receptor) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Verificar si ya son amigos
    if (emisor.amigos && emisor.amigos.includes(receptorId)) {
        return res.status(400).json({ error: 'Ya son amigos' });
    }
    
    // Verificar si ya hay solicitud pendiente
    if (receptor.solicitudes && receptor.solicitudes.includes(emisorId)) {
        return res.status(400).json({ error: 'Solicitud ya enviada' });
    }
    
    // Agregar solicitud
    if (!receptor.solicitudes) receptor.solicitudes = [];
    if (!receptor.solicitudes.includes(emisorId)) {
        receptor.solicitudes.push(emisorId);
    }
    
    if (guardarUsuarios(data)) {
        console.log(`✅ Solicitud enviada de ${emisor.nombre} a ${receptor.nombre}`);
        res.json({ 
            success: true, 
            message: `Solicitud enviada a ${receptor.nombre}`,
            solicitudes: receptor.solicitudes
        });
    } else {
        res.status(500).json({ error: 'Error al guardar' });
    }
});

// Aceptar solicitud de amistad
app.post('/amistad/aceptar', (req, res) => {
    const { usuarioId, solicitanteId } = req.body;
    
    console.log(`✅ Aceptar solicitud: ${solicitanteId} -> ${usuarioId}`);
    
    if (!usuarioId || !solicitanteId) {
        return res.status(400).json({ error: 'Faltan IDs' });
    }
    
    const data = leerUsuarios();
    const usuario = data.usuarios.find(u => u.id === usuarioId);
    const solicitante = data.usuarios.find(u => u.id === solicitanteId);
    
    if (!usuario || !solicitante) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Eliminar solicitud
    if (usuario.solicitudes) {
        usuario.solicitudes = usuario.solicitudes.filter(id => id !== solicitanteId);
    }
    
    // Agregar como amigos mutuamente
    if (!usuario.amigos) usuario.amigos = [];
    if (!solicitante.amigos) solicitante.amigos = [];
    
    if (!usuario.amigos.includes(solicitanteId)) {
        usuario.amigos.push(solicitanteId);
    }
    if (!solicitante.amigos.includes(usuarioId)) {
        solicitante.amigos.push(usuarioId);
    }
    
    if (guardarUsuarios(data)) {
        console.log(`✅ Ahora son amigos: ${solicitante.nombre} y ${usuario.nombre}`);
        res.json({ 
            success: true, 
            message: `Ahora son amigos`,
            amigos: usuario.amigos
        });
    } else {
        res.status(500).json({ error: 'Error al guardar' });
    }
});

// Rechazar solicitud de amistad
app.post('/amistad/rechazar', (req, res) => {
    const { usuarioId, solicitanteId } = req.body;
    
    console.log(`❌ Rechazar solicitud: ${solicitanteId} -> ${usuarioId}`);
    
    const data = leerUsuarios();
    const usuario = data.usuarios.find(u => u.id === usuarioId);
    
    if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    if (usuario.solicitudes) {
        usuario.solicitudes = usuario.solicitudes.filter(id => id !== solicitanteId);
    }
    
    if (guardarUsuarios(data)) {
        res.json({ success: true, message: 'Solicitud rechazada' });
    } else {
        res.status(500).json({ error: 'Error al guardar' });
    }
});

// ============================================
// ENDPOINTS DE MENSAJES OFFLINE
// ============================================

// Enviar mensaje offline
app.post('/mensaje/enviar', (req, res) => {
    const { emisorId, receptorId, mensaje } = req.body;
    
    console.log(`💬 Mensaje offline: ${emisorId} -> ${receptorId}: "${mensaje}"`);
    
    if (!emisorId || !receptorId || !mensaje) {
        return res.status(400).json({ error: 'Faltan datos' });
    }
    
    const data = leerUsuarios();
    const emisor = data.usuarios.find(u => u.id === emisorId);
    const receptor = data.usuarios.find(u => u.id === receptorId);
    
    if (!emisor || !receptor) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Verificar si son amigos
    if (!emisor.amigos || !emisor.amigos.includes(receptorId)) {
        return res.status(403).json({ error: 'No son amigos' });
    }
    
    // Guardar mensaje en pendientes del receptor
    if (!receptor.mensajes_pendientes) receptor.mensajes_pendientes = [];
    receptor.mensajes_pendientes.push({
        de: emisorId,
        de_nombre: emisor.nombre,
        mensaje: mensaje,
        timestamp: new Date().toISOString(),
        leido: false
    });
    
    if (guardarUsuarios(data)) {
        console.log(`✅ Mensaje guardado para ${receptor.nombre} (${receptor.mensajes_pendientes.length} pendientes)`);
        res.json({ 
            success: true, 
            message: 'Mensaje guardado',
            pendientes: receptor.mensajes_pendientes.length
        });
    } else {
        res.status(500).json({ error: 'Error al guardar mensaje' });
    }
});

// Obtener mensajes pendientes
app.get('/mensaje/pendientes/:id', (req, res) => {
    const id = req.params.id;
    console.log(`📩 Consultando mensajes pendientes para: ${id}`);
    
    const data = leerUsuarios();
    const usuario = data.usuarios.find(u => u.id === id);
    
    if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const pendientes = usuario.mensajes_pendientes || [];
    console.log(`📩 ${pendientes.length} mensajes pendientes para ${usuario.nombre}`);
    res.json({ pendientes });
});

// Marcar mensajes como leídos
app.post('/mensaje/leidos', (req, res) => {
    const { usuarioId } = req.body;
    console.log(`📖 Marcando mensajes como leídos para: ${usuarioId}`);
    
    const data = leerUsuarios();
    const usuario = data.usuarios.find(u => u.id === usuarioId);
    
    if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Limpiar mensajes ya leídos
    if (usuario.mensajes_pendientes) {
        usuario.mensajes_pendientes = usuario.mensajes_pendientes.filter(m => !m.leido);
    }
    
    if (guardarUsuarios(data)) {
        res.json({ success: true });
    } else {
        res.status(500).json({ error: 'Error al guardar' });
    }
});

// ============================================
// ESTADO
// ============================================

app.get('/status', (req, res) => {
    const data = leerUsuarios();
    const enLinea = data.usuarios.filter(u => u.peer_id && u.peer_id !== null);
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        total_usuarios: data.usuarios.length,
        usuarios_en_linea: enLinea.length
    });
});

// ============================================
// INICIAR
// ============================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📄 GET  /usuarios  - Todos los usuarios`);
    console.log(`📝 POST /usuarios  - Guardar usuario`);
    console.log(`🤝 POST /amistad/solicitar - Enviar solicitud`);
    console.log(`✅ POST /amistad/aceptar - Aceptar solicitud`);
    console.log(`❌ POST /amistad/rechazar - Rechazar solicitud`);
    console.log(`💬 POST /mensaje/enviar - Enviar mensaje offline`);
    console.log(`📩 GET  /mensaje/pendientes/:id - Obtener mensajes pendientes`);
    console.log(`📖 POST /mensaje/leidos - Marcar mensajes como leídos`);
    console.log(`📊 GET  /status    - Estado del servidor`);
    console.log('\n✅ Servidor listo!');
    console.log(`📁 Archivo usuarios.json: ${USUARIOS_FILE}`);
});
