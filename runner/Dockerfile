# Multi-arch ready image with Chromium and dependencies preinstalled
# Match Playwright version in package.json (1.48.2)
FROM mcr.microsoft.com/playwright:v1.56.1-jammy

# Set container timezone to Asia/Shanghai
ENV TZ=Asia/Shanghai
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata \
    && ln -snf /usr/share/zoneinfo/${TZ} /etc/localtime \
    && echo ${TZ} > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/runner

# Install runtime dependencies only
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# App source
COPY . .

# Entrypoint for robust startup + diagnostics
COPY entry.sh /entry.sh
RUN chmod +x /entry.sh

# Normalize potential CRLF line endings (Windows checkouts)
# Ensures /usr/bin/env can find "bash" instead of "bash\r"
RUN sed -i 's/\r$//' /entry.sh || true \
    && find /app/runner -type f -name "*.sh" -exec sed -i 's/\r$//' {} + || true

# Ensure required dirs exist inside image (can be mounted in compose)
RUN mkdir -p .profile public workflows

# Default network/options
ENV HOST=0.0.0.0
ENV PORT=3100
ENV HEADLESS=false
EXPOSE 3100

# Healthcheck: ensure web server responds
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD node -e "(p=>require('http').get('http://localhost:'+p+'/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1)))(process.env.PORT||3100)"

# Start via entrypoint (selects headless/xvfb based on HEADLESS)
CMD ["/entry.sh"]
