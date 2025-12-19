import { setAllWords, getAllWords, setCurrentReview, getCurrentReview, setCurrentPage, getCurrentPage, setIsRevealed, getIsRevealed } from './srs/memoryState.js';
import { selectRandomReview, checkAnswer, calculateStats, calculateNextState, adjustBrightness } from './srs/scheduler.js';
import { renderInputPage } from './ui/input.js';
import { renderReviewPage } from './ui/review.js';
import { renderProgressPage } from './ui/dashboard.js';
import { saveData, loadData } from './storage/localStore.js';

const defaultConfig = {
  main_headline: "Learn vocabulary with real memory, not repetition.",
  description_text: "Master any language pair with a scientific approach. Words are tested in both directions, and review timing adapts based on your true memory strength—not daily habits.",
  cta_button_text: "Start Learning",
  language_a_label: "Language A",
  language_b_label: "Language B"
};

const appRoot = document.getElementById('app');

const app = {
  allWords: [],
  currentReview: null,
  currentPage: 'landing',
  isRevealed: false,

  async init() {
    window.app = this;

    if (!window.dataSdk) {
      console.warn('dataSdk not found — creating local fallback');
      window.dataSdk = window.dataSdk || {
        _data: [],
        init: async (handler) => { window.dataSdk._handler = handler; handler.onDataChanged(window.dataSdk._data); return { isOk: true }; },
        create: async (obj) => { obj.__backendId = obj.id; window.dataSdk._data.push(obj); window.dataSdk._handler?.onDataChanged(window.dataSdk._data); return { isOk: true }; },
        delete: async (obj) => { window.dataSdk._data = window.dataSdk._data.filter(w => w.__backendId !== obj.__backendId); window.dataSdk._handler?.onDataChanged(window.dataSdk._data); return { isOk: true }; },
        update: async (obj) => { window.dataSdk._data = window.dataSdk._data.map(w => w.__backendId === obj.__backendId ? obj : w); window.dataSdk._handler?.onDataChanged(window.dataSdk._data); return { isOk: true }; }
      };
    }

    if (!window.elementSdk) {
      console.warn('elementSdk not found — creating local fallback');
      window.elementSdk = window.elementSdk || { init: async () => ({}), setConfig: () => {}, config: defaultConfig };
    }

    const dataHandler = {
      onDataChanged: (data) => {
        this.allWords = data.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        this.render();
      }
    };

    const initResult = await window.dataSdk.init(dataHandler);
    if (!initResult.isOk) console.error('Failed to initialize data SDK');

    await window.elementSdk.init({
      defaultConfig,
      onConfigChange: async (config) => { this.render(); },
      mapToCapabilities: (config) => ({})
    });

    this.render();
  },

  render() {
    const config = window.elementSdk?.config || defaultConfig;
    const bgColor = config.background_color || '#fafafa';
    const cardColor = config.card_color || '#ffffff';
    const textColor = config.text_color || '#2c3e50';
    const primaryColor = config.primary_color || '#3498db';
    const secondaryColor = config.secondary_color || '#5a6c7d';
    const fontFamily = config.font_family || 'Inter';
    const fontSize = config.font_size || 16;

    document.body.style.background = bgColor;
    document.body.style.color = textColor;
    document.body.style.fontFamily = `${fontFamily}, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    document.body.style.fontSize = `${fontSize}px`;

    const style = document.createElement('style');
    style.textContent = `
      .cta-button, .add-button, .reveal-button { background: ${primaryColor}; }
      .cta-button:hover, .add-button:hover, .reveal-button:hover { background: ${adjustBrightness(primaryColor, -20)}; }
      .nav-button.active { background: ${primaryColor}; border-color: ${primaryColor}; }
      .nav-button:hover { border-color: ${primaryColor}; color: ${primaryColor}; }
      .input-form, .word-list, .review-card, .stat-card, .explanation-section { background: ${cardColor}; }
      .stat-value { color: ${primaryColor}; }
      .page-header p, .stat-label, .landing-page p { color: ${secondaryColor}; }
      .form-group input:focus, .answer-input:focus { border-color: ${primaryColor}; }
      .feedback-button:hover { border-color: ${primaryColor}; }
    `;
    const existingStyle = document.querySelector('style[data-dynamic]');
    if (existingStyle) existingStyle.remove();
    style.setAttribute('data-dynamic', 'true');
    document.head.appendChild(style);

    if (this.currentPage === 'landing') {
      appRoot.innerHTML = `
        <div class="landing-page">
          <h1>${config.main_headline || defaultConfig.main_headline}</h1>
          <p>${config.description_text || defaultConfig.description_text}</p>
          <p>Users can input any two languages. Words are tested in both directions. Review timing adapts based on memory strength.</p>
          <button class="cta-button" onclick="window.app.navigateTo('input')">${config.cta_button_text || defaultConfig.cta_button_text}</button>
        </div>
      `;
    } else {
      let content = '';
      if (this.currentPage === 'input') content = renderInputPage(config, this.allWords);
      else if (this.currentPage === 'review') content = renderReviewPage(config, this.currentReview, this.isRevealed);
      else if (this.currentPage === 'progress') content = renderProgressPage(this.allWords);

      appRoot.innerHTML = `
        <div class="nav-bar">
          <div class="nav-title">Vocabulary Platform</div>
          <div class="nav-buttons">
            <button class="nav-button ${this.currentPage === 'input' ? 'active' : ''}" onclick="window.app.navigateTo('input')">Add Words</button>
            <button class="nav-button ${this.currentPage === 'review' ? 'active' : ''}" onclick="window.app.navigateTo('review')">Review</button>
            <button class="nav-button ${this.currentPage === 'progress' ? 'active' : ''}" onclick="window.app.navigateTo('progress')">Progress</button>
          </div>
        </div>
        ${content}
      `;
    }
  },

  async addWord(event) {
    event.preventDefault();
    if (this.allWords.length >= 999) {
      this.showInlineMessage('Maximum limit of 999 words reached. Please delete some words first.', 'error');
      return;
    }
    const langA = document.getElementById('langA').value.trim();
    const wordA = document.getElementById('wordA').value.trim();
    const langB = document.getElementById('langB').value.trim();
    const wordB = document.getElementById('wordB').value.trim();
    const addBtn = document.getElementById('addBtn');
    addBtn.disabled = true;
    addBtn.textContent = 'Adding...';
    const now = Date.now();
    const result = await window.dataSdk.create({
      id: `word-${now}`,
      languageA: langA,
      languageB: langB,
      wordA: wordA,
      wordB: wordB,
      nextReviewDate: now,
      intervalDays: 1,
      masteryLevel: 0,
      correctCount: 0,
      lastReviewed: 0,
      createdAt: new Date().toISOString()
    });
    if (result.isOk) {
      document.getElementById('wordA').value = '';
      document.getElementById('wordB').value = '';
      document.getElementById('wordA').focus();
    } else {
      this.showInlineMessage('Failed to add word. Please try again.', 'error');
    }
    addBtn.disabled = false;
    addBtn.textContent = 'Add Word Pair';
  },

  async deleteWord(backendId) {
    const wordToDelete = this.allWords.find(w => w.__backendId === backendId);
    if (!wordToDelete) return;
    const result = await window.dataSdk.delete(wordToDelete);
    if (!result.isOk) this.showInlineMessage('Failed to delete word. Please try again.', 'error');
  },

  getDueWords() {
    const now = Date.now();
    return this.allWords.filter(word => word.nextReviewDate <= now);
  },

  setCurrentReview(review) {
    this.currentReview = review;
  },

  getCurrentReview() {
    return this.currentReview;
  },

  setCurrentPage(page) {
    this.currentPage = page;
  },

  navigateTo(page) {
    this.currentPage = page;
    if (page === 'review') {
      this.currentReview = null;
      this.isRevealed = false;
    }
    this.render();
  },

  revealAnswer() {
    this.isRevealed = true;
    const userAnswer = document.getElementById('answerInput')?.value || '';
    const correctAnswer = this.currentReview.correctAnswer;
    const feedback = checkAnswer(userAnswer, correctAnswer);
    this.currentReview.autoFeedback = feedback;
    this.currentReview.userAnswer = userAnswer;
    this.render();
  },

  async submitFeedback(feedback) {
    const word = this.currentReview.word;
    const updatedWord = calculateNextState(word, feedback);
    const result = await window.dataSdk.update(updatedWord);
    if (result.isOk) {
      this.currentReview = null;
      this.isRevealed = false;
      this.render();
    } else {
      this.showInlineMessage('Failed to save feedback. Please try again.', 'error');
    }
  },

  calculateStats() {
    const recognition = this.allWords.filter(w => w.masteryLevel < 0.7).length;
    const comprehension = this.allWords.filter(w => w.masteryLevel >= 0.7 && w.masteryLevel < 1.5).length;
    const active = this.allWords.filter(w => w.masteryLevel >= 1.5).length;
    return { recognition, comprehension, active };
  },

  showInlineMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'error' ? '#e74c3c' : '#27ae60'};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 1000;
    `;
    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 3000);
  }
};

// expose small API used by inline event handlers in templates
window.app = app;

export default app;

// Auto-initialize
app.init();
