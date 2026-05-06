import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import 'dotenv/config';

const apiId = parseInt(process.env.apiId);
const apiHash = process.env.apiHash;
const stringSession = new StringSession(process.env.session);
const TARGET_ID = process.env.problema; 
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;


(async () => {
  console.log("Buscando contactos...");

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    await client.connect();
    const dialogs = await client.getDialogs();

    // Nombres a buscar
    const objetivos = ["Miguel", "Camila"];
    const resultados = [];

    dialogs.forEach(dialog => {
      const nombreChat = dialog.title || "Sin nombre";
      
      // Verificamos si el nombre del chat incluye alguno de nuestros objetivos
      objetivos.forEach(nombre => {
        if (nombreChat.toLowerCase().includes(nombre.toLowerCase())) {
          resultados.push({
            buscado: nombre,
            encontrado: nombreChat,
            id: dialog.id.toString()
          });
        }
      });
    });

    console.log("\n--- RESULTADOS DE BÚSQUEDA ---");
    if (resultados.length > 0) {
      resultados.forEach(res => {
        console.log(`📌 Para "${res.buscado}": Encontrado como "${res.encontrado}" | ID: ${res.id}`);
      });
    } else {
      console.log("No se encontraron coincidencias exactas.");
    }
    console.log("------------------------------\n");

  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
})();