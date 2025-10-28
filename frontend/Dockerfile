# ================================
# Stage 1: Build (Vite + Tailwind)
# ================================
FROM node:20-alpine AS build
WORKDIR /app

# Dependencias primero para aprovechar caché
COPY package.json package-lock.json ./
RUN npm ci

# Copia el resto del código
COPY . .

# Build de producción
RUN npm run build

# ================================
# Stage 2: Servir con Nginx
# ================================
FROM nginx:alpine
# Copia artefactos estáticos
COPY --from=build /app/dist /usr/share/nginx/html

# Copia config de Nginx para SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Cloud Run escucha en $PORT; Nginx no usa env, así que fijamos 8080
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
