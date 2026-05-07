async function procesarHistorialCompleto(chatId) {
    let ultimoId = 0;
    let contextoParaSiguiente = "Inicio del análisis.";
    let numeroDeBloque = 1;

    while (true) {
        // 1. Descarga de 100 mensajes (con manejo de FloodWait)
        const mensajes = await client.getMessages(chatId, {
            limit: 100,
            offsetId: ultimoId
        });

        if (mensajes.length === 0) break; // Terminamos el historial

        // 2. Formatear los mensajes para la IA (incluyendo timestamps y autores)
        const bloqueTexto = mensajes.map(m => 
            `[${m.date}] ${m.senderId}: ${m.text}`
        ).reverse().join('\n');

        // 3. Envío a Gemini
        const resultado = await analizarConGemini(bloqueTexto, contextoParaSiguiente);
        
        // El resultado de Gemini debe ser un JSON con:
        // { reporteLegal: "...", contextoResumido: "..." }
        
        // 4. Persistencia (Guardar en el reporte acumulativo)
        await guardarEnReporteDocumento(resultado.reporteLegal, numeroDeBloque);

        // 5. Preparar siguiente iteración
        contextoParaSiguiente = resultado.contextoResumido;
        ultimoId = mensajes[mensajes.length - 1].id;
        numeroDeBloque++;

        // Delay de cortesía para no ser baneado por Telegram
        await new Promise(res => setTimeout(res, 3000));
    }
}