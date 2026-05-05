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
const TARGET_ID = process.env.problema; 
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const engine = new Peacemaker_engine();

await fs.ensureDir("./temp_audios");

/**
 * Función para disparar la alerta sonora vía Bot API usando AXIOS
 */
async function enviarAlertaBot(texto) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    
    // Formateo para HTML para evitar errores de parseo de símbolos
    const textoLimpio = texto
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>');

    const payload = {
        chat_id: TARGET_ID,
        text: textoLimpio,
        parse_mode: 'HTML'
    };

    try {
        const response = await axios.post(url, payload, { timeout: 20000 });
        if (response.status === 200) {
            console.log("🚀 Alerta sonora disparada vía Bot (Axios) correctamente.");
        }
    } catch (error) {
        if (error.response && error.response.status === 400) {
            console.warn("⚠️ Error de parseo HTML, reintentando en texto plano...");
            try {
                await axios.post(url, {
                    chat_id: TARGET_ID,
                    text: texto
                });
                console.log("✅ Enviado como texto plano.");
            } catch (retryError) {
                console.error("❌ Falló el reintento plano:", retryError.message);
            }
        } else {
            console.error("❌ Error de Axios al contactar al Bot:", error.message);
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
        
        // Obtenemos el ID del emisor
        const senderId = message.peerId?.userId?.toString() || 
                         message.peerId?.chatId?.toString() || 
                         message.fromId?.userId?.toString();

        if (senderId === TARGET_ID) {
            const hora = new Date().toLocaleTimeString();
            
            // --- NUEVA LÓGICA DE IDENTIDAD ---
            // Obtenemos la entidad para sacar el nombre real
            const entity = await client.getEntity(message.peerId || message.fromId);
            const nombreReal = entity.firstName || entity.title || "Usuario Desconocido";
            // ----------------------------------

            let itemCapturado = { 
                hora, 
                emisor: nombreReal // <--- Ahora el mensaje sabe quién lo envió
            };

            if (message.media && (message.voice || message.media.document)) {
                console.log(`🎙️ [${hora}] Audio de ${nombreReal} detectado. Descargando...`);
                const buffer = await client.downloadMedia(message.media);
                const rutaAudio = `./temp_audios/audio_${Date.now()}.ogg`;
                await fs.writeFile(rutaAudio, buffer);
                
                itemCapturado.tipo = "audio";
                itemCapturado.ruta = rutaAudio;
            } else {
                itemCapturado.tipo = "texto";
                itemCapturado.valor = message.message || "[Mensaje sin texto]";
                console.log(`📩 [${hora}] Texto de ${nombreReal} añadido a la cola.`);
            }

            // ... (resto de tu lógica de ventana de 1 minuto)
            if (!capturaIniciada) {
                // ...
            }
            mensajesCapturados.push(itemCapturado);
        }
    };

        client.addEventHandler(handler, new NewMessage({}));

    } catch (error) {
        console.error("❌ Error crítico en el servicio:", error.message);
    }
})();