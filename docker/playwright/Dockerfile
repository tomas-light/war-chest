FROM mcr.microsoft.com/playwright:v1.62.1-noble

COPY docker/playwright/entrypoint.sh /usr/local/bin/war-chest-playwright
RUN chmod +x /usr/local/bin/war-chest-playwright

WORKDIR /workspace
ENTRYPOINT ["war-chest-playwright"]
