#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ENV_FILE="${ROOT_DIR}/.env"
FRONT_DIR="${ROOT_DIR}/frontend"
FRONT_ENV_FILE="${FRONT_DIR}/.env.local"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Create it first." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "${ENV_FILE}"
set +a

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env var: ${name}" >&2
    exit 1
  fi
}

require_var PIXEL_PORT
require_var VECTOR_PORT
require_var BACKEND_PORT
require_var POCKETBASE_PORT
require_var CLICKHOUSE_HTTP_PORT
require_var CLICKHOUSE_NATIVE_PORT
require_var FRONT_HOST_PORT
require_var FRONT_CONTAINER_PORT
require_var FRONT_DEV_PORT
require_var API_BASE_URL

cat > "${FRONT_ENV_FILE}" <<EOF
VITE_API_URL=${API_BASE_URL}
VITE_DEV_PORT=${FRONT_DEV_PORT}
VITE_PREVIEW_PORT=${FRONT_CONTAINER_PORT}
EOF

echo "Wrote ${FRONT_ENV_FILE}"
