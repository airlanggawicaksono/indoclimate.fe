.PHONY: dev prod-build prod-run prod systemd-install systemd-start systemd-stop systemd-restart health

PORT ?= 5324
HOST ?= 127.0.0.1
NODE_ENV ?= production

export PORT
export HOST
export NODE_ENV

# Simple Development target
dev: ## Run development server (port 3000)
	npm run dev

# Production target: install dependencies, build, and prepare for systemd
prod-build: ## Build production version
	npm install
	npm run build

prod-run: ## Run production build bound to localhost and port 5324
	npm run start -- --hostname $(HOST) --port $(PORT)

prod: prod-build prod-run ## Build then start the production server

# Systemd service management
systemd-install: ## Install the systemd service file
	sudo cp indoclimate.service /etc/systemd/system/
	sudo systemctl daemon-reload
	sudo systemctl enable indoclimate.service

systemd-start: ## Start the application via systemd (runs on port 5324)
	sudo systemctl start indoclimate

systemd-stop: ## Stop the application via systemd
	sudo systemctl stop indoclimate

systemd-restart: ## Restart the application via systemd
	sudo systemctl restart indoclimate

# Health check
health: ## Check if the application is running on the configured host/port
	@echo "Checking if app is running on $(HOST):$(PORT)..."
	@nc -z $(HOST) $(PORT) && echo "App is running on $(HOST):$(PORT)" || echo "App is NOT running on $(HOST):$(PORT)"
