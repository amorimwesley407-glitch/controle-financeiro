#!/usr/bin/env bash
# Atualiza o app local com o que entrou na main do GitHub e reinicia o serviço.
# Só segue se os testes e o build passarem; se algo falhar, volta para a versão anterior.
# Uso: deploy/update-app.sh   (disparado pelo clareza-update.timer; logs em journalctl --user -u clareza-update)
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

branch="$(git rev-parse --abbrev-ref HEAD)"
[ "$branch" = main ] || { echo "Pasta na branch $branch, não na main: nada feito."; exit 0; }
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "Há mudanças locais não commitadas: nada feito."; exit 0; }

git fetch --quiet origin main
old="$(git rev-parse HEAD)"
new="$(git rev-parse origin/main)"
[ "$old" != "$new" ] || { echo "Já está na versão mais recente (${old:0:7})."; exit 0; }

install_if_lock_changed() {
  if ! git diff --quiet "$1" "$2" -- package-lock.json; then npm ci --no-audit --no-fund; fi
}

rollback() {
  echo "Falhou na versão ${new:0:7}; voltando para ${old:0:7}." >&2
  git reset --quiet --hard "$old"
  install_if_lock_changed "$new" "$old"
  npm run build
  systemctl --user restart clareza
  exit 1
}

echo "Atualizando ${old:0:7} → ${new:0:7}"
git merge --quiet --ff-only origin/main
install_if_lock_changed "$old" "$new" || rollback
npx tsc --noEmit || rollback
npm test || rollback
# As migrações só adicionam, então a versão anterior continua funcionando se o rollback for necessário.
npm run db:migrate || rollback
npm run build || rollback
systemctl --user restart clareza
echo "App atualizado para ${new:0:7}: $(git log -1 --format=%s)"
