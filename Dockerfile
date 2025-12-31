# Use the stable base image for WhatsApp bots
FROM quay.io/samochu/gss

# Set the work directory
WORKDIR /usr/src/app

# Copy your files into the container
COPY . .

# Update npm and install all dependencies from your package.json
RUN npm install -g npm@latest
RUN npm install

# Expose port 8080 to match your index.js
EXPOSE 8080

# Start the bot
CMD ["npm", "start"]
