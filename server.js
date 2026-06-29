const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

const USUARIOS_FILE = path.join(__dirname, 'usuarios.json');

// ============================================
// FUNCIONES
// ============================================

function leerUsuarios() {
    try {
        if (fs.existsSync(USUARIOS_FILE)) {
            const data = fs.readFileSync(USUARIOS_FILE, 'utf8');
            const parsed = JSON.parse(data);
            return parsed;
        }
    } catch (error) {
        console.error('❌ Error al leer:', error.message);
    }
    return { usuarios: [] };
}

function guardarUsuarios(data) {
    try {
        if (!data || typeof data !== 'object' || !data.usuarios || !Array.isArray(data.usuarios)) {
            console.error('❌ Data inválida');
            return false;
        }
        fs.writeFileSync(USUARIOS_FILE, JSON.stringify(data, null, 2));
        console.log(`✅ Guardados ${data.usuarios.length} usuarios`);
        return true;
    } catch (error) {
        console.error('❌ Error al guardar:', error.message);
        return false;
    }
}

// ============================================
// ENDPOINTS BÁSICOS
// ============================================

app.get('/usuarios', (req, res) => {
    const data = leerUsuarios();
    res.json(data);
});

app.get('/usuarios/:id', (req, res) => {
    const data = leerUsuarios();
    const usuario = data.usuarios.find(u => u.id === req.params.id);
    if (usuario) {
        res.json(usuario);
    } else {
        res.status(404).json({ error: 'Usuario no encontrado' });
    }
});

app.post('/usuarios', (req, res) => {
    const { id, nombre, password, peer_id } = req.body;
    
    console.log('📝 POST /usuarios:', { id, nombre, password: password ? '****' : 'sin' });
    
    if (!id || !nombre) {
        return res.status(400).json({ error: 'Faltan id o nombre' });
    }
    
    let data = leerUsuarios();
    if (!data.usuarios || !Array.isArray(data.usuarios)) {
        data = { usuarios: [] };
    }
    
    const indexExistente = data.usuarios.findIndex(u => u.id === id);
    const existePorNombre = data.usuarios.find(u => u.nombre === nombre && u.id !== id);
    
    if (existePorNombre) {
        return res.status(400).json({ 
            error: `El nombre "${nombre}" ya está en uso`
        });
    }
    
    let usuario;
    if (indexExistente !== -1) {
        usuario = data.usuarios[indexExistente];
        usuario.nombre = nombre;
        if (password) usuario.password = password;
        usuario.peer_id = peer_id || null;
        usuario.ultimo_activo = new Date().toISOString();
        if (!usuario.amigos) usuario.amigos = [];
        if (!usuario.solicitudes) usuario.solicitudes = [];
        if (!usuario.mensajes_pendientes) usuario.mensajes_pendientes = [];
        console.log(`✏️ Usuario actualizado: ${nombre}`);
    } else {
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
        console.log(`✅ Nuevo usuario creado: ${nombre}`);
    }
    
    if (guardarUsuarios(data)) {
        res.json({ success: true, usuario });
    } else {
        res.status(500).json({ error: 'Error al guardar' });
    }
});

app.put('/usuarios/:id', (req, res) => {
    const { peer_id } = req.body;
    console.log(`✏️ PUT /usuarios/${req.params.id}: peer_id = ${peer_id}`);
    
    const data = leerUsuarios();
    const usuario = data.usuarios.find(u => u.id === req.params.id);
    if (!usuario) {
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
// AMISTADES
// ============================================

app.post('/amistad/solicitar', (req, res) => {
    const { emisorId, receptorId } = req.body;
    console.log(`🤝 Solicitud: ${emisorId} -> ${receptorId}`);
    
    const data = leerUsuarios();
    const emisor = data.usuarios.find(u => u.id === emisorId);
    const receptor = data.usuarios.find(u => u.id === receptorId);
    
    if (!emisor || !receptor) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    if (emisor.amigos && emisor.amigos.includes(receptorId)) {
        return res.status(400).json({ error: 'Ya son amigos' });
    }
    
    if (receptor.solicitudes && receptor.solicitudes.includes(emisorId)) {
        return res.status(400).json({ error: 'Solicitud ya enviada' });
    }
    
    if (!receptor.solicitudes) receptor.solicitudes = [];
    if (!receptor.solicitudes.includes(emisorId)) {
        receptor.solicitudes.push(emisorId);
    }
    
    if (guardarUsuarios(data)) {
        res.json({ success: true, message: `Solicitud enviada a ${receptor.nombre}` });
    } else {
        res.status(500).json({ error: 'Error al guardar' });
    }
});

app.post('/amistad/aceptar', (req, res) => {
    const { usuarioId, solicitanteId } = req.body;
    console.log(`✅ Aceptar: ${solicitanteId} -> ${usuarioId}`);
    
    const data = leerUsuarios();
    const usuario = data.usuarios.find(u => u.id === usuarioId);
    const solicitante = data.usuarios.find(u => u.id === solicitanteId);
    
    if (!usuario || !solicitante) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    if (usuario.solicitudes) {
        usuario.solicitudes = usuario.solicitudes.filter(id => id !== solicitanteId);
    }
    
    if (!usuario.amigos) usuario.amigos = [];
    if (!solicitante.amigos) solicitante.amigos = [];
    
    if (!usuario.amigos.includes(solicitanteId)) {
        usuario.amigos.push(solicitanteId);
    }
    if (!solicitante.amigos.includes(usuarioId)) {
        solicitante.amigos.push(usuarioId);
    }
    
    if (guardarUsuarios(data)) {
        res.json({ success: true, message: 'Ahora son amigos' });
    } else {
        res.status(500).json({ error: 'Error al guardar' });
    }
});

app.post('/amistad/rechazar', (req, res) => {
    const { usuarioId, solicitanteId } = req.body;
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
// MENSAJES OFFLINE
// ============================================

app.post('/mensaje/enviar', (req, res) => {
    const { emisorId, receptorId, mensaje } = req.body;
    console.log(`💬 Mensaje offline: ${emisorId} -> ${receptorId}`);
    
    const data = leerUsuarios();
    const emisor = data.usuarios.find(u => u.id === emisorId);
    const receptor = data.usuarios.find(u => u.id === receptorId);
    
    if (!emisor || !receptor) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    if (!emisor.amigos || !emisor.amigos.includes(receptorId)) {
        return res.status(403).json({ error: 'No son amigos' });
    }
    
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
            message: 'Mensaje guardado',
            pendientes: receptor.mensajes_pendientes.length
        });
    } else {
        res.status(500).json({ error: 'Error al guardar mensaje' });
    }
});

app.get('/mensaje/pendientes/:id', (req, res) => {
    const id = req.params.id;
    const data = leerUsuarios();
    const usuario = data.usuarios.find(u => u.id === id);
    if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ pendientes: usuario.mensajes_pendientes || [] });
});

app.post('/mensaje/leidos', (req, res) => {
    const { usuarioId } = req.body;
    const data = leerUsuarios();
    const usuario = data.usuarios.find(u => u.id === usuarioId);
    if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
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
    console.log(`📄 GET  /usuarios`);
    console.log(`📝 POST /usuarios`);
    console.log(`🤝 POST /amistad/solicitar`);
    console.log(`✅ POST /amistad/aceptar`);
    console.log(`❌ POST /amistad/rechazar`);
    console.log(`💬 POST /mensaje/enviar`);
    console.log(`📩 GET  /mensaje/pendientes/:id`);
    console.log(`📖 POST /mensaje/leidos`);
    console.log(`📊 GET  /status`);
    console.log('\n✅ Servidor listo!');
});
