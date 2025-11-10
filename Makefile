.PHONY: help install dev build start stop restart clean nginx-setup nginx-start nginx-stop nginx-restart logs docker-up docker-down

# Colors for output
GREEN=\033[0;32m
YELLOW=\033[1;33m
NC=\033[0m # No Color

help: ## Show this help message
	@echo "$(GREEN)Indoclimate Frontend - Available Commands:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'

install: ## Install dependencies
	@echo "$(GREEN)Installing dependencies...$(NC)"
	npm install

dev: ## Run development server (port 3000)
	@echo "$(GREEN)Starting development server...$(NC)"
	npm run dev

build: ## Build production app
	@echo "$(GREEN)Building production app...$(NC)"
	npm run build

start: ## Start production server (port 3000)
	@echo "$(GREEN)Starting production server...$(NC)"
	npm run start

lint: ## Run linter
	@echo "$(GREEN)Running linter...$(NC)"
	npm run lint

clean: ## Clean node_modules and .next
	@echo "$(GREEN)Cleaning build artifacts...$(NC)"
	rm -rf node_modules .next

setup-env: ## Copy .env.example to .env.local
	@if [ ! -f .env.local ]; then \
		cp .env.example .env.local; \
		echo "$(GREEN).env.local created! Please update with your actual values.$(NC)"; \
	else \
		echo "$(YELLOW).env.local already exists.$(NC)"; \
	fi

# ChromaDB Docker commands
docker-up: ## Start ChromaDB Docker container
	@echo "$(GREEN)Starting ChromaDB Docker container...$(NC)"
	cd ../indoclimate && docker-compose up -d
	@echo "$(GREEN)ChromaDB running on http://localhost:2913$(NC)"

docker-down: ## Stop ChromaDB Docker container
	@echo "$(GREEN)Stopping ChromaDB Docker container...$(NC)"
	cd ../indoclimate && docker-compose down

docker-logs: ## Show ChromaDB logs
	@echo "$(GREEN)Showing ChromaDB logs...$(NC)"
	cd ../indoclimate && docker-compose logs -f

chroma-start: docker-up ## Alias for docker-up

chroma-stop: docker-down ## Alias for docker-down

# Nginx commands
nginx-setup: ## Setup nginx configuration (requires sudo)
	@echo "$(GREEN)Setting up nginx configuration...$(NC)"
	sudo cp nginx.conf /etc/nginx/sites-available/indoclimate
	sudo ln -sf /etc/nginx/sites-available/indoclimate /etc/nginx/sites-enabled/
	sudo nginx -t
	@echo "$(GREEN)Nginx configuration installed. Run 'make nginx-restart' to apply.$(NC)"

nginx-start: ## Start nginx
	@echo "$(GREEN)Starting nginx...$(NC)"
	sudo systemctl start nginx
	@echo "$(GREEN)Nginx started. App available on http://localhost:5324$(NC)"

nginx-stop: ## Stop nginx
	@echo "$(GREEN)Stopping nginx...$(NC)"
	sudo systemctl stop nginx

nginx-restart: ## Restart nginx
	@echo "$(GREEN)Restarting nginx...$(NC)"
	sudo systemctl restart nginx
	@echo "$(GREEN)Nginx restarted. App available on http://localhost:5324$(NC)"

nginx-status: ## Check nginx status
	@echo "$(GREEN)Checking nginx status...$(NC)"
	sudo systemctl status nginx

nginx-logs: ## Show nginx logs
	@echo "$(GREEN)Showing nginx logs...$(NC)"
	sudo tail -f /var/log/nginx/indoclimate-access.log

nginx-errors: ## Show nginx error logs
	@echo "$(GREEN)Showing nginx error logs...$(NC)"
	sudo tail -f /var/log/nginx/indoclimate-error.log

# Full deployment
deploy: build docker-up start nginx-restart ## Full deployment (build + start all services)
	@echo "$(GREEN)Deployment complete!$(NC)"
	@echo "$(GREEN)- ChromaDB: http://localhost:2913$(NC)"
	@echo "$(GREEN)- Next.js: http://localhost:3000$(NC)"
	@echo "$(GREEN)- Public URL: http://localhost:5324$(NC)"

stop-all: nginx-stop docker-down ## Stop all services
	@echo "$(GREEN)All services stopped.$(NC)"

restart-all: docker-up nginx-restart ## Restart all services
	@echo "$(GREEN)All services restarted.$(NC)"

# Development workflow
dev-full: docker-up dev ## Start ChromaDB + dev server
	@echo "$(GREEN)Development environment ready!$(NC)"

# Logs
logs: ## Show Next.js logs
	@echo "$(GREEN)Showing Next.js logs...$(NC)"
	npm run start 2>&1 | tee logs/app.log

# Health check
health: ## Check all services health
	@echo "$(GREEN)Checking service health...$(NC)"
	@echo "\n$(YELLOW)Next.js (port 3000):$(NC)"
	@curl -s http://localhost:3000 > /dev/null && echo "OK" || echo "DOWN"
	@echo "\n$(YELLOW)ChromaDB (port 2913):$(NC)"
	@curl -s http://localhost:2913/api/v1/heartbeat > /dev/null && echo "OK" || echo "DOWN"
	@echo "\n$(YELLOW)Nginx (port 5324):$(NC)"
	@curl -s http://localhost:5324 > /dev/null && echo "OK" || echo "DOWN"
