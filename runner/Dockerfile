# Multi-arch ready image with Chromium and dependencies preinstalled
# Match Playwright version in package.json (1.48.2)
FROM mcr.microsoft.com/playwright:v1.48.2-jammy

WORKDIR /app/runner

# Install runtime dependencies only
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# App source
COPY . .

# Ensure required dirs exist inside image (can be mounted in compose)
RUN mkdir -p .profile public workflows

# Default port
ENV PORT=3100
EXPOSE 3100

# Use non-root user provided by Playwright base image
USER pwuser

# Run under Xvfb so Chromium can start in headful mode inside container
CMD ["bash", "-lc", "xvfb-run -a node src/server.js"]

