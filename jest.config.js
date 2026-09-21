process.env.TZ = 'Europe/Paris'; // tests de dates stables quelle que soit la machine
/** Tests du moteur (TypeScript pur, sans React Native) */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { esModuleInterop: true, resolveJsonModule: true, strict: true, module: 'commonjs', target: 'es2020', isolatedModules: true, rootDir: '.' } }] },
};
