const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
module.exports = defineConfig([expoConfig, { rules: { /* React Compiler is not enabled; Expo Video exposes mutable native player handles. */ 'react-hooks/refs':'off','react-hooks/immutability':'off','react-hooks/set-state-in-effect':'off' } }, { ignores: ['dist/**','dist-android/**','supabase/**','cloudflare/**'] }]);
