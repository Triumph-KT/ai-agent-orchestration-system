# Use the official Node.js 18 Alpine image as a base.
# Alpine Linux is very lightweight, which results in a smaller container image.
FROM node:18-alpine

# Set the working directory inside the container.
# All subsequent commands will be run from this path.
WORKDIR /usr/src/app

# Copy package.json and package-lock.json.
# This is done as a separate step to leverage Docker's layer caching.
# Dependencies are only re-installed if these files change.
COPY package*.json ./

# Install production dependencies using 'npm ci'.
# 'ci' is generally faster and safer for production builds than 'npm install'
# because it uses the package-lock.json file exclusively.
RUN npm ci --only=production

# Copy the rest of the application source code into the container.
COPY . .

# Expose port 8080 to allow communication with the container from the outside.
EXPOSE 8080

# Define the command that will be run when the container starts.
CMD [ "node", "server.js" ]