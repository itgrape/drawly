CONTAINER_ENGINE ?= docker
IMAGE            ?= drawly:latest
CONTAINER        ?= drawly
DATA_VOLUME      ?= drawly-data
PORT             ?= 8888
APP_ENV          ?= development
ORIGINS          ?= http://localhost:$(PORT)
VITE_SERVER_URL  ?=

.DEFAULT_GOAL := help

.PHONY: help check-engine check-image build pull run start stop restart logs \
	status shell clean prune typecheck

help: ## 显示可用命令
	@awk 'BEGIN {FS = ":.*## "; printf "用法: make <命令> [变量=值]\n\n"} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@printf '\n常用变量: IMAGE=%s PORT=%s APP_ENV=%s ORIGINS=%s\n' '$(IMAGE)' '$(PORT)' '$(APP_ENV)' '$(ORIGINS)'

check-engine:
	@command -v $(CONTAINER_ENGINE) >/dev/null 2>&1 || { echo "未找到容器引擎: $(CONTAINER_ENGINE)"; exit 1; }

check-image: check-engine
	@$(CONTAINER_ENGINE) image inspect $(IMAGE) >/dev/null 2>&1 || { \
		echo "缺少运行镜像，请先执行: make build"; \
		exit 1; \
	}

build: check-engine ## 构建 Drawly 单体镜像
	$(CONTAINER_ENGINE) build --target app \
		--build-arg VITE_SERVER_URL=$(VITE_SERVER_URL) \
		-t $(IMAGE) -f Containerfile .

pull: check-engine ## 从镜像仓库拉取 Drawly 镜像
	$(CONTAINER_ENGINE) pull $(IMAGE)

run: start ## 使用已有镜像启动服务

start: check-image stop ## 使用已有镜像启动服务
	$(CONTAINER_ENGINE) volume inspect $(DATA_VOLUME) >/dev/null 2>&1 || $(CONTAINER_ENGINE) volume create $(DATA_VOLUME)
	$(CONTAINER_ENGINE) run -d \
		--name $(CONTAINER) \
		--restart unless-stopped \
		-p $(PORT):8888 \
		-e NODE_ENV=$(APP_ENV) \
		-e DRAWLY_ORIGINS=$(ORIGINS) \
		-v $(DATA_VOLUME):/data \
		$(IMAGE)
	@printf '\nDrawly 已启动: http://localhost:%s\n健康检查: http://localhost:%s/health\n' '$(PORT)' '$(PORT)'

stop: check-engine ## 停止并删除运行容器（保留数据）
	@$(CONTAINER_ENGINE) rm -f $(CONTAINER) >/dev/null 2>&1 || true

restart: check-engine ## 重启正在运行的服务
	$(CONTAINER_ENGINE) restart $(CONTAINER)

logs: check-engine ## 持续查看服务日志
	$(CONTAINER_ENGINE) logs -f $(CONTAINER)

status: check-engine ## 查看容器运行状态
	$(CONTAINER_ENGINE) ps -a --filter name=$(CONTAINER)

shell: check-engine ## 进入容器终端
	$(CONTAINER_ENGINE) exec -it $(CONTAINER) sh

typecheck: ## 在本机执行 TypeScript 检查
	npm run typecheck

clean: stop ## 删除镜像（保留持久化数据卷）
	@$(CONTAINER_ENGINE) image rm $(IMAGE) >/dev/null 2>&1 || true

prune: clean ## 删除镜像及持久化数据卷（会清空应用数据）
	@$(CONTAINER_ENGINE) volume rm $(DATA_VOLUME) >/dev/null 2>&1 || true
