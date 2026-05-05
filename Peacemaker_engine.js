import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from "fs-extra";

export class Peacemaker_engine {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
    
this.modelV3 = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // El más nuevo y eficiente
this.modelV15 = this.genAI.getGenerativeModel({ model: "gemini-2.5-Flash-Lite" }); // El "caballo de batalla" estable actual

    this.systemPrompt = `
Eres un analista de inteligencia táctica. Tu función es extraer datos operativos y documentar eventos conflictivos para registro legal.

REGLAS CRÍTICAS:
1. Identifica siempre quién emite cada instrucción o demanda.
2. Mantén un tono seco y pericial.
3. Comienza directamente con "--- 🛡️ REPORTE PACIFICADO ---".

Formato requerido:
--- 🛡️ REPORTE PACIFICADO ---
📋 **Resumen de Situación**
[Descripción breve]

👤 **Actores Involucrados**
* Emisor: [Nombre del emisor capturado]

✅ **Datos Operativos Extraídos**
* [Dato 1]
* [Dato 2]
`;
  }

  async processMessages(mensajes) {
    if (mensajes.length === 0) return;

    try {
      const promptParts = [this.systemPrompt];

      for (const m of mensajes) {
        if (m.tipo === "audio") {
          const uploadResult = await this.fileManager.uploadFile(m.ruta, {
            mimeType: "audio/ogg",
            displayName: `Audio_Friccion_${m.hora}`,
          });
          
          promptParts.push({
            fileData: {
              mimeType: uploadResult.file.mimeType,
              fileUri: uploadResult.file.uri,
            },
          });

          await fs.remove(m.ruta);
        } else {
         promptParts.push(`\n[${m.hora}] ${m.emisor} dice: ${m.valor}`);
        }
      }

      // --- LÓGICA DE MULTI-MODELO (HÍBRIDA) ---
      let response;
      try {
        console.log("🚀 Intentando con Gemini 3 Flash Preview...");
        const result = await this.modelV3.generateContent(promptParts);
        response = result.response.text();
      } catch (e) {
        // Si Gemini 3 falla por saturación (503) o cuota (429), usamos el 1.5
        console.warn("⚠️ Gemini 3 no disponible. Activando protocolo de emergencia con 1.5 Flash...");
        const result = await this.modelV15.generateContent(promptParts);
        response = result.response.text();
      }

      console.log("\n" + response + "\n");
      return response;

    } catch (error) {
      console.error("❌ Error crítico en Peacemaker_engine:", error.message);
      return "⚠️ Error técnico en el procesamiento. Verifique logs del Phenom.";
    }
  }
}