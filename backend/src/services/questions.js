/**
 * Math Question Generator
 * Generates random math questions with 4 multiple choice options
 */

const DIFFICULTY = {
    EASY: 'easy',      // Addition, subtraction (1-20)
    MEDIUM: 'medium',  // Multiplication, division (1-12)
    HARD: 'hard'       // Mixed operations
};

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function generateWrongAnswers(correctAnswer, count = 3) {
    const wrongAnswers = new Set();
    const range = Math.max(10, Math.abs(correctAnswer) * 0.5);

    while (wrongAnswers.size < count) {
        let wrong;
        const variation = randomInt(1, Math.ceil(range));

        if (Math.random() > 0.5) {
            wrong = correctAnswer + variation;
        } else {
            wrong = correctAnswer - variation;
        }

        if (wrong !== correctAnswer && !wrongAnswers.has(wrong)) {
            wrongAnswers.add(wrong);
        }
    }

    return Array.from(wrongAnswers);
}

function generateEasyQuestion() {
    const a = randomInt(1, 100);
    const b = randomInt(1, 100);
    //const isAddition = Math.random() > 0.5;
    const type = randomInt(1, 4);

    if (type === 1) {
        return {
            question: `${a} + ${b} = ?`,
            answer: a + b
        };
    } else if (type === 2) {
        const larger = Math.max(a, b);
        const smaller = Math.min(a, b);
        return {
            question: `${larger} - ${smaller} = ?`,
            answer: larger - smaller
        };
    } else if (type === 3) {
        const a = randomInt(2, 12);
        const b = randomInt(2, 12);
        return {
            question: `${a} × ${b} = ?`,
            answer: a * b
        };
    } else {
        const b = randomInt(2, 12);
        const answer = randomInt(2, 12);
        const a = b * answer;
        return {
            question: `${a} ÷ ${b} = ?`,
            answer: answer
        };
    }
}

function generateMediumQuestion() {
    const type = randomInt(1, 5);

    if (type === 1) {
        const a = randomInt(2, 15);
        const b = randomInt(2, 12);
        return {
            question: `${a} × ${b} = ?`,
            answer: a * b
        };
    } else if (type === 2) {
        const b = randomInt(2, 15);
        const answer = randomInt(2, 12);
        const a = b * answer;
        return {
            question: `${a} ÷ ${b} = ?`,
            answer: answer
        };
    } else if (type === 3) {
        // a × b + c
        const a = randomInt(2, 10);
        const b = randomInt(2, 10);
        const c = randomInt(1, 20);
        return {
            question: `${a} × ${b} + ${c} = ?`,
            answer: a * b + c
        };
    } else if (type === 4) {
        // a × b - c
        const a = randomInt(2, 10);
        const b = randomInt(2, 10);
        const c = randomInt(1, a * b - 1);
        return {
            question: `${a} × ${b} - ${c} = ?`,
            answer: a * b - c
        };
    } else {
        // (a + b) × c
        const a = randomInt(2, 10);
        const b = randomInt(2, 10);
        const c = randomInt(2, 5);
        return {
            question: `(${a} + ${b}) × ${c} = ?`,
            answer: (a + b) * c
        };
    }
}

function generateHardQuestion() {
    const type = randomInt(1, 4);

    if (type === 1) {
        const a = Math.floor(Math.random() * 25) + 2;
        return {
            question: `${a}² = ?`,
            answer: a * a
        };
    } else if (type === 2) {
        const a = Math.floor(Math.random() * 20) + 2;
        return {
            question: `√${a * a} = ?`,
            answer: a
        };
    } else if (type === 3) {
        const pOptions = [10, 20, 25, 50, 75];
        const percent = pOptions[Math.floor(Math.random() * pOptions.length)];

        let multiplier = 1;
        if (percent === 10) multiplier = 10;
        else if (percent === 20) multiplier = 5;
        else if (percent === 25) multiplier = 4;
        else if (percent === 50) multiplier = 2;
        else if (percent === 75) multiplier = 4;

        const factor = Math.floor(Math.random() * 20) + 1;
        const base = factor * multiplier;

        return {
            question: `${percent}% of ${base} = ?`,
            answer: (percent * base) / 100
        };
    } else {
        const algebraType = Math.random();

        // x + a = b
        if (algebraType < 0.25) {
            const x = Math.floor(Math.random() * 50) + 1;
            const a = Math.floor(Math.random() * 50) + 1;
            const b = x + a;

            return {
                question: `Find x: x + ${a} = ${b}`,
                answer: x
            };

        // ax = b
        } else if (algebraType < 0.5) {
            const x = Math.floor(Math.random() * 15) + 2;
            const a = Math.floor(Math.random() * 10) + 2;
            const b = a * x;

            return {
                question: `Find x: ${a}x = ${b}`,
                answer: x
            };

        // x / a = b
        } else if (algebraType < 0.75) {
            const a = Math.floor(Math.random() * 10) + 2;
            const b = Math.floor(Math.random() * 15) + 2;
            const x = a * b;

            return {
                question: `Find x: x / ${a} = ${b}`,
                answer: x
            };

        // ax + b = c
        } else {
            const x = Math.floor(Math.random() * 12) + 1;
            const a = Math.floor(Math.random() * 5) + 2;
            const b = Math.floor(Math.random() * 20) + 1;
            const c = (a * x) + b;

            return {
                question: `Find x: ${a}x + ${b} = ${c}`,
                answer: x
            };
        }
    }
}
export function generateQuestion(difficulty = DIFFICULTY.MEDIUM) {
    let questionData;

    switch (difficulty) {
        case DIFFICULTY.EASY:
            questionData = generateEasyQuestion();
            break;
        case DIFFICULTY.HARD:
            questionData = generateHardQuestion();
            break;
        case DIFFICULTY.MEDIUM:
        default:
            questionData = generateMediumQuestion();
            break;
    }

    const wrongAnswers = generateWrongAnswers(questionData.answer);
    const allOptions = [questionData.answer, ...wrongAnswers];
    const shuffledOptions = shuffleArray(allOptions);
    const correctIndex = shuffledOptions.indexOf(questionData.answer);

    return {
        question: questionData.question,
        options: shuffledOptions,
        correctIndex: correctIndex
    };
}

export function generateQuestionSet(count = 10, difficulty = DIFFICULTY.MEDIUM) {
    const questions = [];
    for (let i = 0; i < count; i++) {
        questions.push(generateQuestion(difficulty));
    }
    return questions;
}

export { DIFFICULTY };
