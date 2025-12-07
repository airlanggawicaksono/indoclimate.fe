.PHONY: dev setup run-prod stop status logs nginx-setup

PROJECT_DIR ?= /var/www/html/indoclimate.fe
APP_NAME ?= indoclimate-chat
DOMAIN ?= chat.indoclimate.id
NODE_VERSION ?= 20.18.1

setup:
	cd $(PROJECT_DIR) && mise use node@$(NODE_VERSION)
	cd $(PROJECT_DIR) && mise install
	@echo "Node $(NODE_VERSION) installed and configured"

dev:
	cd $(PROJECT_DIR) && mise exec -- npm run dev

run-prod:
	cd $(PROJECT_DIR) && mise exec -- npm run build
	cd $(PROJECT_DIR) && npx pm2 reload $(APP_NAME) || npx pm2 start --interpreter bash -c "cd $(PROJECT_DIR) && mise exec -- npm start" --name $(APP_NAME)
	@echo "Deployed at $$(date)"

stop:
	npx pm2 stop $(APP_NAME)
	npx pm2 delete $(APP_NAME)

status:
	npx pm2 status

logs:
	npx pm2 logs $(APP_NAME)

nginx-setup:
	sudo cp $(PROJECT_DIR)/nginx.conf /etc/nginx/sites-available/indoclimate
	sudo ln -sf /etc/nginx/sites-available/indoclimate /etc/nginx/sites-enabled/indoclimate
	sudo nginx -t
	sudo systemctl reload nginx
	sudo certbot --nginx -d $(DOMAIN)
