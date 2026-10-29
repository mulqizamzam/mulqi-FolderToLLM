import fs from 'node:fs/promises'

const files = ['lib/index.js', 'lib/context-packager.js']
for (const file of files) await fs.access(file)
console.log('Build artifacts present:', files.join(', '))
