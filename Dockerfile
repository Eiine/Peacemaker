# Usamos una imagen liviana de Node.js
FROM node:21-slim

# Instalamos dependencias del sistema necesarias para descargar medios
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Creamos el directorio de la app
WORKDIR /app

# Copiamos solo los archivos de dependencias para aprovechar el caché de Docker
COPY package*.json ./

# Instalamos dependencias (solo producción para ahorrar espacio)
RUN npm install --omit=dev

# ✅ AGREGAR: Copiar el resto del código
COPY . .

# ✅ CORREGIR: Tu código usa temp_audios, no temp_media
RUN mkdir -p temp_audios

# Ejecutamos el script
CMD ["node", "index.js"]