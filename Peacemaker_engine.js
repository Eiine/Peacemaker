import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from "fs-extra";

export class Peacemaker_engine {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
    
    // ✅ MODELOS BIEN DEFINIDOS
 this.modelV3 = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // El más nuevo y eficiente
this.modelV15 = this.genAI.getGenerativeModel({ model: "gemini-2.5-Flash-lite" }); // El "caballo de batalla"

    this.systemPrompt = `
Eres un analista de inteligencia táctica. Tu función es extraer datos operativos y documentar eventos conflictivos para registro legal.

REGLAS CRÍTICAS:
1. Identifica siempre quién emite cada instrucción o demanda.
2. Mantén un tono seco y pericial.
3. Comienza directamente con "--- 🛡️ REPORTE PACIFICADO ---".
4. Cuando se reciba una imagen (captura de pantalla de chat), EXTRAE SOLO INFORMACIÓN OPERATIVA. NO incluyas:
   - Horarios específicos (ej: "11:27 a.m.", "8:33 p.m.")
   - Nombres de participantes no relevantes
   - Saludos, despedidas o emociones
   - Notas de voz, reacciones (❤️) o mensajes sin contenido operativo
   - Frases como "le cuestan los cambios", "se van a ir conociendo"
5. SOLO extrae: tareas pendientes, obligaciones, lugares, fechas límite (sin hora exacta), responsabilidades claras.
6. Si la imagen contiene una conversación, resumila en 1-2 líneas de ACCIONES REQUERIDAS.

Formato requerido:
--- 🛡️ REPORTE PACIFICADO ---
📋 **Resumen de Situación**
[1 línea describiendo el problema operativo]

👤 **Actores Involucrados**
* Emisor: [Nombre del emisor capturado]

✅ **Datos Operativos Extraídos**
* [Tarea 1: qué hay que hacer]
* [Tarea 2: responsabilidad de quién]
* [Solo si es crítica: fecha límite sin hora]

EJEMPLO de lo que DEBE devolver con la imagen que enviaste:
--- 🛡️ REPORTE PACIFICADO ---
📋 **Resumen de Situación**
Ausencia de Isabel y necesidad de asegurar asistencia de Fausto

👤 **Actores Involucrados**
* Emisor: [Nombre del emisor capturado]

✅ **Datos Operativos Extraídos**
* Gestionar recuperación de horas perdidas de Isabel
* Comunicar a la seño que Fausto debe asistir regularmente
* Coordinar adaptación de Fausto con nueva acompañante
`;
  }

 async processMessages(mensajes) {
    if (mensajes.length === 0) return;

    try {
        const promptParts = [this.systemPrompt];

        for (const m of mensajes) {
            if (m.tipo === "audio") {
                console.log(`🎙️ Procesando audio de ${m.emisor}...`);
                const uploadResult = await this.fileManager.uploadFile(m.ruta, {
                    mimeType: "audio/ogg",
                    displayName: `Audio_${m.emisor}_${m.hora.replace(/:/g, '-')}`,
                });
                
                promptParts.push({
                    fileData: {
                        mimeType: uploadResult.file.mimeType,
                        fileUri: uploadResult.file.uri,
                    },
                });
                
                promptParts.push(`\n[${m.hora}] ${m.emisor} envió un audio. Texto asociado: "${m.valor || 'sin texto'}"`);
                
                await fs.remove(m.ruta);
            } 
            else if (m.tipo === "imagen") {
                console.log(`🖼️ Procesando imagen de ${m.emisor}...`);
                const uploadResult = await this.fileManager.uploadFile(m.ruta, {
                    mimeType: "image/jpeg",
                    displayName: `Imagen_${m.emisor}_${m.hora.replace(/:/g, '-')}`,
                });
                
                promptParts.push({
                    fileData: {
                        mimeType: uploadResult.file.mimeType,
                        fileUri: uploadResult.file.uri,
                    },
                });
                
                promptParts.push(`\n[${m.hora}] ${m.emisor} envió una imagen. Texto asociado: "${m.valor || 'sin texto'}"`);
                
                await fs.remove(m.ruta);
            } 
            else {
                promptParts.push(`\n[${m.hora}] ${m.emisor} dice: ${m.valor}`);
            }
        }

        let response;
        try {
            console.log("🚀 Intentando con Gemini 2.5 Flash...");
            const result = await this.modelV3.generateContent(promptParts);
            response = result.response.text();
        } catch (e) {
            console.warn("⚠️ Gemini 2.5 no disponible. Activando protocolo de emergencia con 1.5 Flash...");
            const result = await this.modelV15.generateContent(promptParts);
            response = result.response.text();
        }

        console.log("\n" + response + "\n");
        return response;

    } catch (error) {
        console.error("❌ Error crítico en Peacemaker_engine:", error.message);
        return "⚠️ Error técnico en el procesamiento. Verifique logs.";
    }
}
}