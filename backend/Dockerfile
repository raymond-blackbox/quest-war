FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .


# Default to port 8080 for Cloud Run
ENV PORT=8080

EXPOSE ${PORT}

CMD ["node", "src/index.js"]
