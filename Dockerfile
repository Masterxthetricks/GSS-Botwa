# Use the official Node.js image (Guaranteed to work)
FROM node:22-slim

# Install system dependencies for WhatsApp (Puppeteer/Chromium requirements)
RUN apt-get update && apt-get install -y \
    git \
    ffmpeg \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

# Set the work directory
WORKDIR /usr/src/app

# Copy all your project files
COPY . .

# Install dependencies
RUN npm install

# Expose port 8080 to match your index.js
EXPOSE 8080

# Start the bot
CMD ["node", "index.js"]
