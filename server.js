const express = require('express');
const fs = require('fs');
const path = require('path');

// 1. 读取本地题库 JSON
const questionBankPath = path.join(__dirname, 'question_bank.json');
const raw = fs.readFileSync(questionBankPath, 'utf-8');
const QUESTION_BANK = JSON.parse(raw);

const app = express();
const PORT = process.env.PORT || 3000;

// 2. 允许 JSON / 表单请求
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 工具函数：简单的文本标准化
function normalizeText(str) {
  return (str || '')
    .replace(/\s+/g, '')        // 去掉所有空白
    .replace(/[，。、？！．\.\?,!；;：:（）\(\)【】\[\]“”"']/g, '') // 去掉中英标点
    .toLowerCase();
}

// 简单相似度：用“包含率”做一个非常粗糙的匹配
function similarity(a, b) {
  if (!a || !b) return 0;
  const long = a.length >= b.length ? a : b;
  const short = a.length < b.length ? a : b;
  if (long.includes(short)) return short.length / long.length;
  return 0;
}

// 3. 查询接口：GET /query
// 支持参数：title（题目）、options（可选）、type（题型，可选）
app.get('/query', (req, res) => {
  const title = req.query.title || '';
  const options = req.query.options || '';
  const type = req.query.type || '';

  if (!title) {
    return res.json({
      code: 1,
      msg: '缺少参数 title',
    });
  }

  const normalizedTitle = normalizeText(title);

  let bestMatch = null;
  let bestScore = 0;

  // 在题库中查找最相似的题目
  for (const q of QUESTION_BANK) {
    const normQ = normalizeText(q.question);
    const score = similarity(normalizedTitle, normQ);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = q;
    }
  }

  // 设置一个简单的阈值，例如 > 0.5 才认为匹配成功
  if (!bestMatch || bestScore < 0.5) {
    return res.json({
      code: 2,
      msg: '题库中未找到匹配题目',
      data: null,
    });
  }

  res.json({
    code: 0,
    data: {
      question: bestMatch.question,
      options: bestMatch.options || [],
      answer: bestMatch.answer,
      type: bestMatch.type,
      ai: bestMatch.explanation || ''
    }
  });
});

// 一个简单的健康检测
app.get('/', (req, res) => {
  res.send('Question bank API is running');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});