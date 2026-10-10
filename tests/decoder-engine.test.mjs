import assert from 'node:assert/strict';
import { parseText } from '../decoder-engine.mjs';

const cases = [
  ['fixed-date record', 'user@example.com Pwd123 friend9 work7 parent2 1995年4月17日 notes 2016/6/16', '生日：1995年4月17日'],
  ['hyphen-delimited', 'name----Pass!----user@example.com----MailPass----JP', '邮箱：user@example.com'],
  ['long comma row', 'handle,Pass!,user@example.com,MailPass,extra-token,extra-tail,5551234', '附加字段 1：extra-token'],
  ['grouped whitespace', 'muntas.543 ARK0@TOP WZSW FSW5 JKUD LLVY person@example.com', '附加字段：WZSW FSW5 JKUD LLVY'],
  ['labeled lines', '账号：user@example.com\n密码：Sample123\n邮箱：user@example.com', '账号：user@example.com'],
  ['preserve unknown', 'alpha beta gamma delta', '附加字段：gamma delta'],
];
for (const [name, input, expected] of cases) {
  const parsed = parseText(input);
  assert.equal(parsed.ok, true, name);
  assert.ok(parsed.text.includes(expected), name);
}
assert.equal(parseText('   ').ok, false);
console.log('decoder-engine regression tests passed:', cases.length + 1);
