export let allWords = [];
export let currentReview = null;
export let currentPage = 'landing';
export let isRevealed = false;

export function setAllWords(data) {
  allWords = data.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getAllWords() {
  return allWords;
}

export function setCurrentReview(review) {
  currentReview = review;
}

export function getCurrentReview() {
  return currentReview;
}

export function setCurrentPage(page) {
  currentPage = page;
}

export function getCurrentPage() {
  return currentPage;
}

export function setIsRevealed(val) {
  isRevealed = val;
}

export function getIsRevealed() {
  return isRevealed;
}

export function getDueWords() {
  const now = Date.now();
  return allWords.filter(word => word.nextReviewDate <= now);
}
