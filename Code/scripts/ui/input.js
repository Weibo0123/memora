export function renderInputPage(config, allWords) {
  const langALabel = config.language_a_label || 'Language A';
  const langBLabel = config.language_b_label || 'Language B';

  const wordListHTML = allWords.length === 0
    ? '<div class="empty-state">No words added yet. Start by adding your first word pair above.</div>'
    : allWords.map(word => `
        <div class="word-item">
          <div class="word-pair">
            <div class="word-pair-text">${escapeHtml(word.wordA)} ↔ ${escapeHtml(word.wordB)}</div>
            <div class="word-pair-lang">${escapeHtml(word.languageA)} / ${escapeHtml(word.languageB)}</div>
          </div>
          <button class="delete-button" onclick="window.app.deleteWord('${word.__backendId}')">Delete</button>
        </div>
      `).join('');

  return `
    <div class="input-page">
      <div class="page-header">
        <h2>Add Vocabulary</h2>
        <p>Enter word pairs in any two languages. Each pair will be tested in both directions.</p>
      </div>
      <form class="input-form" onsubmit="window.app.addWord(event)">
        <div class="form-group">
          <label for="langA">${langALabel}</label>
          <input type="text" id="langA" placeholder="e.g., English" required>
        </div>
        <div class="form-group">
          <label for="wordA">Word in ${langALabel}</label>
          <input type="text" id="wordA" placeholder="e.g., house" required>
        </div>
        <div class="form-group">
          <label for="langB">${langBLabel}</label>
          <input type="text" id="langB" placeholder="e.g., Spanish" required>
        </div>
        <div class="form-group">
          <label for="wordB">Word in ${langBLabel}</label>
          <input type="text" id="wordB" placeholder="e.g., casa" required>
        </div>
        <button type="submit" class="add-button" id="addBtn">Add Word Pair</button>
      </form>
      <div class="word-list">
        ${wordListHTML}
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
