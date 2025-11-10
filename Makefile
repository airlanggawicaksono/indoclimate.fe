.PHONY: dev prod-setup run-prod nginx-setup

PORT ?= 5324
HOST ?= 127.0.0.1
NODE_ENV ?= production
DOMAIN ?= chat.indoclimate.id

export PORT
export HOST
export NODE_ENV
export DOMAIN

dev: ## Run development server (port 3000)
	npm run dev

prod-setup: ## Install dependencies and build for production
	npm install
	npm run build

run-prod: ## Run production build bound to localhost and port 5324
	npm run start -- --hostname $(HOST) --port $(PORT)

nginx-setup: ## Copy nginx.conf, reload nginx, and ensure certbot config exists
	sudo cp nginx.conf /etc/nginx/conf.d/indoclimate.conf
	sudo nginx -t
	sudo systemctl reload nginx
	sudo certbot --nginx -d $(DOMAIN)
