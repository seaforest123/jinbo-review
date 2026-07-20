const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('registers the five P0 pages and cloud roots', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
  const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.example.json'), 'utf8'));
  assert.deepEqual(app.pages, [
    'pages/home/index',
    'pages/experience/index',
    'pages/result/index',
    'pages/archive/index',
    'pages/activity/index',
  ]);
  assert.equal(project.miniprogramRoot, 'miniprogram/');
  assert.equal(project.cloudfunctionRoot, 'cloudfunctions/');
});
