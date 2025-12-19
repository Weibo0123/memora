export function renderProgressPage(allWords) {
  const stats = window.app.calculateStats();

  return `
    <div class="progress-page">
      <div class="page-header">
        <h2>Learning Progress</h2>
        <p>Your current knowledge distribution based on memory stability</p>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.recognition}</div>
          <div class="stat-label">Recognition</div>
          <div class="stat-description">Recently learned, needs frequent review</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.comprehension}</div>
          <div class="stat-label">Comprehension</div>
          <div class="stat-description">Moderately stable, periodic review</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.active}</div>
          <div class="stat-label">Active</div>
          <div class="stat-description">Highly stable, infrequent review</div>
        </div>
      </div>
      <div class="explanation-section">
        <h3>Spaced Repetition System</h3>
        <div class="mastery-levels">
          <div class="mastery-item">
            <div class="mastery-icon hesitant">!</div>
            <div class="mastery-content">
              <h4>Correct but hesitant</h4>
              <p>Review interval increases slightly. The word needs more reinforcement before longer gaps.</p>
            </div>
          </div>
          <div class="mastery-item">
            <div class="mastery-icon instant">✓</div>
            <div class="mastery-content">
              <h4>Instantly recalled</h4>
              <p>Review interval increases exponentially. The word is stabilizing in long-term memory.</p>
            </div>
          </div>
          <div class="mastery-item">
            <div class="mastery-icon incorrect">✗</div>
            <div class="mastery-content">
              <h4>Incorrect</h4>
              <p>Review interval resets to a short period. The word requires immediate re-learning.</p>
            </div>
          </div>
        </div>
        <p style="margin-top: 32px; color: #5a6c7d; font-size: 14px; line-height: 1.6;">
          <strong>Key principle:</strong> A word is only considered stable when recalled correctly after longer time intervals.
          Repeated correct answers without time gaps do not equal mastery.
        </p>
      </div>
    </div>
  `;
}
