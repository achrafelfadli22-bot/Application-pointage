import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

type Rule = {
  root: string;
  forbidden: RegExp[];
  message: string;
};

const ignoredDirectories = new Set([
  '.next',
  '.turbo',
  'dist',
  'node_modules',
  'coverage',
  'test-results',
]);

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function hasSourceExtension(file: string) {
  return [...sourceExtensions].some((extension) => file.endsWith(extension));
}

function walk(root: string): string[] {
  if (!existsSync(root)) return [];

  const entries = readdirSync(root);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(root, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (!ignoredDirectories.has(entry)) {
        files.push(...walk(fullPath));
      }
      continue;
    }

    if (stats.isFile() && hasSourceExtension(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

const rules: Rule[] = [
  {
    root: 'frontend',
    forbidden: [
      /from\s+['"].*backend/i,
      /from\s+['"].*@pointage360\/api/i,
      /require\(['"].*backend/i,
      /require\(['"].*@pointage360\/api/i,
      /from\s+['"]@prisma\/client['"]/i,
      /require\(['"]@prisma\/client['"]\)/i,
    ],
    message: 'Frontend must call the backend through HTTP only. Do not import backend or Prisma code in frontend.',
  },
  {
    root: 'backend',
    forbidden: [
      /from\s+['"].*frontend/i,
      /from\s+['"].*@pointage360\/web/i,
      /require\(['"].*frontend/i,
      /require\(['"].*@pointage360\/web/i,
    ],
    message: 'Backend must not import frontend code.',
  },
];

const violations: string[] = [];

for (const rule of rules) {
  for (const file of walk(rule.root)) {
    const content = readFileSync(file, 'utf8');
    const failed = rule.forbidden.some((pattern) => pattern.test(content.replaceAll('\\', '/')));

    if (failed) {
      violations.push(`${relative(process.cwd(), file)}: ${rule.message}`);
    }
  }
}

if (violations.length) {
  console.error('Backend/frontend boundary violations found:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Backend/frontend boundaries OK.');
