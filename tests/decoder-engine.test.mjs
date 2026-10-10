import assert from 'node:assert/strict';
import { parseText } from '../decoder-engine.mjs';

const apple = parseText('user@example.com Pwd123 friend9 work7 parent2 1995年4月17日 notes 2016/6/16');
assert.equal(apple.format, '六字段紧凑格式');
assert.ok(apple.text.includes('生日：1995年4月17日'));
assert.ok(apple.text.includes('附加字段：notes 2016/6/16'));

const appleSlash = parseText('user@example.com Pwd123 friend9 work7 parent2 1986/9/2 notes 2015/11/5');
assert.equal(appleSlash.format, '六字段紧凑格式');
assert.ok(appleSlash.text.includes('生日：1986/9/2'));

const emailCombo = parseText('name----Pass!----user@example.com----MailPass----JP');
assert.equal(emailCombo.format, '横线分隔格式');
assert.ok(emailCombo.text.includes('邮箱：user@example.com'));
assert.ok(emailCombo.text.includes('邮箱密码：MailPass'));
assert.ok(emailCombo.warnings.some(x => x.includes('地区代码')));

const unclassified = parseText('handle----Pass!----EXTRAFIELD----user@example.com----MailPass----JP');
assert.equal(unclassified.format, '横线分隔格式');
assert.ok(unclassified.text.includes('附加字段：EXTRAFIELD'));
assert.ok(unclassified.text.includes('邮箱：user@example.com'));

const recognizedDash = parseText('handle----Pass!----3DIRHHJL5IPPRCM2PW22R4FUDMCTV5W2----person@example.com----MailPass----JP');
assert.ok(recognizedDash.text.includes('2FA代码：3DIRHHJL5IPPRCM2PW22R4FUDMCTV5W2'));

const csv = parseText('handle,Pass!,user@example.com,MailPass,T6YRFKJNETFEODQU,76a808b867d78559e831abb628ecda9dc13a703,+306934713992');
assert.equal(csv.format, '逗号分隔格式');
assert.ok(csv.text.includes('邮箱：user@example.com'));
assert.ok(csv.text.includes('2FA代码：T6YRFKJNETFEODQU'));
assert.ok(csv.text.includes('Token：76a808b867d78559e831abb628ecda9dc13a703'));
assert.ok(csv.text.includes('电话：+306934713992'));

const sparseCsv = parseText('u1,p2,,mail@sample.test,extra5,tail6');
assert.equal(sparseCsv.format, '逗号分隔格式');
assert.ok(sparseCsv.text.includes('邮箱：mail@sample.test'));
assert.ok(sparseCsv.text.includes('邮箱密码：extra5'));
assert.ok(sparseCsv.text.includes('尾部字段：tail6'));

const grouped = parseText('muntas.543 ARK0@TOP WZSW FSW5 JKUD LLVY person@example.com');
assert.equal(grouped.format, '空白分隔格式');
assert.ok(grouped.text.includes('2FA代码：WZSW FSW5 JKUD LLVY'));
assert.ok(grouped.text.includes('邮箱：person@example.com'));

const labeled = parseText('账号：user@example.com\n密码：Sample123\n邮箱：user@example.com\n备注：test');
assert.equal(labeled.format, '带字段标签');
assert.ok(labeled.text.includes('账号：user@example.com'));
assert.ok(labeled.text.includes('附加字段：备注：test'));

const instagram = parseText('demoUser demoPass AB12 CD34 EF56 GH78\nmail@example.test');
assert.equal(instagram.format, '两行账号格式');
assert.ok(instagram.text.includes('邮箱：mail@example.test'));
assert.ok(instagram.text.includes('2FA代码：AB12 CD34 EF56 GH78'));

const generic = parseText('alpha beta gamma delta');
assert.equal(generic.ok, true);
assert.ok(generic.text.includes('附加字段：gamma delta'));

const simpleEmail = parseText('name@outlook.com samplePass');
assert.equal(simpleEmail.format, '双字段空白分隔格式');
assert.ok(simpleEmail.text.includes('邮箱登录地址：live.com'));

assert.equal(parseText('   ').ok, false);
console.log('decoder-engine regression tests passed (13 cases)');
