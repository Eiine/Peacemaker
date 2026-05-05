import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from 'dotenv';
dotenv.config();

// Inicializamos el SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function list() {
  try {
    // El método correcto es directo de genAI
    const result = await genAI.listModels();
    
    console.log("✅ Modelos disponibles para tu API Key:");
    result.models.forEach(m => {
      console.log(`- Nombre: ${m.name}`);
      console.log(`  Métodos: ${m.supportedGenerationMethods.join(", ")}`);
      console.log('---');
    });
  } catch (e) {
    console.error("❌ Error real de la API:", e.message);
  }
}

list();