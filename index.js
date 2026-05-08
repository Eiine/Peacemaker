import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import { Peacemaker_engine } from "./Peacemaker_engine.js";
import * as dotenv from 'dotenv';
import fs from "fs-extra";
import axios from "axios"; // Importamos Axios para mayor estabilidad
import http from 'http';
import https from 'https';

dotenv.config();
http.globalAgent.keepAlive = true;
http.globalAgent.keepAliveMsecs = 30000;
http.globalAgent.maxSockets = 50;

https.globalAgent.keepAlive = true;
https.globalAgent.keepAliveMsecs = 30000;
https.globalAgent.maxSockets = 50;
const apiId = parseInt(process.env.apiId);
const apiHash = process.env.apiHash;
const stringSession = new StringSession(process.env.session);
const TARGET_ID = process.env.problema; 
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const engine = new Peacemaker_engine();

await fs.ensureDir("./temp_audios");


async function enviarAlertaBot(texto, reintento = 1) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const baseDelay = 5000; // 5 segundos base
    
    const textoLimpio = texto
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>');

    const payload = {
        chat_id: TARGET_ID,
        text: textoLimpio,
        parse_mode: 'HTML'
    };

    try {
        const response = await axios.post(url, payload, { 
            timeout: 30000, // Aumentamos a 30s por si la red está lenta
            family: 4
        });
        
        if (response.status === 200) {
            console.log("🚀 Alerta enviada correctamente.");
            return true;
        }
    } catch (error) {
        // Detectamos si es un problema de conectividad
        const esErrorRed = error.code === 'ENOTFOUND' || 
                           error.code === 'ECONNRESET' || 
                           error.code === 'ETIMEDOUT' ||
                           error.code === 'EHOSTUNREACH' ||
                           error.message.includes('getaddrinfo');
        
        if (esErrorRed) {
            // BACKOFF EXPONENCIAL: Aumenta la espera pero con un tope de 10 minutos
            const delay = Math.min(baseDelay * Math.pow(2, reintento - 1), 600000); 
            
            console.warn(`📡 Red inestable. Intento ${reintento}. Reintentando en ${Math.round(delay/1000)}s...`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // RECURSIÓN INFINITA: No hay maxReintentos, seguirá hasta que conecte
            return enviarAlertaBot(texto, reintento + 1);
        }
        
        // Manejo de error de formato (HTML mal formado)
        if (error.response && error.response.status === 400) {
            console.warn("⚠️ Error de parseo HTML, reintentando en texto plano...");
            try {
                await axios.post(url, {
                    chat_id: TARGET_ID,
                    text: texto
                }, { family: 4 });
                console.log("✅ Enviado como texto plano.");
                return true;
            } catch (retryError) {
                console.error("❌ Error crítico en texto plano:", retryError.message);
                return false; 
            }
        }

        // Si es otro tipo de error (ej: Bot bloqueado), esperamos un poco y reintentamos igual
        console.error(`❌ Error inesperado: ${error.message}. Reintentando en 1 minuto...`);
        await new Promise(resolve => setTimeout(resolve, 60000));
        return enviarAlertaBot(texto, reintento + 1);
    }
}

(async () => {
    const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 10,           // Más reintentos
    autoReconnect: true,
    retryDelay: 5000,                // Esperar 5 segundos entre reintentos
    timeout: 0,                      // 🔥 CLAVE: 0 = Sin timeout de inactividad
    floodSleepThreshold: 120,        // Evita bloqueos por flood
    deviceModel: 'Peacemaker',
    systemVersion: '1.0',
    appVersion: '1.0.0'
});
    try {
        await client.connect();
        console.log("✅ Servicio Peacemaker Permanente Activo.");
        console.log(`📡 Monitoreando ID: ${TARGET_ID}`);
        console.log(`🤖 Bot de alertas vinculado.`);

        let mensajesCapturados = [];
        let capturaIniciada = false;

        const handler = async (event) => {
    const message = event.message;
    
    const senderId = message.peerId?.userId?.toString() || 
                     message.peerId?.chatId?.toString() || 
                     message.fromId?.userId?.toString();

    if (senderId === TARGET_ID) {
        const hora = new Date().toLocaleTimeString();
        
        // ✅ NUEVA OBTENCIÓN DEL NOMBRE
        let nombreReal = "Usuario Desconocido";
        try {
            const emisorId = message.fromId?.userId || message.peerId?.userId || message.chatId;
            if (emisorId) {
                const entity = await client.getEntity(emisorId);
                nombreReal = entity.firstName || entity.title || entity.username || "Usuario Desconocido";
            }
        } catch (err) {
            console.warn("No se pudo obtener el nombre del emisor:", err.message);
        }

        let itemCapturado = { 
            hora, 
            emisor: nombreReal
        };

        // DETECCIÓN DE MEDIOS (todo igual)
        if (message.photo) {
            console.log(`📸 [${hora}] Imagen de ${nombreReal} detectada. Descargando...`);
            const buffer = await client.downloadMedia(message.media);
            const rutaImagen = `./temp_audios/img_${Date.now()}.jpg`;
            await fs.writeFile(rutaImagen, buffer);
            
            itemCapturado.tipo = "imagen";
            itemCapturado.ruta = rutaImagen;
            itemCapturado.valor = message.message || message.caption || "[Imagen sin texto]";
            console.log(`✅ Imagen guardada con caption: "${itemCapturado.valor.substring(0, 50)}..."`);
        } 
        else if (message.voice || (message.media?.document?.mimeType?.includes("audio"))) {
            console.log(`🎙️ [${hora}] Audio de ${nombreReal} detectado. Descargando...`);
            const buffer = await client.downloadMedia(message.media);
            const rutaAudio = `./temp_audios/audio_${Date.now()}.ogg`;
            await fs.writeFile(rutaAudio, buffer);
            
            itemCapturado.tipo = "audio";
            itemCapturado.ruta = rutaAudio;
            itemCapturado.valor = message.message || message.caption || "[Audio sin texto]";
            console.log(`✅ Audio guardado con caption: "${itemCapturado.valor.substring(0, 50)}..."`);
        } 
        else {
            itemCapturado.tipo = "texto";
            itemCapturado.valor = message.message || "[Mensaje sin texto]";
            console.log(`📩 [${hora}] Texto de ${nombreReal} añadido a la cola.`);
        }

        mensajesCapturados.push(itemCapturado);

        if (!capturaIniciada) {
            capturaIniciada = true;
            console.log("⏳ Abriendo ventana de 1 min para procesamiento...");

            setTimeout(async () => {
                console.log("--- ⏱️ Fin de ventana. Procesando con Gemini ---");
                
                if (mensajesCapturados.length > 0) {
                    try {
                        const reporte = await engine.processMessages(mensajesCapturados);
                        if (reporte) {
                            await enviarAlertaBot(reporte);
                        }
                        
                        for (const msg of mensajesCapturados) {
                            if (msg.ruta) {
                                await fs.remove(msg.ruta);
                            }
                        }
                    } catch (err) {
                        console.error("❌ Error al procesar reporte:", err.message);
                    } finally {
                        mensajesCapturados = [];
                        capturaIniciada = false;
                        console.log("♻️ Ciclo completado. Volviendo a modo espera...");
                    }
                } else {
                    capturaIniciada = false;
                }
            }, 60000);
        }
    }
};

        client.addEventHandler(handler, new NewMessage({}));
                // Mantener la conexión viva con pings periódicos
        setInterval(async () => {
            try {
                await client.invoke({ _: 'ping', pingId: Date.now() });
                console.log("💓 KeepAlive enviado");
            } catch (err) {
                console.warn("⚠️ KeepAlive falló:", err.message);
            }
        }, 30000); // Cada 30 segundos

    } catch (error) {
        console.error("❌ Error crítico en el servicio:", error.message);
    }
})();