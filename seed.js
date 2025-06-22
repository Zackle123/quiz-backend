const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./questions.db');

const sampleQuestions = [
  {
    text: "What is the capital of France?",
    correct: "Paris",
    wrong: ["London", "Berlin", "Rome"]
  },
  {
    text: "Which planet is known as the Red Planet?",
    correct: "Mars",
    wrong: ["Jupiter", "Venus", "Saturn"]
  },
  {
    text: "What is the largest ocean on Earth?",
    correct: "Pacific Ocean",
    wrong: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean"]
  },
  {
    text: "Who wrote 'Hamlet'?",
    correct: "William Shakespeare",
    wrong: ["Charles Dickens", "Leo Tolstoy", "Mark Twain"]
  },
  {
    text: "What is the smallest prime number?",
    correct: "2",
    wrong: ["1", "3", "0"]
  },
  {
    text: "Which gas do plants absorb from the atmosphere?",
    correct: "Carbon Dioxide",
    wrong: ["Oxygen", "Hydrogen", "Nitrogen"]
  },
  {
    text: "Which element has the chemical symbol 'O'?",
    correct: "Oxygen",
    wrong: ["Gold", "Osmium", "Zinc"]
  },
  {
    text: "What is the freezing point of water?",
    correct: "0°C",
    wrong: ["100°C", "32°C", "10°C"]
  },
  {
    text: "Which language is primarily spoken in Brazil?",
    correct: "Portuguese",
    wrong: ["Spanish", "French", "English"]
  },
  {
    text: "What is the currency of Japan?",
    correct: "Yen",
    wrong: ["Won", "Dollar", "Peso"]
  }
];

// Wrap SQLite run and get in promises for easier flow control
function runAsync(db, sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function seed() {
  try {
    console.log("Seeding database...");

    // Clear tables (order matters due to foreign keys)
    await runAsync(db, "DELETE FROM submission_answers");
    await runAsync(db, "DELETE FROM submissions");
    await runAsync(db, "DELETE FROM answers");
    await runAsync(db, "DELETE FROM questions");

    for (const q of sampleQuestions) {
      // Insert question, get lastID for question_id
      const questionResult = await runAsync(db, "INSERT INTO questions (text) VALUES (?)", [q.text]);
      const questionId = questionResult.lastID;

      // Prepare answers (1 correct + 3 wrong) and shuffle
      const allAnswers = [...q.wrong.map(text => ({ text, is_correct: 0 })), { text: q.correct, is_correct: 1 }];
      allAnswers.sort(() => Math.random() - 0.5);

      // Insert answers linked to question_id
      for (const ans of allAnswers) {
        await runAsync(db, "INSERT INTO answers (question_id, text, is_correct) VALUES (?, ?, ?)", [
          questionId,
          ans.text,
          ans.is_correct
        ]);
      }
    }

    console.log("Database seeded successfully!");
    db.close();
  } catch (err) {
    console.error("Error seeding database:", err);
  }
}

seed();
