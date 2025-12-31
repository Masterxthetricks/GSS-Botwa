# Use the existing base image you provided
FROM quay.io/samochu/gss

# Koyeb automatically clones your repo into /app or /workspace. 
# We set the WORKDIR to where the code is.
WORKDIR /usr/src/app

# Copy your package.json and the rest of your files
COPY . .

# Install dependencies (using the latest npm as your original file suggested)
RUN npm install -g npm@latest
RUN npm install

# Expose the port (Note: your original said 8000, make sure Koyeb matches this!)
EXPOSE 8000

# Start the bot
CMD ["npm", "start"]
