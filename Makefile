.PHONY: dev prod nginx-setup nginx-restart nginx-test

# Simple Development target
dev: ## Run development server (port 3000)
	npm run dev

# Production target: install dependencies, build, start server, and restart nginx
prod: ## Build and deploy production version
	npm install
	npm run build
	npm run start &

# Nginx management
nginx-setup: ## Setup nginx configuration (requires sudo)
	sudo cp nginx.conf /etc/nginx/sites-available/indoclimate
	sudo ln -sf /etc/nginx/sites-available/indoclimate /etc/nginx/sites-enabled/
	sudo nginx -t

nginx-restart: ## Restart nginx
	sudo systemctl restart nginx

nginx-test: ## Test nginx configuration
	sudo nginx -t