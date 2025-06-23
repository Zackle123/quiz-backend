const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./questions.db', (err) => {
  if (err) return console.error(err.message);
  console.log('Connected to SQLite database.');
});

// Create schema
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (question_id) REFERENCES questions(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      score INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS submission_answers (
      submission_id INTEGER,
      question_id INTEGER,
      answer_id INTEGER,
      FOREIGN KEY (submission_id) REFERENCES submissions(id),
      FOREIGN KEY (question_id) REFERENCES questions(id),
      FOREIGN KEY (answer_id) REFERENCES answers(id)
    );
  `);
});

// GET /questions
app.get('/questions', (req, res) => {
  db.all('SELECT * FROM questions ORDER BY RANDOM() LIMIT 10', [], (err, questions) => {
    if (err) return res.status(500).json({ error: err.message });

    const questionIds = questions.map(q => q.id);

    const placeholders = questionIds.map(() => '?').join(',');
    db.all(
      `SELECT * FROM answers WHERE question_id IN (${placeholders})`,
      questionIds,
      (err, answers) => {
        if (err) return res.status(500).json({ error: err.message });

        const grouped = questions.map(q => ({
          id: q.id,
          text: q.text,
          answers: answers.filter(a => a.question_id === q.id).map(a => ({
            id: a.id,
            text: a.text,
            is_correct:a.is_correct
          }))
        }));

        res.json(grouped);
      }
    );
  });
});

// POST /questions
// POST /questions
app.post('/questions', (req, res) => {
  const { text, answers } = req.body;

  // Validate request structure
  if (!text || !Array.isArray(answers) || answers.length !== 4) {
    return res.status(400).json({ error: 'Question text and 4 answers are required.' });
  }

  const correctAnswers = answers.filter(a => a.is_correct === true);
  if (correctAnswers.length !== 1) {
    return res.status(400).json({ error: 'Exactly one answer must be marked as correct.' });
  }

  db.run('INSERT INTO questions (text) VALUES (?)', [text], function (err) {
    if (err) return res.status(500).json({ error: err.message });

    const questionId = this.lastID;

    const insertAnswer = db.prepare(`
      INSERT INTO answers (question_id, text, is_correct) VALUES (?, ?, ?)
    `);

    answers.forEach(answer => {
      insertAnswer.run(questionId, answer.text, answer.is_correct ? 1 : 0);
    });

    insertAnswer.finalize();

    res.status(201).json({ message: 'Question and answers added successfully.', questionId });
  });
});


app.post('/submit', (req, res) => {
  const { name, answers } = req.body;
  if (!name || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'Invalid submission format' });
  }

  // Fetch correct answers from DB
  const placeholders = answers.map(() => '?').join(',');
  const answerIds = answers.map(a => a.answerId);

  db.all(
    `SELECT id, question_id, is_correct FROM answers WHERE id IN (${placeholders})`,
    answerIds,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const score = rows.filter(r => r.is_correct === 1).length;

      db.run(
        `INSERT INTO submissions (name, score) VALUES (?, ?)`,
        [name, score],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });

          const submissionId = this.lastID;

          const insertStmt = db.prepare(`
            INSERT INTO submission_answers (submission_id, question_id, answer_id)
            VALUES (?, ?, ?)
          `);

          rows.forEach(row => {
            insertStmt.run(submissionId, row.question_id, row.id);
          });

          insertStmt.finalize();

          res.status(201).json({ message: 'Submission saved', score });
        }
      );
    }
  );
});

app.get('/leaderboard', (req, res) => {
  db.all(
    `SELECT name, score, created_at FROM submissions ORDER BY score DESC, created_at ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
