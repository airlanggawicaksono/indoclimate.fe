.PHONY: dev prod-setup run-prod nginx-setup

PORT ?= 5324
HOST ?= 127.0.0.1
NODE_ENV ?= production
DOMAIN ?= chat.indoclimate.id
LOG_DIR ?= logs
RUN_LOG ?= $(LOG_DIR)/run-prod.log
PID_FILE ?= $(LOG_DIR)/run-prod.pid

export PORT
export HOST
export NODE_ENV
export DOMAIN
export LOG_DIR
export RUN_LOG
export PID_FILE

dev: ## Run development server (port 3000)
	npm run dev

prod-setup: ## Install dependencies and build for production
	npm install
	npm run build

run-prod: ## Run production build in background on localhost:5324
	@mkdir -p $(LOG_DIR)
	@nohup npm run start -- --hostname $(HOST) --port $(PORT) > $(RUN_LOG) 2>&1 & echo $$! > $(PID_FILE)
	@echo "Next.js started in background (PID: $$(cat $(PID_FILE))); logs: $(RUN_LOG)"

stop: ## Stop running Next.js instance
	@if [ -f $(PID_FILE) ]; then \
		kill $$(cat $(PID_FILE)) && rm $(PID_FILE) && echo "Next.js stopped (PID file removed)"; \
	else \
		pkill -f "next" && echo "Next.js stopped (killed by process name)" || echo "No Next.js process found"; \
	fi

nginx-setup: ## Copy nginx.conf, enable site, reload nginx, and ensure certbot config exists
	sudo cp nginx.conf /etc/nginx/sites-available/indoclimate
	sudo ln -sf /etc/nginx/sites-available/indoclimate /etc/nginx/sites-enabled/indoclimate
	sudo nginx -t
	sudo systemctl reload nginx
	sudo certbot --nginx -d $(DOMAIN)
