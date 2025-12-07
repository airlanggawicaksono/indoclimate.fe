.PHONY: dev run-prod status logs nginx-setup

PROJECT_DIR ?= /var/www/html/indoclimate.fe
APP_NAME ?= indoclimate-chat
DOMAIN ?= chat.indoclimate.id

dev:
	cd $(PROJECT_DIR) && npm run dev

run-prod:
	@mkdir -p /tmp/logs
	cd $(PROJECT_DIR) && npm run build
	cd $(PROJECT_DIR) && npx pm2 reload $(APP_NAME) || npx pm2 start ecosystem.config.js
	@echo "Deployed at $$(date)"

status:
	cd $(PROJECT_DIR) && npx pm2 status

logs:
	cd $(PROJECT_DIR) && npx pm2 logs $(APP_NAME)

nginx-setup:
	sudo cp $(PROJECT_DIR)/nginx.conf /etc/nginx/sites-available/indoclimate
	sudo ln -sf /etc/nginx/sites-available/indoclimate /etc/nginx/sites-enabled/indoclimate
	sudo nginx -t
	sudo systemctl reload nginx
	sudo certbot --nginx -d $(DOMAIN)
