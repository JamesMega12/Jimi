with open('vite.config.ts', 'r') as f:
    content = f.read()

import re
content = re.sub(r'proxy:\s*\{\s*\'/api\':\s*\{\s*target:\s*\'http://localhost:3000\',\s*changeOrigin:\s*true\s*\}\s*\}', '', content)
# remove the trailing comma before proxy
content = content.replace('watch: process.env.DISABLE_HMR === \'true\' ? null : {},\n      \n', 'watch: process.env.DISABLE_HMR === \'true\' ? null : {}\n')

with open('vite.config.ts', 'w') as f:
    f.write(content)
