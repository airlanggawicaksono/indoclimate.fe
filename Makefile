.PHONY: help install dev build start lint clean setup-env chroma-start chroma-stop

help:
	@echo "Indoclimate - Available Commands"
	@echo "=================================="
	@echo "make install      - Install dependencies"
	@echo "make dev          - Run development server"
	@echo "make build        - Build for production"
	@echo "make start        - Start production server"
	@echo "make lint         - Run linter"
	@echo "make clean        - Clean build files"
	@echo "make setup-env    - Copy .env.example to .env.local"
	@echo "make chroma-start - Start ChromaDB (Docker)"
	@echo "make chroma-stop  - Stop ChromaDB (Docker)"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

start:
	npm run start

lint:
	npm run lint

clean:
	rm -rf .next
	rm -rf out
	rm -rf node_modules/.cache

setup-env:
	@if [ ! -f .env.local ]; then \
		cp .env.example .env.local; \
		echo ".env.local created! Please update with your actual values."; \
	else \
		echo ".env.local already exists."; \
	fi

chroma-start:
	@echo "Starting ChromaDB on port 2913..."
	docker run -d --name indoclimate-chroma -p 2913:8000 chromadb/chroma

chroma-stop:
	@echo "Stopping ChromaDB..."
	docker stop indoclimate-chroma
	docker rm indoclimate-chroma
