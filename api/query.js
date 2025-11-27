const fs = require('fs');
const path = require('path');

// 异步加载题库（每次请求读一次，简单稳定）
function loadQuestionBank() {
  return new Promise((resolve, reject) => {
    const questionBankPath = path.join(process.cwd(), 'question_bank.json');
    fs.readFile(questionBankPath, 'utf-8', (err, data) => {
      if (err) {
        return reject(err);
      }
      try {
        const json = JSON.parse(data);
        resolve(json);
      } catch (e) {
        reject(e);
      }
    });
  });
}

function normalizeText(str) {
  return (str || '')
    .replace(/\s+/g, '')
    .replace(/[，。、？！．\.\?,!；;：:（）\(\)【】\[\]“”"']/g, '')
    .toLowerCase();
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const long = a.length >= b.length ? a : b;
  const short = a.length < b.length ? a : b;
  if (long.includes(short)) return short.length / long.length;
  return 0;
}

// Vercel Serverless Function 入口（支持 async）
module.exports = async (req, res) => {
  try {
    const method = req.method.toUpperCase();
    let title = '';
    let options = '';
    let type = '';

    if (method === 'GET') {
      title = req.query.title || '';
      options = req.query.options || '';
      type = req.query.type || '';
    } else if (method === 'POST') {
      title = (req.body && req.body.title) || '';
      options = (req.body && req.body.options) || '';
      type = (req.body && req.body.type) || '';
    }

    if (!title) {
      return res.status(200).json({
        code: 1,
        msg: '缺少参数 title',
      });
    }

    const bank = await loadQuestionBank();
    const normalizedTitle = normalizeText(title);

    let bestMatch = null;
    let bestScore = 0;

    for (const q of bank) {
      const normQ = normalizeText(q.question);
      const score = similarity(normalizedTitle, normQ);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = q;
      }
    }

    if (!bestMatch || bestScore < 0.5) {
      return res.status(200).json({
        code: 2,
        msg: '题库中未找到匹配题目',
        data: null,
      });
    }

    return res.status(200).json({
      code: 0,
      data: {
        question: bestMatch.question,
        options: bestMatch.options || [],
        answer: bestMatch.answer,
        type: bestMatch.type,
        ai: bestMatch.explanation || '',
      },
    });
  } catch (err) {
    // 这里直接把错误返回出来，方便你看到问题
    return res.status(500).json({
      code: 500,
      msg: 'Server error',
      error: String(err),
    });
  }
};
