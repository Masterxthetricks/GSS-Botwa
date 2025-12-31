# Use the official Node.js image
FROM node:22-slim

# Create and change to the app directory
WORKDIR /usr/src/app

# Copy package.json only
COPY package.json ./

# Install all dependencies (This ignores the need for a lockfile)
RUN npm install

# Copy the rest of your bot's code
COPY . .

# Set the port (Koyeb uses 8080 by default)
EXPOSE 8080

# Start the bot
CMD ["node", "index.js"]
