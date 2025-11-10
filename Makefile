.PHONY: dev prod nginx-setup nginx-restart nginx-test health stop

# Simple Development target
dev: ## Run development server (port 3000)
	npm run dev

# Production target: install dependencies, build, start server on port 2001, and restart nginx
prod: ## Build and deploy production version
	npm install
	npm run build
	PORT=2001 npm run start &

# Health check
health: ## Check if the application is running on port 2001
	@echo "Checking if app is running on port 2001..."
	@nc -z localhost 2001 && echo "App is running on port 2001" || echo "App is NOT running on port 2001"

# Stop the application
stop: ## Stop the application running on port 2001
	@echo "Stopping application on port 2001..."
	@pkill -f "PORT=2001" || echo "No process found running on port 2001"

# Nginx management
nginx-setup: ## Setup nginx configuration (requires sudo)
	sudo cp nginx.conf /etc/nginx/sites-available/indoclimate
	sudo ln -sf /etc/nginx/sites-available/indoclimate /etc/nginx/sites-enabled/
	sudo nginx -t

nginx-restart: ## Restart nginx
	sudo systemctl restart nginx

nginx-test: ## Test nginx configuration
	sudo nginx -t