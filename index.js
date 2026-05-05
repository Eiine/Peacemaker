import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import { Peacemaker_engine } from "./Peacemaker_engine.js";
import * as dotenv from 'dotenv';
import fs from "fs-extra";
import axios from "axios"; // Importamos Axios para mayor estabilidad

dotenv.config();

const apiId = 2040;
const apiHash = "b18441a1ff607e106cf947a4ba59624d";
const stringSession = new StringSession(process.env.session);
const TARGET_ID = process.env.yo; 
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const engine = new Peacemaker_engine();

await fs.ensureDir("./temp_audios");

/**
 * Función para disparar la alerta sonora vía Bot API usando AXIOS
 */
async function enviarAlertaBot(texto, reintento = 1) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const maxReintentos = 10; // Intentará hasta 10 veces
    const baseDelay = 5000; // 5 segundos iniciales
    
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
            timeout: 20000,
            family: 4
        });
        
        if (response.status === 200) {
            console.log("🚀 Alerta enviada correctamente.");
            return true;
        }
    } catch (error) {
        const esErrorRed = error.code === 'ENOTFOUND' || 
                          error.code === 'ECONNRESET' || 
                          error.code === 'ETIMEDOUT' ||
                          error.message.includes('getaddrinfo');
        
        if (esErrorRed && reintento <= maxReintentos) {
            // Calcular espera: 5s, 10s, 20s, 40s, 80s, 160s... (máx 5 minutos)
            const delay = Math.min(baseDelay * Math.pow(1.5, reintento - 1), 300000);
            console.warn(`⚠️ Error de red (intento ${reintento}/${maxReintentos}). Reintentando en ${Math.round(delay/1000)} segundos...`);
            console.warn(`   Motivo: ${error.message}`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return enviarAlertaBot(texto, reintento + 1);
        }
        
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
                console.error("❌ Falló el reintento plano:", retryError.message);
                return false;
            }
        } else {
            console.error("❌ Error al contactar al Bot:", error.message);
            return false;
        }
    }
}

(async () => {
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
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

    } catch (error) {
        console.error("❌ Error crítico en el servicio:", error.message);
    }
})();