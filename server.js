const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const USUARIOS_FILE = path.join(__dirname, 'usuarios.json');

// ============================================
// FUNCIONES
// ============================================

function leerUsuarios() {
    try {
        if (fs.existsSync(USUARIOS_FILE)) {
            const data = fs.readFileSync(USUARIOS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('❌ Error al leer:', error.message);
    }
    return { usuarios: [] };
}

function guardarUsuarios(data) {
    try {
        fs.writeFileSync(USUARIOS_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('❌ Error al guardar:', error.message);
        return false;
    }
}

// ============================================
// ENDPOINTS
// ============================================

// GET: Obtener todos los usuarios
app.get('/usuarios', (req, res) => {
    const data = leerUsuarios();
    res.json(data);
});

// GET: Obtener un usuario por ID
app.get('/usuarios/:id', (req, res) => {
    const data = leerUsuarios();
    const usuario = data.usuarios.find(u => u.id === req.params.id);
    if (usuario) {
        res.json(usuario);
    } else {
        res.status(404).json({ error: 'Usuario no encontrado' });
    }
});

// POST: Guardar/Actualizar usuario
app.post('/usuarios', (req, res) => {
    const { id, nombre, password, peer_id } = req.body;
    
    if (!id || !nombre) {
        return res.status(400).json({ error: 'Faltan id o nombre' });
    }
    
    const data = leerUsuarios();
    let usuario = data.usuarios.find(u => u.id === id);
    
    if (usuario) {
        usuario.nombre = nombre;
        if (password) usuario.password = password;
        usuario.peer_id = peer_id || null;
        usuario.ultimo_activo = new Date().toISOString();
    } else {
        usuario = {
            id: id,
            nombre: nombre,
            password: password || '',
            peer_id: peer_id || null,
            ultimo_activo: new Date().toISOString(),
            amigos: [],           // ← Lista de IDs de amigos
            solicitudes: [],      // ← Solicitudes de amistad recibidas
            mensajes_pendientes: [] // ← Mensajes offline
        };
        data.usuarios.push(usuario);
    }
    
    if (guardarUsuarios(data)) {
        res.json({ success: true, usuario });
    } else {
        res.status(500).json({ error: 'Error al guardar' });
    }
});

// ============================================
// AMISTADES
// ============================================

// Enviar solicitud de amistad
app.post('/amistad/solicitar', (req, res) => {
    const { emisorId, receptorId } = req.body;
    
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
    receptor.solicitudes.push(emisorId);
    
    if (guardarUsuarios(data)) {
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
    usuario.solicitudes = usuario.solicitudes.filter(id => id !== solicitanteId);
    
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
    
    const data = leerUsuarios();
    const usuario = data.usuarios.find(u => u.id === usuarioId);
    
    if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    usuario.solicitudes = usuario.solicitudes.filter(id => id !== solicitanteId);
    
    if (guardarUsuarios(data)) {
        res.json({ success: true, message: 'Solicitud rechazada' });
    } else {
        res.status(500).json({ error: 'Error al guardar' });
    }
});

// ============================================
// MENSAJES OFFLINE
// ============================================

// Enviar mensaje (incluso si el otro está offline)
app.post('/mensaje/enviar', (req, res) => {
    const { emisorId, receptorId, mensaje } = req.body;
    
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
        res.json({ 
            success: true, 
            message: 'Mensaje guardado (entregado cuando el usuario se conecte)',
            pendientes: receptor.mensajes_pendientes.length
        });
    } else {
        res.status(500).json({ error: 'Error al guardar mensaje' });
    }
});

// Obtener mensajes pendientes (cuando un usuario se conecta)
app.get('/mensaje/pendientes/:id', (req, res) => {
    const id = req.params.id;
    const data = leerUsuarios();
    const usuario = data.usuarios.find(u => u.id === id);
    
    if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const pendientes = usuario.mensajes_pendientes || [];
    res.json({ pendientes });
});

// Marcar mensajes como leídos (cuando se entregan)
app.post('/mensaje/leidos', (req, res) => {
    const { usuarioId } = req.body;
    
    const data = leerUsuarios();
    const usuario = data.usuarios.find(u => u.id === usuarioId);
    
    if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Marcar todos como leídos
    if (usuario.mensajes_pendientes) {
        usuario.mensajes_pendientes.forEach(m => m.leido = true);
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
});
