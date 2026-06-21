const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const config = getDefaultConfig(projectRoot);

// mobileからpackages/coreを読むための設定です。
// Expo単体アプリとしても動かしつつ、共通ロジックだけはリポジトリ直下のpackagesへ置きます。
config.watchFolders = [path.resolve(workspaceRoot, 'packages/core')];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules')
];

module.exports = config;
