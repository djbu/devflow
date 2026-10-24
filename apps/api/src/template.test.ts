import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateTemplate, renderTemplate } from './zaps/template.js';

test('only the four allowed mapping variables render, including repeated placeholders', () => {
  const result = renderTemplate('{{pr.title}}: {{pr.author}} {{pr.url}} {{repository.fullName}} {{pr.title}}', {
    'pr.title': '$& title', 'pr.author': 'author', 'pr.url': 'https://example.test/pr/1', 'repository.fullName': 'owner/repo',
  });
  assert.equal(result, '$& title: author https://example.test/pr/1 owner/repo $& title');
});
test('unknown fields, malformed delimiters, and empty templates are rejected', () => {
  for (const template of ['{{user.token}}', '{{pr.title}', '{{pr.title}} }}', '', '{{process.env}}']) {
    assert.throws(() => validateTemplate(template));
  }
});
