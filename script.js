// Game configuration
const BOARD_SIZE = 6;
const TARGET_WORDS = ['WILL', 'YOU', 'BE', 'MY', 'VALENTINE', 'KATIE'];
const GAME_DURATION = 60; // 60 seconds

// Points based on word length
const POINTS = {
    2: 100,
    3: 200,
    4: 400,
    5: 800,
    6: 1400,
    7: 1800,
    8: 2200,
    9: 2600
};

// Game state
let board = [];
let selectedTiles = [];
let foundWords = new Map(); // Changed to Map to store word and points
let isSelecting = false;
let startTime = Date.now();
let timerInterval;
let gameOver = false;
let totalScore = 0;

// Dictionary will be loaded from JSON
let DICTIONARY = new Set();

// Board layout - carefully crafted to contain all target words
const predefinedBoard = [
    ['K', 'A', 'T', 'I', 'E', 'W'],
    ['V', 'B', 'U', 'O', 'M', 'I'],
    ['A', 'E', 'U', 'R', 'Y', 'L'],
    ['L', 'W', 'I', 'L', 'L', 'T'],
    ['E', 'N', 'T', 'I', 'N', 'E'],
    ['N', 'Q', 'X', 'Z', 'P', 'S']
];

// Word positions in the board (row, col, direction)
const wordPositions = {
    'KATIE': [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
    'WILL': [[0, 5], [1, 5], [2, 5], [3, 5]],
    'VALENTINE': [[1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5]],
    'BE': [[1, 1], [2, 1]],
    'YOU': [[1, 2], [1, 3], [2, 4]],
    'MY': [[1, 4], [2, 4]]
};

// Load dictionary from JSON
async function loadDictionary() {
    try {
        const response = await fetch('en-2021.json');
        const data = await response.json();
        
        // The dictionary is organized by first letter
        // Flatten all words into a Set
        Object.values(data).forEach(wordArray => {
            wordArray.forEach(word => {
                DICTIONARY.add(word.toUpperCase());
            });
        });
        
        // Ensure our target words are included
        TARGET_WORDS.forEach(word => {
            DICTIONARY.add(word);
        });
        
        console.log(`Dictionary loaded: ${DICTIONARY.size} words`);
    } catch (error) {
        console.error('Error loading dictionary:', error);
        // Fallback to basic dictionary with target words
        TARGET_WORDS.forEach(word => DICTIONARY.add(word));
    }
}

// Initialize the game
async function initGame() {
    // Load dictionary first
    await loadDictionary();
    
    board = predefinedBoard.map(row => [...row]);
    createBoard();
    setupCanvas();
    setupEventListeners();
    startTimer();
    
    // Setup skip button
    document.getElementById('skip-btn').addEventListener('click', () => {
        if (!gameOver) {
            endGame();
        }
    });
}

// Create the board HTML
function createBoard() {
    const boardElement = document.getElementById('board');
    boardElement.innerHTML = '';
    
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.textContent = board[row][col];
            tile.dataset.row = row;
            tile.dataset.col = col;
            tile.dataset.index = row * BOARD_SIZE + col;
            boardElement.appendChild(tile);
        }
    }
}

// Setup canvas for drawing selection lines
function setupCanvas() {
    const canvas = document.getElementById('selection-canvas');
    const boardElement = document.getElementById('board');
    const rect = boardElement.getBoundingClientRect();
    const wrapper = boardElement.parentElement;
    const wrapperRect = wrapper.getBoundingClientRect();
    
    canvas.width = rect.width;
    canvas.height = rect.height;
}

// Setup event listeners
function setupEventListeners() {
    const tiles = document.querySelectorAll('.tile');
    const boardElement = document.getElementById('board');
    
    // Mouse events
    tiles.forEach(tile => {
        tile.addEventListener('mousedown', handleTileStart);
        tile.addEventListener('mouseenter', handleTileEnter);
        tile.addEventListener('mouseup', handleTileEnd);
    });
    
    document.addEventListener('mouseup', handleTileEnd);
    
    // Touch events
    tiles.forEach(tile => {
        tile.addEventListener('touchstart', handleTouchStart, { passive: false });
    });
    
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTileEnd);
    
    // Resize handler
    window.addEventListener('resize', setupCanvas);
}

// Handle tile selection start
function handleTileStart(e) {
    e.preventDefault();
    isSelecting = true;
    selectedTiles = [];
    clearCanvas();
    
    const tile = e.currentTarget;
    selectTile(tile);
}

// Handle tile enter during selection
function handleTileEnter(e) {
    if (!isSelecting) return;
    
    const tile = e.currentTarget;
    const tileIndex = parseInt(tile.dataset.index);
    
    // Check if tile is adjacent to last selected tile
    if (selectedTiles.length > 0) {
        const lastTile = selectedTiles[selectedTiles.length - 1];
        const lastIndex = parseInt(lastTile.dataset.index);
        
        if (isAdjacent(lastIndex, tileIndex) && !selectedTiles.includes(tile)) {
            selectTile(tile);
        }
    }
}

// Handle touch start
function handleTouchStart(e) {
    e.preventDefault();
    isSelecting = true;
    selectedTiles = [];
    clearCanvas();
    
    const tile = e.currentTarget;
    selectTile(tile);
}

// Handle touch move
function handleTouchMove(e) {
    e.preventDefault();
    if (!isSelecting) return;
    
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (element && element.classList.contains('tile')) {
        const tileIndex = parseInt(element.dataset.index);
        
        if (selectedTiles.length > 0) {
            const lastTile = selectedTiles[selectedTiles.length - 1];
            const lastIndex = parseInt(lastTile.dataset.index);
            
            if (isAdjacent(lastIndex, tileIndex) && !selectedTiles.includes(element)) {
                selectTile(element);
            }
        }
    }
}

// Handle selection end
function handleTileEnd(e) {
    if (!isSelecting) return;
    
    isSelecting = false;
    checkWord();
    clearSelection();
}

// Select a tile
function selectTile(tile) {
    if (!selectedTiles.includes(tile)) {
        selectedTiles.push(tile);
        tile.classList.add('selected');
        drawSelectionLine();
    }
}

// Check if two tiles are adjacent (including diagonals)
function isAdjacent(index1, index2) {
    const row1 = Math.floor(index1 / BOARD_SIZE);
    const col1 = index1 % BOARD_SIZE;
    const row2 = Math.floor(index2 / BOARD_SIZE);
    const col2 = index2 % BOARD_SIZE;
    
    const rowDiff = Math.abs(row1 - row2);
    const colDiff = Math.abs(col1 - col2);
    
    return rowDiff <= 1 && colDiff <= 1 && (rowDiff > 0 || colDiff > 0);
}

// Draw selection line on canvas
function drawSelectionLine() {
    const canvas = document.getElementById('selection-canvas');
    const ctx = canvas.getContext('2d');
    const boardElement = document.getElementById('board');
    
    clearCanvas();
    
    if (selectedTiles.length < 2) return;
    
    ctx.strokeStyle = '#ff6b9d';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(255, 107, 157, 0.5)';
    ctx.shadowBlur = 10;
    
    ctx.beginPath();
    
    selectedTiles.forEach((tile, index) => {
        const rect = tile.getBoundingClientRect();
        const boardRect = boardElement.getBoundingClientRect();
        const x = rect.left - boardRect.left + rect.width / 2;
        const y = rect.top - boardRect.top + rect.height / 2;
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
}

// Clear canvas
function clearCanvas() {
    const canvas = document.getElementById('selection-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Clear selection
function clearSelection() {
    selectedTiles.forEach(tile => {
        tile.classList.remove('selected');
    });
    selectedTiles = [];
    clearCanvas();
}

// End game
function endGame() {
    gameOver = true;
    clearInterval(timerInterval);
    isSelecting = false;
    
    // Show end game animation
    showEndGameAnimation();
}

// Check if selected tiles form a valid word
function checkWord() {
    if (selectedTiles.length < 2) return;
    
    const word = selectedTiles.map(tile => tile.textContent).join('');
    const reverseWord = word.split('').reverse().join('');
    
    // Check if word or reverse word is in dictionary
    if (DICTIONARY.has(word) && !foundWords.has(word)) {
        foundWord(word);
    } else if (DICTIONARY.has(reverseWord) && !foundWords.has(reverseWord)) {
        foundWord(reverseWord);
    }
}

// Handle found word
function foundWord(word) {
    if (gameOver) return;
    
    // Calculate points
    const wordLength = word.length;
    const points = POINTS[Math.min(wordLength, 9)] || 2600;
    
    foundWords.set(word, points);
    totalScore += points;
    
    // Show popup
    showWordPopup(word, points);
    
    // Update score
    updateScore();
}

// Show word found popup
function showWordPopup(word, points) {
    const popup = document.createElement('div');
    popup.className = 'word-popup';
    popup.innerHTML = `
        <div class="word-popup-word">${word}</div>
        <div class="word-popup-points">+${points}</div>
    `;
    document.body.appendChild(popup);
    
    // Remove popup after animation
    setTimeout(() => {
        popup.remove();
    }, 2000);
}

// Update score
function updateScore() {
    document.getElementById('words-count').textContent = foundWords.size;
    document.getElementById('score-display').textContent = totalScore;
}

// Start timer
function startTimer() {
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, GAME_DURATION - elapsed);
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        document.getElementById('timer').textContent = 
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (remaining === 0 && !gameOver) {
            endGame();
        }
    }, 100);
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', initGame);

// Show end game animation
function showEndGameAnimation() {
    const overlay = document.createElement('div');
    overlay.className = 'end-game-overlay';
    
    // Build words found list - sorted by points (highest first)
    let wordsListHTML = '';
    const sortedWords = Array.from(foundWords.entries())
        .sort((a, b) => b[1] - a[1]); // Sort by points descending
    
    sortedWords.forEach(([word, points]) => {
        wordsListHTML += `
            <div class="word-item">
                <span class="word-item-word">${word}</span>
                <span class="word-item-points">+${points}</span>
            </div>
        `;
    });
    
    overlay.innerHTML = `
        <div class="end-game-content">
            <div class="end-game-score">Final Score: ${totalScore}</div>
            <div class="words-found-list">
                <h3>Words Found (${foundWords.size})</h3>
                <div class="words-scroll-container">
                    ${wordsListHTML || '<div style="color: rgba(255,255,255,0.5);">No words found</div>'}
                </div>
            </div>
            <div class="end-game-message" id="end-message"></div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    // Fix mobile scrolling - prevent overlay scroll when touching words list
    const wordsScrollContainer = document.querySelector('.words-scroll-container');
    if (wordsScrollContainer) {
        let touchStartY = 0;
        
        wordsScrollContainer.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        wordsScrollContainer.addEventListener('touchmove', (e) => {
            const scrollTop = wordsScrollContainer.scrollTop;
            const scrollHeight = wordsScrollContainer.scrollHeight;
            const clientHeight = wordsScrollContainer.clientHeight;
            const touchY = e.touches[0].clientY;
            const deltaY = touchY - touchStartY;
            
            // Check if we're at the top/bottom of the scroll container
            const atTop = scrollTop === 0 && deltaY > 0;
            const atBottom = scrollTop + clientHeight >= scrollHeight && deltaY < 0;
            
            // If scrolling within bounds, prevent overlay from scrolling
            if (!atTop && !atBottom) {
                e.stopPropagation();
            }
        }, { passive: false });
    }
    
    // Animate the message
    setTimeout(() => {
        animateMessage();
    }, 500);
}

// Animate the final message
function animateMessage() {
    const messageEl = document.getElementById('end-message');
    const words = ['WILL', 'YOU', 'BE', 'MY', 'VALENTINE', 'KATIE'];
    let html = '';
    
    words.forEach((word, index) => {
        const found = foundWords.has(word);
        const className = found ? 'message-word found-word-msg' : 'message-word missing-word-msg';
        const delay = index * 0.3;
        html += `<span class="${className}" style="animation-delay: ${delay}s">${word}</span> `;
    });
    
    messageEl.innerHTML = html;
    
    // Add final question after animation
    setTimeout(() => {
        const question = document.createElement('div');
        question.className = 'final-question';
        question.innerHTML = 'Will you be my valentine, Katie?';
        messageEl.appendChild(question);
        
        // Add Yes/No buttons after the question
        setTimeout(() => {
            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'answer-buttons';
            buttonsDiv.innerHTML = `
                <button id="yes-btn" class="answer-btn yes-btn">Yes!</button>
                <button id="no-btn" class="answer-btn no-btn">No</button>
            `;
            messageEl.appendChild(buttonsDiv);
            
            // Setup button handlers
            document.getElementById('yes-btn').addEventListener('click', handleYes);
            document.getElementById('no-btn').addEventListener('click', handleNo);
        }, 500);
    }, words.length * 300 + 1000);
}

// Handle "Yes" response
function handleYes() {
    const messageEl = document.getElementById('end-message');
    messageEl.innerHTML = `
        <div class="celebration">
            <div class="celebration-text">Let's go!!!</div>
            <div class="celebration-subtext">can't wait to see you in boston :)</div>
        </div>
    `;
    
    // Create flower/confetti animation
    createFlowerAnimation();
}

// Handle "No" response
function handleNo() {
    const noBtn = document.getElementById('no-btn');
    
    if (!noBtn.dataset.clicks) {
        noBtn.dataset.clicks = 0;
    }
    
    let clicks = parseInt(noBtn.dataset.clicks);
    
    if (clicks === 0) {
        // First click - change button text
        noBtn.textContent = 'are u sure...';
        noBtn.dataset.clicks = 1;
    } else {
        // Second click - show "fk." message
        const messageEl = document.getElementById('end-message');
        messageEl.innerHTML = `
            <div class="celebration">
                <div class="fk-message">fk.</div>
                <button class="retry-btn" onclick="location.reload()">Play Again?</button>
            </div>
        `;
    }
}

// Create flower/confetti animation
function createFlowerAnimation() {
    const colors = ['#ff6b9d', '#ffc0cb', '#ff1493', '#ff69b4', '#ffb6c1'];
    const emojis = ['🌸', '🌺', '🌹', '💐', '🌷', '💕', '💖', '✨', '🎉'];
    
    // Create 50 floating elements
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const element = document.createElement('div');
            element.className = 'flower-confetti';
            
            // Random emoji or heart shape
            if (Math.random() > 0.5) {
                element.textContent = emojis[Math.floor(Math.random() * emojis.length)];
                element.style.fontSize = `${Math.random() * 20 + 20}px`;
            } else {
                element.style.width = `${Math.random() * 10 + 5}px`;
                element.style.height = `${Math.random() * 10 + 5}px`;
                element.style.background = colors[Math.floor(Math.random() * colors.length)];
                element.style.borderRadius = '50%';
            }
            
            element.style.left = `${Math.random() * 100}%`;
            element.style.animationDuration = `${Math.random() * 3 + 2}s`;
            element.style.animationDelay = `${Math.random() * 0.5}s`;
            
            document.body.appendChild(element);
            
            // Remove after animation
            setTimeout(() => element.remove(), 5000);
        }, i * 50);
    }
}
