SHELL := /bin/bash

ENV_FILE ?= .env.prod
COMPOSE_FILE ?= docker-compose.prod.yml
DC := docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE)
SERVICE ?= app

.PHONY: help bootstrap-prod deploy-prod up-prod pull-prod restart-prod down-prod ps-prod logs-prod config-prod

help:
	@echo "Targets:"
	@echo "  make bootstrap-prod - install docker/firewall prereqs on VPS"
	@echo "  make deploy-prod    - pull + up -d + ps"
	@echo "  make up-prod        - start/update stack"
	@echo "  make pull-prod      - pull images"
	@echo "  make restart-prod   - restart stack"
	@echo "  make down-prod      - stop stack"
	@echo "  make ps-prod        - show containers status"
	@echo "  make logs-prod      - follow logs (SERVICE=app|caddy|redis)"
	@echo "  make config-prod    - render effective compose config"
	@echo ""
	@echo "Overrides:"
	@echo "  ENV_FILE=.env.prod COMPOSE_FILE=docker-compose.prod.yml SERVICE=app"

bootstrap-prod:
	@./scripts/bootstrap_prod.sh

deploy-prod:
	@./scripts/deploy.sh

up-prod:
	@$(DC) up -d --remove-orphans

pull-prod:
	@$(DC) pull

restart-prod:
	@$(DC) up -d --force-recreate

down-prod:
	@$(DC) down

ps-prod:
	@$(DC) ps

logs-prod:
	@$(DC) logs -f --tail=200 $(SERVICE)

config-prod:
	@$(DC) config
