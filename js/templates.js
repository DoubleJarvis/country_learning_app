const NAV = (activeMode, activeDifficulty, controllerName = null) => `
<div class="nav-container"${controllerName ? ` data-${controllerName}-target="navButtons"` : ''}>
  <a href="#stats" class="nav-item single-nav${activeMode === 'stats' ? ' active' : ''}">
    <div class="nav-label">Stats</div>
  </a>
  <div class="nav-item game-mode-nav${activeMode === 'quiz' ? ' active' : ''}">
    <div class="nav-label">Quiz</div>
    <div class="difficulty-buttons">
      <a href="#quiz" class="difficulty-btn${activeMode === 'quiz' && activeDifficulty === 'n' ? ' active' : ''}" title="Normal">N</a>
      <a href="#quiz_hard" class="difficulty-btn${activeMode === 'quiz' && activeDifficulty === 'h' ? ' active' : ''}" title="Hard">H</a>
    </div>
  </div>
  <div class="nav-item game-mode-nav${activeMode === 'borders' ? ' active' : ''}">
    <div class="nav-label">Borders</div>
    <div class="difficulty-buttons">
      <a href="#quiz_borders" class="difficulty-btn${activeMode === 'borders' && activeDifficulty === 'n' ? ' active' : ''}" title="Normal">N</a>
      <a href="#quiz_borders_hard" class="difficulty-btn${activeMode === 'borders' && activeDifficulty === 'h' ? ' active' : ''}" title="Hard">H</a>
    </div>
  </div>
  <div class="nav-item game-mode-nav${activeMode === 'name_all' ? ' active' : ''}">
    <div class="nav-label">Name All</div>
    <div class="difficulty-buttons">
      <a href="#quiz_name_all_easy" class="difficulty-btn${activeMode === 'name_all' && activeDifficulty === 'e' ? ' active' : ''}" title="Easy">E</a>
      <a href="#quiz_name_all" class="difficulty-btn${activeMode === 'name_all' && activeDifficulty === 'n' ? ' active' : ''}" title="Normal">N</a>
      <a href="#quiz_name_all_hard" class="difficulty-btn${activeMode === 'name_all' && activeDifficulty === 'h' ? ' active' : ''}" title="Hard">H</a>
    </div>
  </div>
  <div class="nav-item game-mode-nav${activeMode === 'practice' ? ' active' : ''}">
    <div class="nav-label">Practice</div>
    <div class="difficulty-buttons">
      <a href="#practice_worst" class="difficulty-btn${activeMode === 'practice' && activeDifficulty === 'w' ? ' active' : ''}" title="Worst guesses">W</a>
      <a href="#practice_slowest" class="difficulty-btn${activeMode === 'practice' && activeDifficulty === 's' ? ' active' : ''}" title="Slowest guesses">S</a>
    </div>
  </div>
</div>`;

const REGION_SELECTION = (controllerName, mode, difficulty, description = '') => `
<div class="region-selection" data-${controllerName}-target="regionSelection">
  <div class="region-header">
    <h1>${mode}</h1>
    <div class="region-difficulty ${difficulty.toLowerCase()}">${difficulty}</div>
  </div>
  ${description ? `<p class="region-description">${description}</p>` : ''}
  <h2 class="region-select-label">Select a region</h2>
  <div class="region-buttons">
    <button data-action="click->${controllerName}#selectRegion" data-region="world">Entire world</button>
    <button data-action="click->${controllerName}#selectRegion" data-region="africa">Africa</button>
    <button data-action="click->${controllerName}#selectRegion" data-region="asia">Asia</button>
    <button data-action="click->${controllerName}#selectRegion" data-region="europe">Europe</button>
    <button data-action="click->${controllerName}#selectRegion" data-region="north_america">North America</button>
    <button data-action="click->${controllerName}#selectRegion" data-region="south_america">South America</button>
    <button data-action="click->${controllerName}#selectRegion" data-region="oceania">Oceania</button>
  </div>
</div>`;

const STATS_BAR_TOP_LEFT = (controllerName, stats, buttonText, buttonAction, buttonTarget) => `
<div class="stats-bar stats-bar-top-left" data-${controllerName}-target="statsBar" style="display: none;">
  <div class="stats-group">
    ${stats.map(s => `
    <div class="stat ${s.color_class || ''}">
      <span class="stat-label">${s.label}:</span>
      <span class="stat-value" data-${controllerName}-target="${s.target}">0</span>
    </div>`).join('')}
  </div>
  <button class="action-btn"${buttonTarget ? ` data-${controllerName}-target="${buttonTarget}"` : ''} data-action="${buttonAction}">${buttonText}</button>
</div>`;

const STATS_BAR_BOTTOM = (controllerName, stats, buttonText, buttonAction, buttonTarget) => `
<div class="stats-bar stats-bar-bottom" data-${controllerName}-target="statsBar">
  <div class="stats-group">
    ${stats.map(s => `
    <div class="stat ${s.color_class || ''}">
      <span class="stat-label">${s.label}:</span>
      <span class="stat-value" data-${controllerName}-target="${s.target}">0</span>
    </div>`).join('')}
  </div>
  <button class="action-btn"${buttonTarget ? ` data-${controllerName}-target="${buttonTarget}"` : ''} data-action="${buttonAction}">${buttonText}</button>
</div>`;

// Practice mode page. Both variants share the "practice" controller; the
// source value picks which stats list (worst/slowest) fills the country pool.
const PRACTICE_PAGE = (source, navDifficulty, difficultyLabel, description) => `
<div data-controller="practice" data-practice-source-value="${source}" class="quiz-container">
  ${NAV('practice', navDifficulty, 'practice')}
  <div class="start-screen" data-practice-target="startScreen">
    <div class="region-header">
      <h1>Practice</h1>
      <div class="region-difficulty ${source}">${difficultyLabel}</div>
    </div>
    <p class="region-description">${description}</p>
    <button data-action="click->practice#startPractice" data-practice-target="startBtn" class="start-btn">Start practice</button>
  </div>
  <div class="stats-bar stats-bar-top-left practice-stats-bar" data-practice-target="statsBar" style="display: none;">
    <div class="stats-group">
      <div class="stat green">
        <span class="stat-label">Correct:</span>
        <span class="stat-value" data-practice-target="correctCount">0</span>
      </div>
      <div class="stat red">
        <span class="stat-label">Incorrect:</span>
        <span class="stat-value" data-practice-target="incorrectCount">0</span>
      </div>
    </div>
    <button class="action-btn" data-practice-target="actionBtn" data-action="click->practice#finish">Finish</button>
    <div class="last-guess" data-practice-target="lastGuess" style="display: none;">
      <span class="last-guess-label">It was:</span>
      <div class="guessed-country" data-practice-target="lastGuessCard">
        <div class="country-shape" data-practice-target="lastGuessShape"></div>
        <div class="country-name" data-practice-target="lastGuessName"></div>
      </div>
    </div>
  </div>
  <div class="finished-banner" data-practice-target="finishedBanner" style="display: none;">
    <div class="finished-content">
      <h2>Practice Complete!</h2>
      <div class="finished-time" data-practice-target="finalTime"></div>
      <div class="finished-stats">
        <div class="finished-stat green"><span class="finished-label">Correct:</span><span class="finished-value" data-practice-target="finalCorrect">0</span></div>
        <div class="finished-stat red"><span class="finished-label">Incorrect:</span><span class="finished-value" data-practice-target="finalIncorrect">0</span></div>
      </div>
      <button class="restart-btn action-btn" data-action="click->practice#restart">Restart</button>
    </div>
  </div>
  <div id="main-map" data-map-slot data-practice-target="mainContainer"></div>
  <div id="overlay-map" class="practice-overlay" data-practice-target="overlayContainer"></div>
  <div class="search-box" data-practice-target="searchBox" style="display: none;">
    <input type="text" data-practice-target="searchInput" data-action="input->practice#handleSearch keydown->practice#handleKeydown" placeholder="Enter country name..." autocomplete="off" />
    <div class="autocomplete-dropdown" data-practice-target="dropdown"></div>
    <button class="skip-btn" data-action="click->practice#skip keydown.shift+enter@window->practice#skip" title="Shift+Enter">Skip</button>
  </div>
</div>`;

export const templates = {
  quiz: () => `
<div data-controller="quiz" class="quiz-container">
  ${NAV('quiz', 'n', 'quiz')}
  ${REGION_SELECTION('quiz', 'Quiz', 'Normal', 'A country is highlighted on the map. Identify it by name.')}
  ${STATS_BAR_TOP_LEFT('quiz',
    [
      { label: 'Remaining', target: 'remainingCount' },
      { label: 'First try', target: 'greenCount', color_class: 'green' },
      { label: 'Second try', target: 'yellowCount', color_class: 'yellow' },
      { label: 'Failed', target: 'redCount', color_class: 'red' }
    ],
    'Finish', 'click->quiz#finish', 'actionBtn'
  )}
  <div class="finished-banner" data-quiz-target="finishedBanner" style="display: none;">
    <div class="finished-content">
      <h2>Game Complete!</h2>
      <div class="finished-time" data-quiz-target="finalTime"></div>
      <div class="finished-stats">
        <div class="finished-stat green"><span class="finished-label">First try:</span><span class="finished-value" data-quiz-target="finalGreen">0</span></div>
        <div class="finished-stat yellow"><span class="finished-label">Second try:</span><span class="finished-value" data-quiz-target="finalYellow">0</span></div>
        <div class="finished-stat red"><span class="finished-label">Failed:</span><span class="finished-value" data-quiz-target="finalRed">0</span></div>
      </div>
      <button class="restart-btn action-btn" data-action="click->quiz#restart">Restart</button>
    </div>
  </div>
  <div id="quiz-map" data-map-slot data-quiz-target="container"></div>
  <div class="search-box" data-quiz-target="searchBox" style="display: none;">
    <button class="recenter-btn" data-action="click->quiz#recenter" title="Re-center on current country">🎯</button>
    <input type="text" data-quiz-target="searchInput" data-action="input->quiz#handleSearch keydown->quiz#handleKeydown" placeholder="Enter country name..." autocomplete="off" />
    <div class="autocomplete-dropdown" data-quiz-target="dropdown"></div>
    <button class="skip-btn" data-action="click->quiz#skip keydown.shift+enter@window->quiz#skip" title="Shift+Enter">Skip</button>
  </div>
  <div class="debug-search-box" style="display: none;">
    <input type="text" data-quiz-target="debugSearchInput" data-action="input->quiz#handleDebugSearch keydown->quiz#handleDebugKeydown" placeholder="DEBUG: Set country to guess..." autocomplete="off" />
    <div class="autocomplete-dropdown" data-quiz-target="debugDropdown"></div>
  </div>
  <div class="debug-fill-box" style="display: none;">
    <button class="debug-fill-btn" data-action="click->quiz#debugFill">Debug: Fill</button>
  </div>
</div>`,

  quiz_hard: () => `
<div data-controller="quiz-hard" class="quiz-container">
  ${NAV('quiz', 'h', 'quiz-hard')}
  ${REGION_SELECTION('quiz-hard', 'Quiz', 'Hard', 'A country is shown without context. Identify it by name.')}
  ${STATS_BAR_TOP_LEFT('quiz-hard',
    [
      { label: 'Remaining', target: 'remainingCount' },
      { label: 'First try', target: 'greenCount', color_class: 'green' },
      { label: 'Second try', target: 'yellowCount', color_class: 'yellow' },
      { label: 'Failed', target: 'redCount', color_class: 'red' }
    ],
    'Finish', 'click->quiz-hard#finish', 'actionBtn'
  )}
  <div class="finished-banner" data-quiz-hard-target="finishedBanner" style="display: none;">
    <div class="finished-content">
      <h2>Game Complete!</h2>
      <div class="finished-time" data-quiz-hard-target="finalTime"></div>
      <div class="finished-stats">
        <div class="finished-stat green"><span class="finished-label">First try:</span><span class="finished-value" data-quiz-hard-target="finalGreen">0</span></div>
        <div class="finished-stat yellow"><span class="finished-label">Second try:</span><span class="finished-value" data-quiz-hard-target="finalYellow">0</span></div>
        <div class="finished-stat red"><span class="finished-label">Failed:</span><span class="finished-value" data-quiz-hard-target="finalRed">0</span></div>
      </div>
      <button class="restart-btn action-btn" data-action="click->quiz-hard#restart">Restart</button>
    </div>
  </div>
  <div id="main-map" data-map-slot data-quiz-hard-target="mainContainer"></div>
  <div id="overlay-map" data-quiz-hard-target="overlayContainer"></div>
  <div class="search-box" data-quiz-hard-target="searchBox" style="display: none;">
    <input type="text" data-quiz-hard-target="searchInput" data-action="input->quiz-hard#handleSearch keydown->quiz-hard#handleKeydown" placeholder="Enter country name..." autocomplete="off" />
    <div class="autocomplete-dropdown" data-quiz-hard-target="dropdown"></div>
    <button class="skip-btn" data-action="click->quiz-hard#skip keydown.shift+enter@window->quiz-hard#skip" title="Shift+Enter">Skip</button>
  </div>
  <div class="debug-search-box" style="display: none;">
    <input type="text" data-quiz-hard-target="debugSearchInput" data-action="input->quiz-hard#handleDebugSearch keydown->quiz-hard#handleDebugKeydown" placeholder="DEBUG: Set country to guess..." autocomplete="off" />
    <div class="autocomplete-dropdown" data-quiz-hard-target="debugDropdown"></div>
  </div>
  <div class="debug-fill-box" style="display: none;">
    <button class="debug-fill-btn" data-action="click->quiz-hard#debugFill">Debug: Fill</button>
    <button class="debug-fast-fill-btn" data-action="click->quiz-hard#debugFastFill">Debug: Fast Fill</button>
    <button class="debug-realistic-fill-btn" data-action="click->quiz-hard#debugRealisticFill">Debug: Fill Realistic</button>
  </div>
</div>`,

  quiz_borders: () => `
<div data-controller="quiz-borders" class="quiz-container">
  ${NAV('borders', 'n', 'quiz-borders')}
  <div class="start-screen" data-quiz-borders-target="startScreen">
    <div class="region-header">
      <h1>Borders</h1>
      <div class="region-difficulty normal">Normal</div>
    </div>
    <p class="region-description">Guess all the bordering countries of a randomly selected country.</p>
    <p class="game-rules">
      <strong>Rules:</strong><br>
      - You'll see a highlighted country and its name<br>
      - Guess all countries that share a border with it<br>
      - You have <strong>2x the number of borders</strong> as attempts<br>
      - Already guessed borders won't count against you
    </p>
    <button data-action="click->quiz-borders#startGame" class="start-btn">Start Game</button>
  </div>
  <div class="stats-bar" data-quiz-borders-target="statsBar" style="display: none; position: absolute; top: 15px; left: 15px; padding: 8px 12px; z-index: 1000;">
    <div class="country-info">
      <div class="target-country-label">Target Country:</div>
      <div class="target-country-name" data-quiz-borders-target="countryName"></div>
      <div class="borders-count">Borders: <span data-quiz-borders-target="bordersTotal">0</span></div>
    </div>
    <div class="stats-group">
      <div class="stat"><span class="stat-label">Attempts Left:</span><span class="stat-value" data-quiz-borders-target="remainingCount">0</span></div>
      <div class="stat green"><span class="stat-label">Found:</span><span class="stat-value" data-quiz-borders-target="correctCount">0</span></div>
      <div class="stat red"><span class="stat-label">Wrong:</span><span class="stat-value" data-quiz-borders-target="incorrectCount">0</span></div>
    </div>
    <button class="action-btn" data-quiz-borders-target="actionBtn" data-action="click->quiz-borders#finish">Finish</button>
  </div>
  <div class="finished-banner" data-quiz-borders-target="finishedBanner" style="display: none;">
    <div class="finished-content">
      <h2>Game Complete!</h2>
      <div class="finished-time" data-quiz-borders-target="finalTime"></div>
      <div class="finished-stats">
        <div class="finished-stat green"><span class="finished-label">Neighbours Found:</span><span class="finished-value" data-quiz-borders-target="finalCorrect">0</span></div>
        <div class="finished-stat red"><span class="finished-label">Wrong Guesses:</span><span class="finished-value" data-quiz-borders-target="finalIncorrect">0</span></div>
      </div>
      <button class="restart-btn action-btn" data-action="click->quiz-borders#restart">Play Again</button>
    </div>
  </div>
  <div id="quiz-map" data-map-slot data-quiz-borders-target="container"></div>
  <div class="search-box" data-quiz-borders-target="searchBox" style="display: none;">
    <button class="recenter-btn" data-action="click->quiz-borders#recenter" title="Re-center on target country">🎯</button>
    <input type="text" data-quiz-borders-target="searchInput" data-action="input->quiz-borders#handleSearch keydown->quiz-borders#handleKeydown" placeholder="Enter country name..." autocomplete="off" />
    <div class="autocomplete-dropdown" data-quiz-borders-target="dropdown"></div>
  </div>
</div>`,

  quiz_borders_hard: () => `
<div data-controller="quiz-borders-hard" class="quiz-container">
  ${NAV('borders', 'h', 'quiz-borders-hard')}
  ${REGION_SELECTION('quiz-borders-hard', 'Borders', 'Hard', 'Identify every country in the region by naming its neighbours. A new target country is given each time you clear all its borders.')}
  ${STATS_BAR_TOP_LEFT('quiz-borders-hard',
    [
      { label: 'Remaining', target: 'remainingCount' },
      { label: 'Found', target: 'correctCount', color_class: 'green' },
      { label: 'Mistakes', target: 'mistakesCount', color_class: 'red' }
    ],
    'Finish', 'click->quiz-borders-hard#finish', 'actionBtn'
  )}
  <div class="finish-panel">
  <div class="finished-banner" data-quiz-borders-hard-target="finishedBanner" style="display: none;">
    <div class="finished-content">
      <h2>Game Complete!</h2>
      <div class="finished-time" data-quiz-borders-hard-target="finalTime"></div>
      <div class="finished-stats">
        <div class="finished-stat green"><span class="finished-label">Countries Found:</span><span class="finished-value" data-quiz-borders-hard-target="finalCorrect">0</span></div>
        <div class="finished-stat red"><span class="finished-label">Mistakes:</span><span class="finished-value" data-quiz-borders-hard-target="finalMistakes">0</span></div>
      </div>
      <button class="restart-btn action-btn" data-action="click->quiz-borders-hard#restart">Play Again</button>
    </div>
  </div>
  <div class="missed-countries" data-quiz-borders-hard-target="missedList" style="display: none;"></div>
  </div>
  <div id="quiz-map" data-map-slot data-quiz-borders-hard-target="container"></div>
  <div class="search-box" data-quiz-borders-hard-target="searchBox" style="display: none;">
    <button class="recenter-btn" data-action="click->quiz-borders-hard#recenter" title="Re-center on target country">🎯</button>
    <input type="text" data-quiz-borders-hard-target="searchInput" data-action="input->quiz-borders-hard#handleSearch keydown->quiz-borders-hard#handleKeydown" placeholder="Enter country name..." autocomplete="off" />
    <div class="autocomplete-dropdown" data-quiz-borders-hard-target="dropdown"></div>
  </div>
</div>`,

  quiz_place: () => `
<div data-controller="quiz-place" class="quiz-container">
  ${NAV('place', 'n', 'quiz-place')}
  ${REGION_SELECTION('quiz-place', 'Place', 'Normal', 'Drag the named country to its real location on an empty world map. Drop it within its true bounds to lock it in.')}
  ${STATS_BAR_TOP_LEFT('quiz-place',
    [
      { label: 'Remaining', target: 'remainingCount' },
      { label: 'Correct', target: 'correctCount', color_class: 'green' },
      { label: 'Incorrect', target: 'incorrectCount', color_class: 'red' }
    ],
    'Finish', 'click->quiz-place#finish', 'actionBtn'
  )}
  <div class="finished-banner" data-quiz-place-target="finishedBanner" style="display: none;">
    <div class="finished-content">
      <h2>Game Complete!</h2>
      <div class="finished-time" data-quiz-place-target="finalTime"></div>
      <div class="finished-stats">
        <div class="finished-stat green"><span class="finished-label">Correct:</span><span class="finished-value" data-quiz-place-target="finalCorrect">0</span></div>
        <div class="finished-stat red"><span class="finished-label">Incorrect:</span><span class="finished-value" data-quiz-place-target="finalIncorrect">0</span></div>
      </div>
      <button class="restart-btn action-btn" data-action="click->quiz-place#restart">Restart</button>
    </div>
  </div>
  <div id="quiz-map" data-map-slot data-quiz-place-target="container"></div>
  <div class="place-tray" data-quiz-place-target="tray" style="display: none;">
    <div class="place-tray-name" data-quiz-place-target="countryName"></div>
    <div class="place-shape-slot" data-quiz-place-target="shapeSlot">
      <div class="place-shape" data-quiz-place-target="shape"
           data-action="pointerdown->quiz-place#startDrag pointermove->quiz-place#moveDrag pointerup->quiz-place#endDrag pointercancel->quiz-place#cancelDrag"></div>
    </div>
    <button class="skip-btn" data-action="click->quiz-place#skip keydown.shift+enter@window->quiz-place#skip" title="Shift+Enter">Skip</button>
  </div>
</div>`,

  quiz_name_all_easy: () => `
<div data-controller="quiz-name-all-easy" class="quiz-container">
  ${NAV('name_all', 'e', 'quiz-name-all-easy')}
  ${REGION_SELECTION('quiz-name-all-easy', 'Name All', 'Easy', 'All country outlines are shown on the map. Identify each one by name — they colour in as you guess.')}
  <div class="finish-panel">
  <div class="finished-banner" data-quiz-name-all-easy-target="finishedBanner" style="display: none;">
    <div class="finished-content">
      <h2>Game Complete!</h2>
      <div class="finished-time" data-quiz-name-all-easy-target="finalTime"></div>
      <div class="finished-stats">
        <div class="finished-stat green"><span class="finished-label">Correct:</span><span class="finished-value" data-quiz-name-all-easy-target="finalCorrect">0</span></div>
        <div class="finished-stat red"><span class="finished-label">Remaining:</span><span class="finished-value" data-quiz-name-all-easy-target="finalRemaining">0</span></div>
        <div class="finished-stat incorrect"><span class="finished-label">Incorrect:</span><span class="finished-value" data-quiz-name-all-easy-target="finalIncorrect">0</span></div>
      </div>
      <button class="restart-btn action-btn" data-action="click->quiz-name-all-easy#restart">Restart</button>
    </div>
  </div>
  <div class="guessed-countries" data-quiz-name-all-easy-target="guessedList" style="display: none;"></div>
  </div>
  <div id="quiz-map" data-map-slot data-quiz-name-all-easy-target="container"></div>
  <div class="game-ui" style="display: none;" data-quiz-name-all-easy-target="gameUI">
    <div class="search-box" data-quiz-name-all-easy-target="searchBox">
      <input type="text" data-quiz-name-all-easy-target="searchInput" data-action="input->quiz-name-all-easy#handleSearch keydown->quiz-name-all-easy#handleKeydown" placeholder="Type country name..." autocomplete="off" />
      <div class="autocomplete-dropdown" data-quiz-name-all-easy-target="dropdown"></div>
    </div>
    ${STATS_BAR_BOTTOM('quiz-name-all-easy',
      [
        { label: 'Remaining', target: 'remainingCount' },
        { label: 'Correct', target: 'correctCount', color_class: 'green' },
        { label: 'Incorrect', target: 'incorrectCount', color_class: 'red' },
        { label: 'Time', target: 'timerDisplay', color_class: 'timer' }
      ],
      'Finish', 'click->quiz-name-all-easy#finish', 'finishBtn'
    )}
  </div>
  <div class="debug-fill-box" style="display: none;">
    <button class="debug-fill-btn" data-action="click->quiz-name-all-easy#debugGuessAll">Debug: Guess all</button>
  </div>
</div>`,

  quiz_name_all: () => `
<div data-controller="quiz-name-all" class="quiz-container">
  ${NAV('name_all', 'n', 'quiz-name-all')}
  ${REGION_SELECTION('quiz-name-all', 'Name All', 'Normal', 'No outlines shown. Identify every country by name — each guess adds it to the map to give you context.')}
  <div class="finish-panel">
  <div class="finished-banner" data-quiz-name-all-target="finishedBanner" style="display: none;">
    <div class="finished-content">
      <h2>Game Complete!</h2>
      <div class="finished-time" data-quiz-name-all-target="finalTime"></div>
      <div class="finished-stats">
        <div class="finished-stat green"><span class="finished-label">Correct:</span><span class="finished-value" data-quiz-name-all-target="finalCorrect">0</span></div>
        <div class="finished-stat red"><span class="finished-label">Remaining:</span><span class="finished-value" data-quiz-name-all-target="finalRemaining">0</span></div>
        <div class="finished-stat incorrect"><span class="finished-label">Incorrect:</span><span class="finished-value" data-quiz-name-all-target="finalIncorrect">0</span></div>
      </div>
      <button class="restart-btn action-btn" data-action="click->quiz-name-all#restart">Restart</button>
    </div>
  </div>
  <div class="guessed-countries" data-quiz-name-all-target="guessedList" style="display: none;"></div>
  </div>
  <div id="quiz-map" data-map-slot data-quiz-name-all-target="container"></div>
  <div class="game-ui" style="display: none;" data-quiz-name-all-target="gameUI">
    <div class="search-box" data-quiz-name-all-target="searchBox">
      <input type="text" data-quiz-name-all-target="searchInput" data-action="input->quiz-name-all#handleSearch keydown->quiz-name-all#handleKeydown" placeholder="Type country name..." autocomplete="off" />
      <div class="autocomplete-dropdown" data-quiz-name-all-target="dropdown"></div>
    </div>
    ${STATS_BAR_BOTTOM('quiz-name-all',
      [
        { label: 'Remaining', target: 'remainingCount' },
        { label: 'Correct', target: 'correctCount', color_class: 'green' },
        { label: 'Incorrect', target: 'incorrectCount', color_class: 'red' },
        { label: 'Time', target: 'timerDisplay', color_class: 'timer' }
      ],
      'Finish', 'click->quiz-name-all#finish', 'finishBtn'
    )}
  </div>
  <div class="debug-fill-box" style="display: none;">
    <button class="debug-fill-btn" data-action="click->quiz-name-all#debugGuessAll">Debug: Guess all</button>
  </div>
</div>`,

  quiz_name_all_hard: () => `
<div data-controller="quiz-name-all-hard" class="quiz-container">
  ${NAV('name_all', 'h', 'quiz-name-all-hard')}
  ${REGION_SELECTION('quiz-name-all-hard', 'Name All', 'Hard', 'No outlines, no map feedback. Identify every country by name — guesses only appear in a list, with no geographic context.')}
  <div class="finish-panel">
  <div class="finished-banner" data-quiz-name-all-hard-target="finishedBanner" style="display: none;">
    <div class="finished-content">
      <h2>Game Complete!</h2>
      <div class="finished-time" data-quiz-name-all-hard-target="finalTime"></div>
      <div class="finished-stats">
        <div class="finished-stat green"><span class="finished-label">Correct:</span><span class="finished-value" data-quiz-name-all-hard-target="finalCorrect">0</span></div>
        <div class="finished-stat red"><span class="finished-label">Remaining:</span><span class="finished-value" data-quiz-name-all-hard-target="finalRemaining">0</span></div>
        <div class="finished-stat incorrect"><span class="finished-label">Incorrect:</span><span class="finished-value" data-quiz-name-all-hard-target="finalIncorrect">0</span></div>
      </div>
      <button class="restart-btn action-btn" data-action="click->quiz-name-all-hard#restart">Restart</button>
    </div>
  </div>
  <div class="guessed-countries" data-quiz-name-all-hard-target="guessedList" style="display: none;"></div>
  </div>
  <div id="quiz-map" data-map-slot data-quiz-name-all-hard-target="container"></div>
  <div class="game-ui" style="display: none;" data-quiz-name-all-hard-target="gameUI">
    <div class="search-box" data-quiz-name-all-hard-target="searchBox">
      <input type="text" data-quiz-name-all-hard-target="searchInput" data-action="input->quiz-name-all-hard#handleSearch keydown->quiz-name-all-hard#handleKeydown" placeholder="Type country name..." autocomplete="off" />
      <div class="autocomplete-dropdown" data-quiz-name-all-hard-target="dropdown"></div>
    </div>
    ${STATS_BAR_BOTTOM('quiz-name-all-hard',
      [
        { label: 'Remaining', target: 'remainingCount' },
        { label: 'Correct', target: 'correctCount', color_class: 'green' },
        { label: 'Incorrect', target: 'incorrectCount', color_class: 'red' },
        { label: 'Time', target: 'timerDisplay', color_class: 'timer' }
      ],
      'Finish', 'click->quiz-name-all-hard#finish', 'finishBtn'
    )}
  </div>
  <div class="debug-fill-box" style="display: none;">
    <button class="debug-fill-btn" data-action="click->quiz-name-all-hard#debugGuessAll">Debug: Guess all</button>
  </div>
</div>`,

  practice_worst: () => PRACTICE_PAGE('worst', 'w', 'Worst',
    'Practice the countries you guess wrong most often. Their shapes are shown one by one in random order — name each one. The session keeps going until you press Finish.'),

  practice_slowest: () => PRACTICE_PAGE('slowest', 's', 'Slowest',
    'Practice the countries that take you the longest to name. Their shapes are shown one by one in random order — name each one. The session keeps going until you press Finish.'),

  stats: () => `
<div data-controller="stats" class="stats-container">
  ${NAV('stats', '')}
  <div class="header"><h1>Stats</h1></div>
  <div class="stats-content">
    <div class="summary-section">
      <h2>Summary</h2>
      <div class="summary-cards">
        <div class="summary-card"><div class="card-value" data-stats-target="totalGuesses">-</div><div class="card-label">Total Guesses</div></div>
        <div class="summary-card green"><div class="card-value" data-stats-target="correctCount">-</div><div class="card-label">Correct (1st try)</div></div>
        <div class="summary-card yellow"><div class="card-value" data-stats-target="shakyCount">-</div><div class="card-label">Shaky (2nd try)</div></div>
        <div class="summary-card red"><div class="card-value" data-stats-target="incorrectCount">-</div><div class="card-label">Incorrect</div></div>
      </div>
    </div>
    <div class="quiz-type-section">
      <h2>By Difficulty</h2>
      <div class="quiz-type-stats">
        <div class="quiz-type-card">
          <h3>Normal</h3>
          <div class="quiz-type-breakdown">
            <div class="stat-item green"><span class="stat-label">Correct:</span><span class="stat-value" data-stats-target="normalCorrect">-</span></div>
            <div class="stat-item yellow"><span class="stat-label">Shaky:</span><span class="stat-value" data-stats-target="normalShaky">-</span></div>
            <div class="stat-item red"><span class="stat-label">Incorrect:</span><span class="stat-value" data-stats-target="normalIncorrect">-</span></div>
          </div>
        </div>
        <div class="quiz-type-card">
          <h3>Hard</h3>
          <div class="quiz-type-breakdown">
            <div class="stat-item green"><span class="stat-label">Correct:</span><span class="stat-value" data-stats-target="hardCorrect">-</span></div>
            <div class="stat-item yellow"><span class="stat-label">Shaky:</span><span class="stat-value" data-stats-target="hardShaky">-</span></div>
            <div class="stat-item red"><span class="stat-label">Incorrect:</span><span class="stat-value" data-stats-target="hardIncorrect">-</span></div>
          </div>
        </div>
        <div class="quiz-type-card">
          <h3>Name All Countries</h3>
          <div class="quiz-type-breakdown">
            <div class="stat-item green"><span class="stat-label">Correct:</span><span class="stat-value" data-stats-target="nameAllCorrect">-</span></div>
            <div class="stat-item red"><span class="stat-label">Remaining:</span><span class="stat-value" data-stats-target="nameAllRemaining">-</span></div>
            <div class="stat-item incorrect"><span class="stat-label">Wrong Guesses:</span><span class="stat-value" data-stats-target="nameAllIncorrect">-</span></div>
          </div>
        </div>
      </div>
    </div>
    <div class="quiz-runs-section">
      <div class="runs-header">
        <h2>Recent Games</h2>
        <div class="runs-tabs">
          <button class="runs-tab active" data-action="click->stats#filterRuns" data-filter="full">Full</button>
          <button class="runs-tab" data-action="click->stats#filterRuns" data-filter="partial">Partial</button>
          <button class="runs-tab" data-action="click->stats#filterRuns" data-filter="all">All</button>
        </div>
      </div>
      <div class="runs-list" data-stats-target="runsList"><div class="loading">Loading games...</div></div>
    </div>
    <div class="performance-sections">
      <div class="worst-countries-section">
        <h2>Worst guesses</h2>
        <div class="worst-list" data-stats-target="worstList"><div class="loading">Loading worst guesses...</div></div>
      </div>
      <div class="slowest-countries-section">
        <h2>Slowest guesses</h2>
        <div class="slowest-list" data-stats-target="slowestList"><div class="loading">Loading slowest guesses...</div></div>
      </div>
    </div>
    <div class="country-stats-section">
      <h2>By Country</h2>
      <div class="filter-controls">
        <input type="text" data-stats-target="searchInput" data-action="input->stats#filterCountries" placeholder="Search countries..." class="search-input" />
        <select data-stats-target="sortSelect" data-action="change->stats#sortCountries" class="sort-select">
          <option value="name">Sort by Name</option>
          <option value="total-desc">Sort by Total (High to Low)</option>
          <option value="total-asc">Sort by Total (Low to High)</option>
          <option value="correct-desc">Sort by Correct (High to Low)</option>
          <option value="incorrect-desc">Sort by Incorrect (High to Low)</option>
        </select>
      </div>
      <div class="country-list" data-stats-target="countryList"><div class="loading">Loading statistics...</div></div>
    </div>
    <div class="actions-section">
      <button data-action="click->stats#exportData" class="btn btn-export">Export Data as JSON</button>
      <button data-stats-target="clearBtn" data-action="click->stats#clearData" class="btn btn-danger">Clear All Data</button>
      <div class="clear-confirm" data-stats-target="clearConfirm" style="display: none;">
        <span class="clear-confirm-text">Clear all statistics? This cannot be undone.</span>
        <button data-action="click->stats#confirmClear" class="btn btn-danger">Yes, clear everything</button>
        <button data-action="click->stats#cancelClear" class="btn btn-neutral">Cancel</button>
      </div>
    </div>
  </div>
</div>`
};
