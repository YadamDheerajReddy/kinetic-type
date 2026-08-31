import type { DomainLexer } from './types'

/**
 * Seed CLI corpus — original example shell commands (flags, paths, regex,
 * piping per PRD US-03), not sourced from any specific system's man pages.
 * Small placeholder set; Phase 5's "Content & corpus review" expands this.
 */
const COMMANDS: string[] = [
  "grep -rn --include='*.ts' 'TODO' ./src | sort | uniq -c",
  "find . -type f -name '*.log' -mtime +7 -exec rm -f {} \\;",
  'docker run -it --rm -v $(pwd):/app -p 3000:3000 node:20-alpine sh',
  "ssh -i ~/.ssh/id_rsa -p 2222 deploy@10.0.0.5 'sudo systemctl restart nginx'",
  'curl -sS -X POST https://api.example.com/v1/users -H \'Content-Type: application/json\' -d \'{"name":"test"}\'',
  'tar -czvf backup-$(date +%Y%m%d).tar.gz /var/www/html --exclude=node_modules',
  "awk -F, '{ sum += $3 } END { print sum }' data.csv",
  'chmod -R 755 /opt/app && chown -R deploy:deploy /opt/app',
  "sed -i 's/localhost/127.0.0.1/g' config/*.yaml",
  "ps aux | grep node | awk '{print $2}' | xargs kill -9",
]

export const cliLexer: DomainLexer = {
  id: 'CLI_BASH',
  label: 'CLI',
  glyph: '$_',
  words: COMMANDS.join(' ').split(/\s+/).filter(Boolean),
}
