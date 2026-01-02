# Use the official Node.js image (Modern and Fast)
FROM node:22-slim

# Install system dependencies for WhatsApp media (FFmpeg, ImageMagick, and WebP)
RUN apt-get update && apt-get install -y \
    git \
    ffmpeg \
    imagemagick \
    webp \
    && rm -rf /var/lib/apt/lists/*

# Set the work directory inside the container
WORKDIR /usr/src/app

# Copy package files first to optimize layer caching
COPY package.json .
RUN npm install

# Copy the rest of your project files
COPY . .

# Expose port 8080 to match your index.js and Koyeb settings
EXPOSE 8080

# Start the bot
CMD ["node", "index.js"]
