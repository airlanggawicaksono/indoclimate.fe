.PHONY: dev install prod-build run-prod stop restart logs status pm2-setup nginx-setup

# Project directory - cd here before running commands
PROJECT_DIR ?= /var/www/html/indoclimate.fe

PORT ?= 5324
HOST ?= 127.0.0.1
NODE_ENV ?= production
DOMAIN ?= chat.indoclimate.id
LOG_DIR ?= ./logs
APP_NAME ?= indoclimate-chat

export PORT
export HOST
export NODE_ENV
export DOMAIN
export LOG_DIR
export APP_NAME
export PROJECT_DIR

help: ## Show this help message
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

dev: ## Run development server (port 3000)
	cd $(PROJECT_DIR) && npm run dev

install: ## Install dependencies only
	cd $(PROJECT_DIR) && npm install

prod-build: ## Build for production
	cd $(PROJECT_DIR) && npm run build

pm2-setup: ## Install PM2 globally and setup auto-startup
	@echo "Installing PM2 globally..."
	@sudo npm install -g pm2
	@echo "Setting up PM2 auto-startup..."
	@pm2 startup
	@echo "PM2 setup complete! Run 'pm2 save' after starting your app to persist the configuration."

run-prod: ## Start production build with PM2 (single instance)
	@mkdir -p $(PROJECT_DIR)/$(LOG_DIR)
	@echo "Starting $(APP_NAME) with PM2..."
	@cd $(PROJECT_DIR) && pm2 start ecosystem.config.js --env production
	@pm2 save
	@echo "✓ $(APP_NAME) started with PM2"
	@echo "  → View logs: make logs"
	@echo "  → View status: make status"
	@echo "  → Stop app: make stop"

stop: ## Stop PM2 process
	@echo "Stopping $(APP_NAME)..."
	@pm2 stop $(APP_NAME) || echo "App not running"
	@pm2 delete $(APP_NAME) || echo "App not found in PM2"
	@echo "✓ $(APP_NAME) stopped"

restart: ## Restart PM2 process (zero-downtime)
	@echo "Restarting $(APP_NAME) with zero-downtime..."
	@pm2 reload $(APP_NAME)
	@echo "✓ $(APP_NAME) restarted"

logs: ## View PM2 logs (real-time)
	@pm2 logs $(APP_NAME)

status: ## Show PM2 process status
	@pm2 status $(APP_NAME)

monit: ## Open PM2 monitoring dashboard
	@pm2 monit

nginx-setup: ## Copy nginx.conf, enable site, reload nginx, and ensure certbot config exists
	sudo cp $(PROJECT_DIR)/nginx.conf /etc/nginx/sites-available/indoclimate
	sudo ln -sf /etc/nginx/sites-available/indoclimate /etc/nginx/sites-enabled/indoclimate
	sudo nginx -t
	sudo systemctl reload nginx
	sudo certbot --nginx -d $(DOMAIN)
