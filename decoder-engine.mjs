const DATE_RE = /^(?:\d{4}[\/-]\d{1,2}[\/-]\d{1,2}|\d{4}年\d{1,2}月\d{1,2}日)$/u;
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/u;
const LABELS = [
  { key: 'account', label: '账号', aliases: '账号|帐号|帳号|帳號|用户名|账户|Apple[ \\t]*ID|Instagram[ \\t]*账号|INS账号' },
  { key: 'password', label: '密码', aliases: '密码|密碼|口令' },
  { key: 'email', label: '邮箱', aliases: '邮箱|郵箱|电子邮箱|電子郵箱|邮件地址' },
  { key: 'emailPassword', label: '邮箱密码', aliases: '邮箱密码|郵箱密碼|邮箱口令|邮箱登录密码' },
  { key: 'twoFactor', label: '2FA代码', aliases: '2FA(?:[ \\t]*(?:代码|密钥|验证码))?|二步验证(?:[ \\t]*(?:密钥|代码|验证码))?|验证器密钥|验证代码' },
  { key: 'token', label: 'Token', aliases: 'Token|访问令牌|令牌' },
  { key: 'friend', label: '朋友', aliases: '朋友|好友' },
  { key: 'work', label: '工作', aliases: '工作' },
  { key: 'parent', label: '父母', aliases: '父母|家长' },
  { key: 'birthday', label: '生日', aliases: '生日|出生日期|出生年月日' },
  { key: 'phone', label: '电话', aliases: '电话|手机号|手机号码' },
  { key: 'login', label: '邮箱登录地址', aliases: '邮箱登录地址|登录地址|邮箱登录' },
];

function cleanValue(value) {
  return value.replace(/^[ \t:：=]+|[ \t]+$/gu, '').trim();
}
function result(format, fields, warnings = []) {
  const lines = fields.filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([label, value]) => `${label}：${value}`);
  return { ok: lines.length > 0, format, fields, text: lines.join('\n'), warnings };
}
function emailIndex(parts, start = 0) {
  for (let i = start; i < parts.length; i++) if (EMAIL_RE.test(parts[i])) return i;
  return -1;
}
function looksLikeTwoFactor(value) {
  const compact = String(value).replace(/\s+/gu, '');
  return /^[A-Z2-7]{12,64}$/iu.test(compact);
}
function looksLikeToken(value) {
  return /^[a-f0-9]{32,}$/iu.test(String(value));
}
function parseLabeled(raw) {
  const found = new Map();
  const unmapped = [];
  const lines = raw.split(/\r?\n/u);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let matched = false;
    for (const item of LABELS) {
      const re = new RegExp(`^(?:${item.aliases})(?:[ \\t]*[:：=][ \\t]*|[ \\t]+)(.+?)\\s*$`, 'iu');
      const m = trimmed.match(re);
      if (m) {
        if (!found.has(item.key)) found.set(item.key, cleanValue(m[1]));
        else unmapped.push(trimmed);
        matched = true;
        break;
      }
    }
    if (!matched) unmapped.push(trimmed);
  }
  const meaningful = [...found.values()].filter(Boolean).length;
  // Avoid treating one coincidental label in prose as a structured record.
  if (meaningful < 2 || !found.has('account') && !found.has('password') && !found.has('email')) return null;
  const order = ['account','password','email','emailPassword','twoFactor','token','friend','work','parent','birthday','phone','login'];
  const fields = order.filter(k => found.has(k)).map(k => [LABELS.find(x => x.key === k).label, found.get(k)]);
  return result('带字段标签', fields, unmapped.length ? ['部分非字段文本未纳入结果。'] : []);
}

function parseAppleCompact(raw) {
  // Recognize a fixed six-field prefix only. Long explanatory notes after the birthday are ignored.
  const parts = raw.trim().split(/\s+/u);
  if (parts.length < 6 || !DATE_RE.test(parts[5])) return null;
  if (!parts[0].includes('@')) return null;
  return result('六字段紧凑格式', [
    ['账号', parts[0]], ['密码', parts[1]], ['朋友', parts[2]],
    ['工作', parts[3]], ['父母', parts[4]], ['生日', parts[5]],
  ], parts.length > 6 ? ['已识别六字段前缀，额外说明文本未纳入结果。'] : []);
}

function splitDash(raw) {
  // Three or more consecutive hyphens are treated as a field separator.
  const parts = raw.trim().split(/-{3,}/u).map(cleanValue).filter(Boolean);
  if (parts.length < 3) return null;
  const fields = [['账号', parts[0]], ['密码', parts[1]]];
  const hasCountrySuffix = /^[A-Z]{2}$/iu.test(parts.at(-1));
  const logicalEnd = hasCountrySuffix ? parts.length - 1 : parts.length;
  if (EMAIL_RE.test(parts[2])) {
    fields.push(['邮箱', parts[2]]);
    if (parts[3] && logicalEnd > 3) fields.push(['邮箱密码', parts[3]]);
  } else if (parts[3] && EMAIL_RE.test(parts[3])) {
    fields.push([looksLikeTwoFactor(parts[2]) ? '2FA代码' : '附加字段', parts[2]], ['邮箱', parts[3]]);
    if (parts[4] && logicalEnd > 4) fields.push(['邮箱密码', parts[4]]);
  } else {
    fields.push(['附加字段', parts.slice(2, logicalEnd).join(' | ')]);
    return result('横线分隔格式', fields, ['字段位置无法完全确认，请核对附加字段。']);
  }
  const warnings = [];
  if (hasCountrySuffix) warnings.push('末尾疑似地区代码，暂未纳入结果。');
  if (logicalEnd > 5) warnings.push('存在额外尾部字段，未自动解释。');
  return result('横线分隔格式', fields, warnings);
}

function parseComma(raw) {
  if (!raw.includes(',')) return null;
  const parts = raw.split(',').map(cleanValue).filter(Boolean);
  if (parts.length < 3) return null;
  const fields = [['账号', parts[0]], ['密码', parts[1]]];
  const mailIdx = emailIndex(parts, 2);
  if (mailIdx >= 0) {
    if (mailIdx > 2) fields.push(['前置附加字段', parts.slice(2, mailIdx).join(', ')]);
    fields.push(['邮箱', parts[mailIdx]]);
    if (parts[mailIdx + 1]) fields.push(['邮箱密码', parts[mailIdx + 1]]);
    // For longer CSV rows, retain all remaining columns explicitly rather than dropping them.
    if (parts.length >= 6 && mailIdx === 2) {
      const extra1 = parts[mailIdx + 2] || '';
      const extra2 = parts[mailIdx + 3] || '';
      const tail = parts.slice(mailIdx + 4);
      if (extra1) fields.push([looksLikeTwoFactor(extra1) ? '2FA代码' : '附加字段 1', extra1]);
      if (extra2) fields.push([looksLikeToken(extra2) ? 'Token' : '附加字段 2', extra2]);
      if (tail.length) {
        const phone = tail.at(-1);
        if (/^\+?\d{6,}$/u.test(phone)) {
          if (tail.length > 1) fields.push(['尾部字段', tail.slice(0, -1).join(', ')]);
          fields.push(['电话', phone]);
        } else {
          fields.push(['附加字段 3', tail.join(', ')]);
        }
      }
    } else if (parts.length > mailIdx + 2) {
      fields.push(['尾部字段', parts.slice(mailIdx + 2).join(', ')]);
    }
  } else {
    fields.push(['附加字段', parts.slice(2).join(', ')]);
  }
  return result('逗号分隔格式', fields, ['未明确标注的列按顺序保留为附加字段，请核对其含义。']);
}

function parseWhitespace(raw) {
  const parts = raw.trim().split(/\s+/u).filter(Boolean);
  if (parts.length < 2) return null;
  if (parts.length === 2) {
    const fields = [['账号', parts[0]], ['密码', parts[1]]];
    if (EMAIL_RE.test(parts[0])) {
      fields.push(['邮箱账号', parts[0]]);
      if (/@(?:outlook|hotmail|live)\./iu.test(parts[0])) fields.push(['邮箱登录地址', 'live.com']);
    }
    return result('双字段空白分隔格式', fields);
  }
  const eIdx = emailIndex(parts, 2);
  const fields = [['账号', parts[0]], ['密码', parts[1]]];
  if (eIdx >= 0) {
    const beforeEmail = parts.slice(2, eIdx);
    // Grouped four-character blocks are retained as one opaque supplemental field.
    const groupedCode = beforeEmail.length === 4 && beforeEmail.every(x => /^[A-Z0-9]{4}$/iu.test(x));
    if (groupedCode) {
      fields.push(['邮箱', parts[eIdx]], ['2FA代码', beforeEmail.join(' ')]);
    } else {
      if (beforeEmail.length) fields.push(['前置附加字段', beforeEmail.join(' ')]);
      fields.push(['邮箱', parts[eIdx]]);
    }
    if (parts[eIdx + 1]) fields.push(['邮箱附加字段', parts[eIdx + 1]]);
    if (parts.length > eIdx + 2) fields.push(['尾部字段', parts.slice(eIdx + 2).join(' ')]);
  } else {
    fields.push(['附加字段', parts.slice(2).join(' ')]);
  }
  return result('空白分隔格式', fields, ['未标注字段按原顺序保留为附加字段，没有自动猜测其含义。']);
}

export function parseText(input) {
  const raw = String(input ?? '').replace(/\u0000/g, '').trim();
  if (!raw) return { ok: false, format: '', fields: [], text: '', warnings: [], error: '请先粘贴文本。' };
  const parsers = [parseLabeled, parseAppleCompact, splitDash, parseComma, parseWhitespace];
  for (const parser of parsers) {
    try {
      const parsed = parser(raw);
      if (parsed?.ok) return parsed;
    } catch (error) {
      // Parsing one candidate must never prevent other format handlers from running.
    }
  }
  return { ok: false, format: '', fields: [], text: '', warnings: [], error: '暂时无法可靠识别。请检查分隔符，或改用一行一个“字段名：内容”的形式。' };
}

export const supportedFormatSummary = [
  '带字段标签的文本（例如“账号：xxx”）',
  '固定六字段并以日期结尾的紧凑文本',
  '连续三个或更多横线分隔的文本',
  '逗号分隔文本',
  '空格、制表符或换行分隔的简单文本',
];
