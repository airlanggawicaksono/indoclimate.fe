.ONESHELL:
PROJECT_DIR := /var/www/html/indoclimate.fe
SHELL := /bin/bash

include $(PROJECT_DIR)/.env
export

.PHONY: help dev-up dev-down dev-logs dev-logs-db prod-up prod-down prod-logs prod-logs-db db-up db-down db-logs clean nginx-setup nginx-reload

help:
	@echo "=== Development ==="
	@echo "  make dev-up      - Start dev (app + chromadb)"
	@echo "  make dev-down    - Stop dev"
	@echo "  make dev-logs    - Show app logs"
	@echo "  make dev-logs-db - Show chromadb logs"
	@echo ""
	@echo "=== Production ==="
	@echo "  make prod-up     - Start production (app + chromadb)"
	@echo "  make prod-down   - Stop production"
	@echo "  make prod-logs   - Show app logs"
	@echo "  make prod-logs-db - Show chromadb logs"
	@echo ""
	@echo "=== Database ==="
	@echo "  make db-up       - Start chromadb only"
	@echo "  make db-down     - Stop chromadb"
	@echo "  make db-logs     - Show chromadb logs"
	@echo ""
	@echo "=== Other ==="
	@echo "  make clean       - Remove containers, images, volumes"
	@echo "  make nginx-setup - Install nginx config"
	@echo "  make nginx-reload - Reload nginx"

# --- Development ---

dev-up: db-up
	cd $(PROJECT_DIR)
	docker compose -f docker-compose.dev.yaml up -d --build
	@echo "Dev started on port $(PORT)"

dev-down:
	cd $(PROJECT_DIR)
	docker compose -f docker-compose.dev.yaml down
	docker compose -f docker-compose.chromadb.yaml down
	@echo "Dev stopped"

dev-logs:
	cd $(PROJECT_DIR)
	docker compose -f docker-compose.dev.yaml logs -f app

dev-logs-db:
	cd $(PROJECT_DIR)
	docker compose -f docker-compose.chromadb.yaml logs -f chromadb

# --- Production ---

prod-up: db-up
	cd $(PROJECT_DIR)
	docker compose -f docker-compose.yaml up -d --build
	@echo "Production started on port $(PORT)"

prod-down:
	cd $(PROJECT_DIR)
	docker compose -f docker-compose.yaml down
	docker compose -f docker-compose.chromadb.yaml down
	@echo "Production stopped"

prod-logs:
	cd $(PROJECT_DIR)
	docker compose -f docker-compose.yaml logs -f app

prod-logs-db:
	cd $(PROJECT_DIR)
	docker compose -f docker-compose.chromadb.yaml logs -f chromadb

# --- Database (ChromaDB) ---

db-up:
	cd $(PROJECT_DIR)
	docker compose -f docker-compose.chromadb.yaml up -d

db-down:
	cd $(PROJECT_DIR)
	docker compose -f docker-compose.chromadb.yaml down

db-logs:
	cd $(PROJECT_DIR)
	docker compose -f docker-compose.chromadb.yaml logs -f

# --- Clean ---

clean:
	cd $(PROJECT_DIR)
	docker compose -f docker-compose.yaml down -v --rmi all 2>/dev/null || true
	docker compose -f docker-compose.dev.yaml down -v --rmi all 2>/dev/null || true
	docker compose -f docker-compose.chromadb.yaml down -v --rmi all 2>/dev/null || true
	@echo "Cleaned up"

# --- Nginx ---

nginx-setup:
	sudo cp $(PROJECT_DIR)/nginx.conf /etc/nginx/sites-available/indoclimate
	sudo ln -sf /etc/nginx/sites-available/indoclimate /etc/nginx/sites-enabled/indoclimate
	sudo nginx -t && sudo systemctl reload nginx
	@echo "Nginx setup complete"

nginx-reload:
	sudo nginx -t && sudo systemctl reload nginx
	@echo "Nginx reloaded"
