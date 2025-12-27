import { setAllWords, getAllWords, setCurrentReview, getCurrentReview, setCurrentPage, getCurrentPage, setIsRevealed, getIsRevealed } from './srs/memoryState.js';
import { selectRandomReview, checkAnswer, calculateStats, calculateNextState, adjustBrightness } from './srs/scheduler.js';
import { renderInputPage } from './ui/input.js';
import { renderReviewPage } from './ui/review.js';
import { renderProgressPage } from './ui/dashboard.js';
import { saveData, loadData } from './storage/localStore.js';

// Welcome page layout
const defaultConfig = {
  main_headline: "Learn vocabulary with real memory.",
  description_text: "Master any language pair with a scientific approach. Words are tested in both directions, and review timing adapts based on your true memory strength.",
  cta_button_text: "Start Learning",
  language_a_label: "Language A",
  language_b_label: "Language B"
};

const appRoot = document.getElementById('app');

// Main app controller
const app = {
  // Initialize the variables
  allWords: [],
  currentReview: null,
  currentPage: 'landing',
  isRevealed: false,

  // Initialize the app, set up dataSdk and elementSdk, fetch user data and render the page
  async init() {
    // Expose this app globally
    window.app = this;

    // Create a new dataSdk object if there's not one
    if (!window.dataSdk) {
      console.warn('dataSdk not found — creating Supabase-backed dataSdk (with local fallback)');
      window.dataSdk = {
        _data: [],
        _handler: null,

        // Initialize: fetch current user's rows from Supabase (if signed in) and notify handler
        init: async (handler) => {
          window.dataSdk._handler = handler;
          const supabase = window.supabase;
          if (!supabase) {
            // fallback to empty local dataset
            handler.onDataChanged(window.dataSdk._data);
            return { isOk: true };
          }
          // Fetch user's words data from Supabase, map it to the app's format and update local cache
          try {
            // Check if the user is authorized
            const sessionRes = await supabase.auth.getSession();
            const session = sessionRes?.data?.session;
            // If not, only return the local data
            if (!session) {
              handler.onDataChanged(window.dataSdk._data);
              return { isOk: true };
            }
            // if so, return all the words that created with this user in the word table in Supabase
            const { data, error } = await supabase.from('words').select('*').order('created_at', { ascending: true });
            if (error) return { isOk: false, error };

            // Map DB rows to the app's expected shape
            window.dataSdk._data = (data || []).map(r => ({
              __backendId: r.id,
              id: r.id,
              languageA: r.lang_a,
              wordA: r.word_a,
              languageB: r.lang_b,
              wordB: r.word_b,
              createdAt: r.created_at,
              // SRS fields: from the server-side
              nextReviewDate: r.next_review ? new Date(r.next_review).getTime() : Date.now(),
              lastReviewed: r.last_reviewed ? new Date(r.last_reviewed).getTime() : 0,
              ease: r.ease ?? 2.5,
              // SRS fields: default values kept client-side
              intervalDays: 1,
              masteryLevel: 0,
              correctCount: 0,
              // AI-related fields (currently not used in the app, reserved for future)
              level: r.level,
              category: r.category,
              style: r.style,
              ai_confidence: r.ai_confidence,
            }));

            handler.onDataChanged(window.dataSdk._data);
            return { isOk: true };
          } catch (e) {
            console.error('dataSdk.init error', e);
            handler.onDataChanged(window.dataSdk._data);
            return { isOk: false, error: e };
          }
        },

        // Create a new row in Supabase (requires authenticated session). Map UI -> DB.
        create: async (obj) => {
          // Access the Supabase client to interact with the backend database
          const supabase = window.supabase;
          // Fallback: Supabase not available, save the object locally and update the handler
          if (!supabase) {
            obj.__backendId = obj.id;
            window.dataSdk._data.push(obj);
            window.dataSdk._handler?.onDataChanged(window.dataSdk._data);
            return { isOk: true };
          }
          try {
            const sessionRes = await supabase.auth.getSession();
            const session = sessionRes?.data?.session;
            if (!session) return { isOk: false, error: 'not authenticated' };

            const payload = {
              user_id: session.user.id,
              lang_a: obj.languageA,
              word_a: obj.wordA,
              lang_b: obj.languageB,
              word_b: obj.wordB,

              // SRS field
              next_review: new Date(obj.nextReviewDate).toISOString(),
              last_reviewed: obj.lastReviewed ? new Date(obj.lastReviewed).toISOString() : null,
              ease: obj.ease,

              // AI field
              level: obj.level,
              category: obj.category,
              style: obj.style,
              ai_confidence: obj.ai_confidence
            };

            // Insert a new word record into the 'words' table and return the inserted row
            const insertRes = await supabase.from('words').insert(payload).select().single();
            // Fallback: return the error
            if (insertRes.error) return { isOk: false, error: insertRes.error };
            const row = insertRes.data;
            // The data structure of the front-end
            const mapped = {
              __backendId: row.id,
              id: row.id,
              languageA: row.lang_a,
              wordA: row.word_a,
              languageB: row.lang_b,
              wordB: row.word_b,
              createdAt: row.created_at,
              nextReviewDate: obj.nextReviewDate || Date.now(),
              intervalDays: obj.intervalDays || 1,
              masteryLevel: obj.masteryLevel || 0,
              correctCount: obj.correctCount || 0,
              lastReviewed: obj.lastReviewed || 0
            };

            // Update front-end memory data
            window.dataSdk._data.push(mapped);
            window.dataSdk._handler?.onDataChanged(window.dataSdk._data);
            return { isOk: true };
          } catch (e) {
            console.error('dataSdk.create error', e);
            return { isOk: false, error: e };
          }
        },

        // Update an existing row by DB id (uuid)
        update: async (obj) => {
          // Access the Supabase client to interact with the backend database
          const supabase = window.supabase;
          if (!supabase) {
            window.dataSdk._data = window.dataSdk._data.map(w => w.__backendId === obj.__backendId ? obj : w);
            window.dataSdk._handler?.onDataChanged(window.dataSdk._data);
            return { isOk: true };
          }
          if (!obj.__backendId) return { isOk: false, error: 'missing backend id' };
          // Update an existing word record in Supabase and synchronize the local cache
          try {
            const sessionRes = await supabase.auth.getSession();
            const session = sessionRes?.data?.session;
            if (!session) return { isOk: false, error: 'not authenticated' };

            const payload = {
              // Only writable DB columns are language/word columns and the review data; other client fields remain local
              lang_a: obj.languageA,
              word_a: obj.wordA,
              lang_b: obj.languageB,
              word_b: obj.wordB,

              next_review: new Date(obj.nextReviewDate).toISOString(),
              last_reviewed: obj.lastReviewed ? new Date(obj.lastReviewed).toISOString() : null,
              ease: obj.ease
            };

            // Synchronize the data modified on the front end to the database.
            const updateRes = await supabase.from('words').update(payload).eq('id', obj.__backendId).select().single();
            if (updateRes.error) return { isOk: false, error: updateRes.error };
            const row = updateRes.data;

            // update local copy
            window.dataSdk._data = window.dataSdk._data.map(w => w.__backendId === obj.__backendId ? {
              ...w,

              languageA: row.lang_a,
              wordA: row.word_a,
              languageB: row.lang_b,
              wordB: row.word_b,
              createdAt: row.created_at,

              nextReviewDate: obj.nextReviewDate,
              intervalDays: obj.intervalDays,
              masteryLevel: obj.masteryLevel,
              correctCount: obj.correctCount,
              lastReviewed: obj.lastReviewed
            } : w);

            window.dataSdk._handler?.onDataChanged(window.dataSdk._data);
            return { isOk: true };
          } catch (e) {
            console.error('dataSdk.update error', e);
            return { isOk: false, error: e };
          }
        },

        // Delete a row by DB id (uuid)
        delete: async (obj) => {
          // Access the Supabase client to interact with the backend database
          const supabase = window.supabase;
          if (!supabase) {
            window.dataSdk._data = window.dataSdk._data.filter(w => w.__backendId !== obj.__backendId);
            window.dataSdk._handler?.onDataChanged(window.dataSdk._data);
            return { isOk: true };
          }
          if (!obj.__backendId) return { isOk: false, error: 'missing backend id' };
          // delete a word from Supabase and update the local cache if successful
          try {
            const sessionRes = await supabase.auth.getSession();
            const session = sessionRes?.data?.session;
            if (!session) return { isOk: false, error: 'not authenticated' };

            const deleteRes = await supabase.from('words').delete().eq('id', obj.__backendId).select();
            if (deleteRes.error) return { isOk: false, error: deleteRes.error };

            window.dataSdk._data = window.dataSdk._data.filter(w => w.__backendId !== obj.__backendId);
            window.dataSdk._handler?.onDataChanged(window.dataSdk._data);
            return { isOk: true };
          } catch (e) {
            console.error('dataSdk.delete error', e);
            return { isOk: false, error: e };
          }
        }
      };
    }
    // If elementSdk is not found, create a local fallback to allow UI initialization
    if (!window.elementSdk) {
      console.warn('elementSdk not found — creating local fallback');
      window.elementSdk = window.elementSdk || { init: async () => ({}), setConfig: () => {}, config: defaultConfig };
    }
    // Handle whenever the data changes, sorts words by creation date and re-renders the page
    const dataHandler = {
      onDataChanged: (data) => {
        this.allWords = data.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        this.render();
      }
    };

    // Initialize DataSdk
    const initResult = await window.dataSdk.init(dataHandler);
    if (!initResult.isOk) console.error('Failed to initialize data SDK');

    // Initialize elementSdk
    await window.elementSdk.init({
      defaultConfig,
      onConfigChange: async (config) => { this.render(); },
      mapToCapabilities: (config) => ({})
    });

    this.render();
  },

  // Render the UI based on the current page and elementSdk configuration
  render() {
    const config = window.elementSdk?.config || defaultConfig;
    const bgColor = config.background_color || '#fafafa';
    const cardColor = config.card_color || '#ffffff';
    const textColor = config.text_color || '#2c3e50';
    const primaryColor = config.primary_color || '#3498db';
    const secondaryColor = config.secondary_color || '#5a6c7d';
    const fontFamily = config.font_family || 'Inter';
    const fontSize = config.font_size || 16;

    // Set the page style
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

    // Render the page content
    if (this.currentPage === 'landing') {
      appRoot.innerHTML = `
        <div class="landing-page">
          <h1>${config.main_headline || defaultConfig.main_headline}</h1>
          <p>${config.description_text || defaultConfig.description_text}</p>
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
            <button class="nav-button" onclick="window.app.signOut()">Sign Out</button>
          </div>
        </div>
        ${content}
      `;
    }
  },

  // Words adding handler
  async addWord(event) {
    event.preventDefault();
    // Check the word limit
    if (this.allWords.length >= 999) {
      this.showInlineMessage('Maximum limit of 999 words reached. Please delete some words first.', 'error');
      return;
    }
    // Get the user input
    const langA = document.getElementById('langA').value.trim();
    const wordA = document.getElementById('wordA').value.trim();
    const langB = document.getElementById('langB').value.trim();
    const wordB = document.getElementById('wordB').value.trim();
    const addBtn = document.getElementById('addBtn');
    // Disable the button and show loading
    addBtn.disabled = true;
    addBtn.textContent = 'Adding...';
    // Save the data
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
    // Show different UI base on the different results
    if (result.isOk) {
      document.getElementById('wordA').value = '';
      document.getElementById('wordB').value = '';
      document.getElementById('wordA').focus();
    } else {
      console.error('Add word failed:', result.error);
      const errMsg = result.error?.message || result.error || 'Failed to add word. Please try again.';
      this.showInlineMessage(`Failed to add word: ${typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg)}`, 'error');
    }
    addBtn.disabled = false;
    addBtn.textContent = 'Add Word Pair';
  },

  // Words deleting handler
  async deleteWord(backendId) {
    // Find the words that the user wants to delete
    const wordToDelete = this.allWords.find(w => w.__backendId === backendId);
    if (!wordToDelete) return;
    // Save the data
    const result = await window.dataSdk.delete(wordToDelete);
    if (!result.isOk) {
      console.error('Delete word failed:', result.error);
      const errMsg = result.error?.message || result.error || 'Failed to delete word. Please try again.';
      this.showInlineMessage(`Failed to delete word: ${typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg)}`, 'error');
    }
  },

  // Get the words that need to be reviewed
  getDueWords() {
    const now = Date.now();
    return this.allWords.filter(word => word.nextReviewDate <= now);
  },

  // Mark the words that need to be reviewed
  setCurrentReview(review) {
    this.currentReview = review;
  },

  // Get the words that are reviewing currently
  getCurrentReview() {
    return this.currentReview;
  },

  // Set whether the current review answer is revealed
  setIsRevealed(val) {
    this.isRevealed = val;
  },

  // Get the current state of answer visibility
  getIsRevealed() {
    return this.isRevealed;
  },

  setCurrentPage(page) {
    this.currentPage = page;
  },

  // Navigate to a different page
  navigateTo(page) {
    this.currentPage = page;
    if (page === 'review') {
      this.currentReview = null;
      this.isRevealed = false;
    }
    this.render();
  },

  // Reveal the correct answer and generate the automatic feedback
  revealAnswer() {
    this.isRevealed = true;
    const userAnswer = document.getElementById('answerInput')?.value || '';
    const correctAnswer = this.currentReview.correctAnswer;
    const feedback = checkAnswer(userAnswer, correctAnswer);
    this.currentReview.autoFeedback = feedback;
    this.currentReview.userAnswer = userAnswer;
    this.render();
  },

  // Submit user's feedback for the words
  async submitFeedback(feedback) {
    const word = this.currentReview.word;
    const updatedWord = calculateNextState(word, feedback);
    const result = await window.dataSdk.update(updatedWord);
    if (result.isOk) {
      this.currentReview = null;
      this.isRevealed = false;
      this.render();
    } else {
      console.error('Update word failed:', result.error);
      const errMsg = result.error?.message || result.error || 'Failed to save feedback. Please try again.';
      this.showInlineMessage(`Failed to save feedback: ${typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg)}`, 'error');
    }
  },

  // Calculate the memory state
  calculateStats() {
    const recognition = this.allWords.filter(w => w.masteryLevel < 0.7).length;
    const comprehension = this.allWords.filter(w => w.masteryLevel >= 0.7 && w.masteryLevel < 1.5).length;
    const active = this.allWords.filter(w => w.masteryLevel >= 1.5).length;
    return { recognition, comprehension, active };
  },

  // Show the inline message
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
  },

  // Allow user to sign out their account
  async signOut() {
    const ok = window.confirm('Are you sure you want to sign out?');
    if (!ok) return;
    try {
      if (window.supabase && window.supabase.auth && typeof window.supabase.auth.signOut === 'function') {
        await window.supabase.auth.signOut();
      }
    } catch (e) {
      console.error('Sign out failed', e);
    }
    // Ensure UI returns to login screen
    const loginScreen = document.getElementById('login-screen');
    const appRootEl = document.getElementById('app');
    if (loginScreen) loginScreen.style.display = '';
    if (appRootEl) appRootEl.style.display = 'none';
    // reset app page state
    this.currentPage = 'landing';
    this.currentReview = null;
  }
};

// expose small API used by inline event handlers in templates
window.app = app;

export default app;

// Auto-initialize
app.init();
