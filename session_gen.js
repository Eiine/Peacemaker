import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input"; // Asegurate de tener instalada esta librería: npm install input
import 'dotenv/config';
// Tus credenciales (Usamos las del .env que ya tenés)
const apiId = parseInt(process.env.apiId);
const apiHash = process.env.apiHash;

(async () => {
    console.log("🚀 Iniciando generador de sesión...");
    const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () => await input.text("Ingresá tu número (ej: +549387...): "),
        password: async () => await input.text("Ingresá tu contraseña (si tenés 2FA): "),
        phoneCode: async () => await input.text("Ingresá el código que te llegó a Telegram: "),
        onError: (err) => console.log(err),
    });

    console.log("\n✅ ¡Logueado correctamente!");
    const sessionString = client.session.save();
    
    console.log("\n--- COPIÁ TU SESSION STRING AQUÍ ABAJO ---");
    console.log(sessionString);
    console.log("-------------------------------------------\n");
    
    await client.disconnect();
    process.exit(0);
})();