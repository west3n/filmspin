#!/usr/bin/env bash
set -euo pipefail

# Bootstrap script for Ubuntu/Debian VPS:
# - installs Docker Engine + Compose plugin
# - enables Docker service
# - opens firewall ports 22/80/443 with UFW (if available)

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This script supports Linux only."
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This script supports apt-based distributions only (Ubuntu/Debian)."
  exit 1
fi

run_root() {
  if [[ "${EUID}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

echo "[bootstrap] installing base packages"
run_root apt-get update -y
run_root apt-get install -y ca-certificates curl gnupg lsb-release ufw

echo "[bootstrap] configuring Docker APT repository"
run_root install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | run_root tee /etc/apt/keyrings/docker.asc >/dev/null
fi
run_root chmod a+r /etc/apt/keyrings/docker.asc

if [[ -f /etc/os-release ]]; then
  # shellcheck disable=SC1091
  source /etc/os-release
  DIST_CODENAME="${VERSION_CODENAME:-$(lsb_release -cs)}"
else
  DIST_CODENAME="$(lsb_release -cs)"
fi

DOCKER_LIST="/etc/apt/sources.list.d/docker.list"
DOCKER_REPO_LINE="deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${DIST_CODENAME} stable"
echo "${DOCKER_REPO_LINE}" | run_root tee "${DOCKER_LIST}" >/dev/null

echo "[bootstrap] installing Docker Engine + Compose plugin"
run_root apt-get update -y
run_root apt-get install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

echo "[bootstrap] enabling Docker service"
run_root systemctl enable docker
run_root systemctl start docker

TARGET_USER="${BOOTSTRAP_DOCKER_USER:-${SUDO_USER:-${USER}}}"
if id -u "${TARGET_USER}" >/dev/null 2>&1; then
  if ! id -nG "${TARGET_USER}" | tr ' ' '\n' | grep -qx docker; then
    echo "[bootstrap] adding user '${TARGET_USER}' to docker group"
    run_root usermod -aG docker "${TARGET_USER}"
    echo "[bootstrap] user '${TARGET_USER}' added to docker group (re-login required)"
  fi
fi

if command -v ufw >/dev/null 2>&1; then
  echo "[bootstrap] configuring UFW (22, 80, 443)"
  run_root ufw allow OpenSSH
  run_root ufw allow 80/tcp
  run_root ufw allow 443/tcp
  if [[ "${UFW_ENABLE:-true}" == "true" ]]; then
    run_root ufw --force enable
  fi
  run_root ufw status verbose
fi

echo "[bootstrap] docker version: $(docker --version 2>/dev/null || echo 'docker requires new shell for group changes')"
echo "[bootstrap] done"
