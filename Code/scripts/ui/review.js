import { selectRandomReview, checkAnswer } from '../srs/scheduler.js';

export function renderReviewPage(config, currentReview, isRevealed) {
  const dueWords = window.app.getDueWords();
  if (dueWords.length === 0) {
    return `
      <div class="review-page">
        <div class="no-reviews">
          <h2>No reviews due</h2>
          <p>All words are scheduled for future review. Come back later or add more words.</p>
          <button class="cta-button" onclick="window.app.navigateTo('input')" style="margin-top: 24px;">Add More Words</button>
        </div>
      </div>
    `;
  }

  let review = currentReview;
  if (!review) {
    review = selectRandomReview(dueWords);
    window.app.setCurrentReview(review);
    window.app.setIsRevealed(false);
  }

  const { word, promptLang, promptWord, correctAnswer } = review;

  if (!isRevealed) {
    return `
      <div class="review-page">
        <div class="review-card">
          <div class="review-prompt">Translate from ${promptLang}</div>
          <div class="review-word">${escapeHtml(promptWord)}</div>
          <input type="text" class="answer-input" id="answerInput" placeholder="Type your answer..." autocomplete="new-password" autocapitalize="off" spellcheck="false" inputmode="text" autofocus>
          <button class="reveal-button" onclick="window.app.revealAnswer()">Check Answer</button>
        </div>
      </div>
    `;
  } else {
    const autoFeedback = review.autoFeedback;
    const userAnswer = review.userAnswer;
    let resultClass = '';
    let resultText = '';
    if (autoFeedback === 'instant') {
      resultClass = 'correct';
      resultText = '✓ Correct! Perfect match.';
    } else if (autoFeedback === 'hesitant') {
      resultClass = 'close';
      resultText = '~ Close! Minor differences detected.';
    } else {
      resultClass = 'wrong';
      resultText = '✗ Incorrect. Review the correct answer.';
    }

    return `
      <div class="review-page">
        <div class="review-card">
          <div class="review-prompt">Translate from ${promptLang}</div>
          <div class="review-word">${escapeHtml(promptWord)}</div>
          <div class="answer-revealed">
            <div class="auto-check-result ${resultClass}">
              ${resultText}
            </div>
            <div class="answer-comparison">
              <div class="answer-row">
                <div class="answer-label">Your Answer</div>
                <div class="answer-text">${escapeHtml(userAnswer) || '(no answer)'}</div>
              </div>
              <div class="answer-row">
                <div class="answer-label">Correct Answer</div>
                <div class="answer-text">${escapeHtml(correctAnswer)}</div>
              </div>
            </div>
            <p style="font-size: 14px; color: #5a6c7d; margin-bottom: 20px;">Rate your memory honestly (you can override the automatic check):</p>
            <div class="feedback-buttons">
              <button class="feedback-button incorrect ${autoFeedback === 'incorrect' ? 'recommended' : ''}" onclick="window.app.submitFeedback('incorrect')">
                Incorrect
              </button>
              <button class="feedback-button hesitant ${autoFeedback === 'hesitant' ? 'recommended' : ''}" onclick="window.app.submitFeedback('hesitant')">
                Correct but<br>hesitant
              </button>
              <button class="feedback-button instant ${autoFeedback === 'instant' ? 'recommended' : ''}" onclick="window.app.submitFeedback('instant')">
                Instantly<br>recalled
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
