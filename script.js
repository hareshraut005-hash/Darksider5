// ---------- STATE ----------
let currentLang = localStorage.getItem('lang') || 'en';
let currentUser = localStorage.getItem('user') || null;
let topics = [];
let quizData = {};
let currentTopic = null;
let currentQuestions = [];
let questionIndex = 0;
let score = 0;
let answered = false;
let speechSynth = window.speechSynthesis;
let speaking = false;
let progressData = JSON.parse(localStorage.getItem('progress')) || {};

// ---------- DOM ELEMENTS ----------
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app');
const langSelect = document.getElementById('lang-select');
const settingsModal = document.getElementById('settings-modal');
const legalModal = document.getElementById('legal-modal');

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded', async () => {
    langSelect.value = currentLang;
    applyLanguage(currentLang);

    if (localStorage.getItem('user')) {
        showApp();
    } else {
        showLogin();
    }

    try {
        const topicsRes = await fetch('data/topics.json');
        topics = await topicsRes.json();
        const quizRes = await fetch('data/quiz.json');
        const quizArray = await quizRes.json();
        quizArray.forEach(q => {
            const tid = q.topicId || q.id;
            if (!quizData[tid]) quizData[tid] = [];
            quizData[tid].push(q);
        });
        renderTopics();
    } catch (err) {
        console.error('Data load error:', err);
    }
});

// ---------- LOGIN ----------
document.getElementById('login-btn').addEventListener('click', () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    if (email && password) {
        localStorage.setItem('user', email);
        showApp();
    } else {
        alert('Please enter email and password');
    }
});

document.getElementById('guest-btn').addEventListener('click', () => {
    localStorage.setItem('user', 'guest');
    showApp();
});

function showLogin() {
    loginScreen.classList.add('active');
    appScreen.classList.remove('active');
}

function showApp() {
    loginScreen.classList.remove('active');
    appScreen.classList.add('active');
    showView('home');
}

// ---------- LANGUAGE ----------
langSelect.addEventListener('change', (e) => {
    currentLang = e.target.value;
    localStorage.setItem('lang', currentLang);
    applyLanguage(currentLang);
    renderTopics();
    if (currentTopic) updateLearn();
});

function applyLanguage(lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = translations[lang][key] || el.textContent;
    });
}

const translations = {
    en: {
        'back': 'Back',
        'listen': 'Listen',
        'take-quiz': 'Take Quiz',
        'settings': 'Settings',
        'privacy': 'Privacy Policy',
        'terms': 'Terms & Conditions',
        'about': 'About Us',
        'logout': 'Logout'
    },
    hi: {
        'back': 'वापस',
        'listen': 'सुनें',
        'take-quiz': 'क्विज़ लें',
        'settings': 'सेटिंग्स',
        'privacy': 'गोपनीयता नीति',
        'terms': 'नियम और शर्तें',
        'about': 'हमारे बारे में',
        'logout': 'लॉगआउट'
    }
};

// ---------- VIEW MANAGEMENT ----------
function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`${viewName}-view`).classList.add('active');
}

// ---------- PROGRESS & LEVELS ----------
function getTopicProgress(topicId) {
    return progressData[topicId] || { learn: false, quizScore: null };
}

function calculateProgressPercent(topicId) {
    const prog = getTopicProgress(topicId);
    let percent = 0;
    if (prog.learn) percent += 50; // reading counts 50%
    if (prog.quizScore !== null) {
        percent += (prog.quizScore / 100) * 50; // quiz score contributes up to 50%
    }
    return Math.round(percent);
}

function getLevel(percent) {
    if (percent >= 90) return '🏆 Level 5';
    if (percent >= 75) return '🔥 Level 4';
    if (percent >= 50) return '⭐ Level 3';
    if (percent >= 25) return '📘 Level 2';
    return '📖 Level 1';
}

function saveProgress(topicId, data) {
    progressData[topicId] = data;
    localStorage.setItem('progress', JSON.stringify(progressData));
}

// ---------- RENDER TOPICS ----------
function renderTopics() {
    const list = document.getElementById('topics-list');
    list.innerHTML = '';
    topics.forEach((topic, index) => {
        const tid = topic.topicId || topic.id;
        const percent = calculateProgressPercent(tid);
        const level = getLevel(percent);
        const card = document.createElement('div');
        card.className = 'topic-card';
        card.innerHTML = `
            <div class="topic-number">${index + 1}</div>
            <div class="topic-title">${topic.title[currentLang]}</div>
            <div class="topic-progress">
                <span class="progress-percent">${percent}%</span>
                <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
                <span class="level-badge">${level}</span>
            </div>
        `;
        card.addEventListener('click', () => openLearn(topic));
        list.appendChild(card);
    });
}

// ---------- LEARN ----------
function openLearn(topic) {
    currentTopic = topic;
    updateLearn();
    showView('learn');
}

function updateLearn() {
    if (!currentTopic) return;
    const tid = currentTopic.topicId || currentTopic.id;
    document.getElementById('learn-title').textContent = currentTopic.title[currentLang];
    document.getElementById('learn-paragraph').textContent = currentTopic.paragraph[currentLang];

    const percent = calculateProgressPercent(tid);
    const badge = document.getElementById('learn-progress-badge');
    badge.textContent = `${percent}% · ${getLevel(percent)}`;
}

// TTS Paragraph
document.getElementById('listen-btn').addEventListener('click', () => {
    if (!currentTopic) return;
    const text = currentTopic.paragraph[currentLang];
    speak(text);
});

// TTS Question
document.getElementById('listen-question-btn').addEventListener('click', () => {
    const q = currentQuestions[questionIndex];
    if (q) {
        speak(q.question[currentLang]);
    }
});

function speak(text) {
    if (speaking) {
        speechSynth.cancel();
        speaking = false;
        return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = currentLang === 'hi' ? 'hi-IN' : 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onstart = () => speaking = true;
    utterance.onend = () => speaking = false;
    speechSynth.speak(utterance);
}

// ---------- QUIZ ----------
document.getElementById('quiz-btn').addEventListener('click', () => {
    if (!currentTopic) return;
    const tid = currentTopic.topicId || currentTopic.id;
    // Mark as learned
    const prog = getTopicProgress(tid);
    if (!prog.learn) {
        prog.learn = true;
        saveProgress(tid, prog);
    }
    // Load quiz
    if (!quizData[tid] || quizData[tid].length === 0) {
        alert('Quiz not available yet');
        return;
    }
    currentQuestions = quizData[tid];
    questionIndex = 0;
    score = 0;
    answered = false;
    showView('quiz');
    renderQuestion();
});

function renderQuestion() {
    const q = currentQuestions[questionIndex];
    document.getElementById('quiz-progress').textContent = `Question ${questionIndex + 1} / ${currentQuestions.length}`;
    document.getElementById('quiz-question').textContent = q.question[currentLang];
    const optionsDiv = document.getElementById('quiz-options');
    optionsDiv.innerHTML = '';
    q.options.forEach((opt, idx) => {
        const btn = document.createElement('div');
        btn.className = 'option';
        btn.textContent = opt[currentLang];
        btn.addEventListener('click', () => selectOption(idx));
        optionsDiv.appendChild(btn);
    });
    document.getElementById('next-btn').classList.add('hidden');
    document.getElementById('quiz-result').classList.add('hidden');
}

function selectOption(idx) {
    if (answered) return;
    answered = true;
    const q = currentQuestions[questionIndex];
    const options = document.querySelectorAll('.option');
    options.forEach((opt, i) => {
        opt.classList.add('disabled');
        if (i === q.correctIndex) opt.classList.add('correct');
        else if (i === idx) opt.classList.add('wrong');
    });
    if (idx === q.correctIndex) score++;
    document.getElementById('next-btn').classList.remove('hidden');
}

document.getElementById('next-btn').addEventListener('click', () => {
    questionIndex++;
    if (questionIndex < currentQuestions.length) {
        answered = false;
        renderQuestion();
    } else {
        showResult();
    }
});

function showResult() {
    const total = currentQuestions.length;
    const percent = Math.round((score / total) * 100);
    document.getElementById('quiz-result').classList.remove('hidden');
    document.getElementById('result-title').textContent = currentLang === 'hi' ? 'परिणाम' : 'Result';
    document.getElementById('score-text').textContent = `${score} / ${total} (${percent}%)`;
    if (currentTopic) {
        const tid = currentTopic.topicId || currentTopic.id;
        const prog = getTopicProgress(tid);
        prog.quizScore = percent;
        saveProgress(tid, prog);
        updateLearn();
    }
    document.getElementById('next-btn').classList.add('hidden');
    document.getElementById('restart-btn').addEventListener('click', () => {
        questionIndex = 0;
        score = 0;
        answered = false;
        renderQuestion();
    });
}

// Back buttons
document.getElementById('back-to-topics').addEventListener('click', () => {
    renderTopics(); // refresh progress
    showView('home');
});
document.getElementById('back-to-learn').addEventListener('click', () => showView('learn'));

// Settings
document.getElementById('settings-btn').addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
});
document.getElementById('close-settings').addEventListener('click', () => settingsModal.classList.add('hidden'));

// Legal modals
document.querySelectorAll('.settings-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const action = e.currentTarget.getAttribute('data-action');
        if (action === 'logout') {
            localStorage.removeItem('user');
            showLogin();
            settingsModal.classList.add('hidden');
            return;
        }
        showLegal(action);
        settingsModal.classList.add('hidden');
    });
});

function showLegal(action) {
    const title = document.getElementById('legal-title');
    const text = document.getElementById('legal-text');
    if (action === 'privacy') {
        title.textContent = currentLang === 'hi' ? 'गोपनीयता नीति' : 'Privacy Policy';
        text.textContent = currentLang === 'hi' ? 'आपकी गोपनीयता हमारे लिए महत्वपूर्ण है। यह ऐप केवल शैक्षिक उद्देश्यों के लिए है।' : 'Your privacy is important to us. This app is for educational purposes only.';
    } else if (action === 'terms') {
        title.textContent = currentLang === 'hi' ? 'नियम और शर्तें' : 'Terms & Conditions';
        text.textContent = currentLang === 'hi' ? 'कृपया इस ऐप का जिम्मेदारी से उपयोग करें।' : 'Please use this app responsibly.';
    } else if (action === 'about') {
        title.textContent = currentLang === 'hi' ? 'हमारे बारे में' : 'About Us';
        text.textContent = currentLang === 'hi' ? 'DarkSider एक शैक्षिक ऐप है।' : 'DarkSider is an educational app.';
    }
    legalModal.classList.remove('hidden');
}

document.getElementById('close-legal').addEventListener('click', () => legalModal.classList.add('hidden'));