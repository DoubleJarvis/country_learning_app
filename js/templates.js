// Mobile-only chrome: a hamburger button that toggles the nav sheet, plus the
// backdrop that dismisses it. Both are display:none on desktop (see index.css);
// the toggle is wired by a delegated handler in app.js, so no controller code.
// The nav itself is already in every template — on mobile it renders as the
// sheet this button reveals.
const MOBILE_MENU = () => `
<button class="mobile-menu-btn" data-menu-toggle aria-label="Menu">
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
</button>
<div class="mobile-menu-backdrop" data-menu-close></div>`

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
      <a href="#practice_pairs" class="difficulty-btn${activeMode === 'practice' && activeDifficulty === 'm' ? ' active' : ''}" title="Mix-ups">M</a>
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

const STATS_BAR_TOP_LEFT = (controllerName, stats, buttonText, buttonAction, buttonTarget, withReveal = false) => {
  const statsGroup = `
  <div class="stats-group">
    ${stats.map(s => `
    <div class="stat ${s.color_class || ''}">
      <span class="stat-label">${s.label}:</span>
      <span class="stat-value" data-${controllerName}-target="${s.target}">0</span>
    </div>`).join('')}
  </div>`
  const button = `<button class="action-btn"${buttonTarget ? ` data-${controllerName}-target="${buttonTarget}"` : ''} data-action="${buttonAction}">${buttonText}</button>`

  // Reveal variant (Quiz Normal/Hard): stats stack vertically in a left column
  // with the Finish button beneath them, and the "It was:" card sits alongside
  // on the right. On finish the whole bar (including the card) is hidden in
  // favour of the shared .finished-banner modal, which carries its own final
  // tally.
  if (withReveal) {
    return `
<div class="stats-bar stats-bar-top-left stats-bar-stacked" data-${controllerName}-target="statsBar" style="display: none;">
  <div class="stats-col">
    ${statsGroup}
    ${button}
  </div>
  <div class="last-guess" data-${controllerName}-target="lastGuess" style="display: none;">
    <span class="last-guess-label">It was:</span>
    <div class="guessed-country" data-${controllerName}-target="lastGuessCard">
      <div class="country-shape" data-${controllerName}-target="lastGuessShape"></div>
      <div class="country-name" data-${controllerName}-target="lastGuessName"></div>
    </div>
  </div>
</div>`
  }

  return `
<div class="stats-bar stats-bar-top-left" data-${controllerName}-target="statsBar" style="display: none;">
  ${statsGroup}
  ${button}
</div>`
};

// Practice mode page. Both variants share the "practice" controller; the
// source value picks which stats list (worst/slowest) fills the country pool.
const PRACTICE_PAGE = (source, navDifficulty, difficultyLabel, description) => `
<div data-controller="practice" data-practice-source-value="${source}" class="quiz-container">
  ${MOBILE_MENU()}
  ${NAV('practice', navDifficulty, 'practice')}
  <div class="start-screen" data-practice-target="startScreen">
    <div class="region-header">
      <h1>Practice</h1>
      <div class="region-difficulty ${source}">${difficultyLabel}</div>
    </div>
    <p class="region-description">${description}</p>
    <button data-action="click->practice#startPractice" data-practice-target="startBtn" class="start-btn">Start practice</button>
  </div>
  <div class="stats-bar stats-bar-top-left stats-bar-stacked practice-stats-bar" data-practice-target="statsBar" style="display: none;">
    <div class="stats-col">
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
    </div>
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
  <div class="overlay-shape practice-overlay" data-practice-target="overlayShape">
    <div class="overlay-shape-svg" data-practice-target="overlayShapeIcon"></div>
    <div class="overlay-scale" data-practice-target="overlayScale"></div>
  </div>
  <div class="search-box" data-practice-target="searchBox" style="display: none;">
    <input type="text" data-practice-target="searchInput" data-action="input->practice#handleSearch keydown->practice#handleKeydown" placeholder="Enter country name..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
    <div class="autocomplete-dropdown" data-practice-target="dropdown"></div>
    <button class="skip-btn" data-action="click->practice#skip keydown.shift+enter@window->practice#skip" title="Shift+Enter">Skip</button>
  </div>
</div>`;

export const templates = {
  quiz: () => `
<div data-controller="quiz" class="quiz-container">
  ${MOBILE_MENU()}
  ${NAV('quiz', 'n', 'quiz')}
  ${REGION_SELECTION('quiz', 'Quiz', 'Normal', 'A country is highlighted on the map. Identify it by name.')}
  ${STATS_BAR_TOP_LEFT('quiz',
    [
      { label: 'Remaining', target: 'remainingCount' },
      { label: 'First try', target: 'greenCount', color_class: 'green' },
      { label: 'Second try', target: 'yellowCount', color_class: 'yellow' },
      { label: 'Failed', target: 'redCount', color_class: 'red' },
      { label: 'Time', target: 'timerDisplay', color_class: 'timer' }
    ],
    'Finish', 'click->quiz#finish', 'actionBtn', true
  )}
  <div class="finished-banner" data-quiz-target="finishedBanner" style="display: none;">
    <div class="finished-content">
      <h2>Game Complete!</h2>
      <div class="finished-time" data-quiz-target="finalTime"></div>
      <div class="finished-stats">
        <div class="finished-stat green"><span class="finished-label">First Try:</span><span class="finished-value" data-quiz-target="finalGreen">0</span></div>
        <div class="finished-stat yellow"><span class="finished-label">Second Try:</span><span class="finished-value" data-quiz-target="finalYellow">0</span></div>
        <div class="finished-stat red"><span class="finished-label">Failed:</span><span class="finished-value" data-quiz-target="finalRed">0</span></div>
      </div>
      <button class="restart-btn action-btn" data-action="click->quiz#restart">Restart</button>
    </div>
  </div>
  <div id="quiz-map" data-map-slot data-quiz-target="container"></div>
  <div class="search-box" data-quiz-target="searchBox" style="display: none;">
    <button class="recenter-btn" data-action="click->quiz#recenter" title="Re-center on current country">🎯</button>
    <input type="text" data-quiz-target="searchInput" data-action="input->quiz#handleSearch keydown->quiz#handleKeydown" placeholder="Enter country name..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
    <div class="autocomplete-dropdown" data-quiz-target="dropdown"></div>
    <button class="skip-btn" data-action="click->quiz#skip keydown.shift+enter@window->quiz#skip" title="Shift+Enter">Skip</button>
  </div>
  <div class="debug-search-box" style="display: none;">
    <input type="text" data-quiz-target="debugSearchInput" data-action="input->quiz#handleDebugSearch keydown->quiz#handleDebugKeydown" placeholder="DEBUG: Set country to guess..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
    <div class="autocomplete-dropdown" data-quiz-target="debugDropdown"></div>
  </div>
  <div class="debug-fill-box" style="display: none;">
    <button class="debug-fill-btn" data-action="click->quiz#debugFill">Debug: Fill</button>
    <button class="debug-fast-fill-btn" data-action="click->quiz#debugFastFill">Debug: Fast Fill</button>
    <button class="debug-realistic-fill-btn" data-action="click->quiz#debugRealisticFill">Debug: Fill Realistic</button>
  </div>
</div>`,

  quiz_hard: () => `
<div data-controller="quiz-hard" class="quiz-container">
  ${MOBILE_MENU()}
  ${NAV('quiz', 'h', 'quiz-hard')}
  ${REGION_SELECTION('quiz-hard', 'Quiz', 'Hard', 'A country is shown without context. Identify it by name.')}
  ${STATS_BAR_TOP_LEFT('quiz-hard',
    [
      { label: 'Remaining', target: 'remainingCount' },
      { label: 'First try', target: 'greenCount', color_class: 'green' },
      { label: 'Second try', target: 'yellowCount', color_class: 'yellow' },
      { label: 'Failed', target: 'redCount', color_class: 'red' },
      { label: 'Time', target: 'timerDisplay', color_class: 'timer' }
    ],
    'Finish', 'click->quiz-hard#finish', 'actionBtn', true
  )}
  <div class="finish-panel">
  <div class="finished-banner" data-quiz-hard-target="finishedBanner" style="display: none;">
    <div class="finished-content">
      <h2>Game Complete!</h2>
      <div class="finished-time" data-quiz-hard-target="finalTime"></div>
      <div class="finished-stats">
        <div class="finished-stat green"><span class="finished-label">First Try:</span><span class="finished-value" data-quiz-hard-target="finalGreen">0</span></div>
        <div class="finished-stat yellow"><span class="finished-label">Second Try:</span><span class="finished-value" data-quiz-hard-target="finalYellow">0</span></div>
        <div class="finished-stat red"><span class="finished-label">Failed:</span><span class="finished-value" data-quiz-hard-target="finalRed">0</span></div>
      </div>
      <button class="restart-btn action-btn" data-action="click->quiz-hard#restart">Restart</button>
    </div>
  </div>
  <div class="results-list" data-quiz-hard-target="resultsList" style="display: none;"></div>
  </div>
  <div id="main-map" data-map-slot data-quiz-hard-target="mainContainer"></div>
  <div id="overlay-map" data-quiz-hard-target="overlayContainer"></div>
  <div class="overlay-shape hard-overlay" data-quiz-hard-target="overlayShape">
    <div class="overlay-shape-svg" data-quiz-hard-target="overlayShapeIcon"></div>
    <div class="overlay-scale" data-quiz-hard-target="overlayScale"></div>
  </div>
  <div class="search-box" data-quiz-hard-target="searchBox" style="display: none;">
    <input type="text" data-quiz-hard-target="searchInput" data-action="input->quiz-hard#handleSearch keydown->quiz-hard#handleKeydown" placeholder="Enter country name..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
    <div class="autocomplete-dropdown" data-quiz-hard-target="dropdown"></div>
    <button class="skip-btn" data-action="click->quiz-hard#skip keydown.shift+enter@window->quiz-hard#skip" title="Shift+Enter">Skip</button>
  </div>
  <div class="debug-search-box" style="display: none;">
    <input type="text" data-quiz-hard-target="debugSearchInput" data-action="input->quiz-hard#handleDebugSearch keydown->quiz-hard#handleDebugKeydown" placeholder="DEBUG: Set country to guess..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
    <div class="autocomplete-dropdown" data-quiz-hard-target="debugDropdown"></div>
  </div>
  <div class="debug-fill-box" style="display: none;">
    <button class="debug-fill-btn" data-action="click->quiz-hard#debugFill">Debug: Fill</button>
    <button class="debug-fast-fill-btn" data-action="click->quiz-hard#debugFastFill">Debug: Fast Fill</button>
    <button class="debug-realistic-fill-btn" data-action="click->quiz-hard#debugRealisticFill">Debug: Fill Realistic</button>
  </div>
</div>`,

  quiz_place: () => `
<div data-controller="quiz-place" class="quiz-container">
  ${MOBILE_MENU()}
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
  ${MOBILE_MENU()}
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
  ${STATS_BAR_TOP_LEFT('quiz-name-all-easy',
    [
      { label: 'Remaining', target: 'remainingCount' },
      { label: 'Correct', target: 'correctCount', color_class: 'green' },
      { label: 'Incorrect', target: 'incorrectCount', color_class: 'red' },
      { label: 'Time', target: 'timerDisplay', color_class: 'timer' }
    ],
    'Finish', 'click->quiz-name-all-easy#finish', 'finishBtn'
  )}
  <div class="game-ui" style="display: none;" data-quiz-name-all-easy-target="gameUI">
    <div class="search-box" data-quiz-name-all-easy-target="searchBox">
      <input type="text" data-quiz-name-all-easy-target="searchInput" data-action="input->quiz-name-all-easy#handleSearch keydown->quiz-name-all-easy#handleKeydown" placeholder="Type country name..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
      <div class="autocomplete-dropdown" data-quiz-name-all-easy-target="dropdown"></div>
    </div>
  </div>
  <div class="debug-fill-box" style="display: none;">
    <button class="debug-fill-btn" data-action="click->quiz-name-all-easy#debugFill">Debug: Fill</button>
    <button class="debug-fast-fill-btn" data-action="click->quiz-name-all-easy#debugFastFill">Debug: Fast Fill</button>
    <button class="debug-realistic-fill-btn" data-action="click->quiz-name-all-easy#debugRealisticFill">Debug: Fill Realistic</button>
  </div>
</div>`,

  quiz_name_all: () => `
<div data-controller="quiz-name-all" class="quiz-container">
  ${MOBILE_MENU()}
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
  ${STATS_BAR_TOP_LEFT('quiz-name-all',
    [
      { label: 'Remaining', target: 'remainingCount' },
      { label: 'Correct', target: 'correctCount', color_class: 'green' },
      { label: 'Incorrect', target: 'incorrectCount', color_class: 'red' },
      { label: 'Time', target: 'timerDisplay', color_class: 'timer' }
    ],
    'Finish', 'click->quiz-name-all#finish', 'finishBtn'
  )}
  <div class="game-ui" style="display: none;" data-quiz-name-all-target="gameUI">
    <div class="search-box" data-quiz-name-all-target="searchBox">
      <input type="text" data-quiz-name-all-target="searchInput" data-action="input->quiz-name-all#handleSearch keydown->quiz-name-all#handleKeydown" placeholder="Type country name..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
      <div class="autocomplete-dropdown" data-quiz-name-all-target="dropdown"></div>
    </div>
  </div>
  <div class="debug-fill-box" style="display: none;">
    <button class="debug-fill-btn" data-action="click->quiz-name-all#debugFill">Debug: Fill</button>
    <button class="debug-fast-fill-btn" data-action="click->quiz-name-all#debugFastFill">Debug: Fast Fill</button>
    <button class="debug-realistic-fill-btn" data-action="click->quiz-name-all#debugRealisticFill">Debug: Fill Realistic</button>
  </div>
</div>`,

  quiz_name_all_hard: () => `
<div data-controller="quiz-name-all-hard" class="quiz-container">
  ${MOBILE_MENU()}
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
  ${STATS_BAR_TOP_LEFT('quiz-name-all-hard',
    [
      { label: 'Remaining', target: 'remainingCount' },
      { label: 'Correct', target: 'correctCount', color_class: 'green' },
      { label: 'Incorrect', target: 'incorrectCount', color_class: 'red' },
      { label: 'Time', target: 'timerDisplay', color_class: 'timer' }
    ],
    'Finish', 'click->quiz-name-all-hard#finish', 'finishBtn'
  )}
  <div class="game-ui" style="display: none;" data-quiz-name-all-hard-target="gameUI">
    <div class="search-box" data-quiz-name-all-hard-target="searchBox">
      <input type="text" data-quiz-name-all-hard-target="searchInput" data-action="input->quiz-name-all-hard#handleSearch keydown->quiz-name-all-hard#handleKeydown" placeholder="Type country name..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
      <div class="autocomplete-dropdown" data-quiz-name-all-hard-target="dropdown"></div>
    </div>
  </div>
  <div class="debug-fill-box" style="display: none;">
    <button class="debug-fill-btn" data-action="click->quiz-name-all-hard#debugFill">Debug: Fill</button>
    <button class="debug-fast-fill-btn" data-action="click->quiz-name-all-hard#debugFastFill">Debug: Fast Fill</button>
    <button class="debug-realistic-fill-btn" data-action="click->quiz-name-all-hard#debugRealisticFill">Debug: Fill Realistic</button>
  </div>
</div>`,

  practice_worst: () => PRACTICE_PAGE('worst', 'w', 'Worst',
    'Practice the countries you guess wrong most often. Their shapes are shown one by one in random order — name each one. The session keeps going until you press Finish.'),

  practice_slowest: () => PRACTICE_PAGE('slowest', 's', 'Slowest',
    'Practice the countries that take you the longest to name. Their shapes are shown one by one in random order — name each one. The session keeps going until you press Finish.'),

  practice_pairs: () => `
<div data-controller="practice-pairs" class="quiz-container">
  ${MOBILE_MENU()}
  ${NAV('practice', 'm', 'practice-pairs')}
  <div class="start-screen" data-practice-pairs-target="startScreen">
    <div class="region-header">
      <h1>Practice</h1>
      <div class="region-difficulty pairs">Mix-ups</div>
    </div>
    <p class="region-description">Pairs of countries you've mixed up in quizzes are shown as two shapes side by side with both names. Tap a name, then the shape you think it belongs to — the other name takes the remaining shape, and both get labelled so you can see which is which. The session keeps going until you press Finish.</p>
    <button data-action="click->practice-pairs#startPractice" data-practice-pairs-target="startBtn" class="start-btn">Start practice</button>
  </div>
  <div class="stats-bar stats-bar-top-left" data-practice-pairs-target="statsBar" style="display: none;">
    <div class="stats-group">
      <div class="stat green">
        <span class="stat-label">Correct:</span>
        <span class="stat-value" data-practice-pairs-target="correctCount">0</span>
      </div>
      <div class="stat red">
        <span class="stat-label">Incorrect:</span>
        <span class="stat-value" data-practice-pairs-target="incorrectCount">0</span>
      </div>
    </div>
    <button class="action-btn" data-practice-pairs-target="actionBtn" data-action="click->practice-pairs#finish">Finish</button>
  </div>
  <div class="pair-panel" data-practice-pairs-target="pairPanel" style="display: none;">
    <div class="pair-prompt" data-practice-pairs-target="promptName"></div>
    <div class="pair-hint" data-practice-pairs-target="pairHint">Tap the shape that matches this name</div>
    <div class="pair-feedback" data-practice-pairs-target="feedback" style="display: none;"></div>
    <button class="pair-next-btn" data-practice-pairs-target="nextBtn" data-action="click->practice-pairs#next keydown.enter@window->practice-pairs#next" style="display: none;">Next</button>
  </div>
  <div class="pair-shapes" data-practice-pairs-target="shapesArea" style="display: none;">
    <button class="pair-shape-card" data-practice-pairs-target="shapeCard" data-action="click->practice-pairs#selectShape">
      <div class="pair-shape-name"></div>
      <div class="pair-shape-svg"></div>
      <div class="pair-shape-scale"></div>
    </button>
    <button class="pair-shape-card" data-practice-pairs-target="shapeCard" data-action="click->practice-pairs#selectShape">
      <div class="pair-shape-name"></div>
      <div class="pair-shape-svg"></div>
      <div class="pair-shape-scale"></div>
    </button>
  </div>
  <div class="finished-banner" data-practice-pairs-target="finishedBanner" style="display: none;">
    <div class="finished-content">
      <h2>Practice Complete!</h2>
      <div class="finished-time" data-practice-pairs-target="finalTime"></div>
      <div class="finished-stats">
        <div class="finished-stat green"><span class="finished-label">Correct:</span><span class="finished-value" data-practice-pairs-target="finalCorrect">0</span></div>
        <div class="finished-stat red"><span class="finished-label">Incorrect:</span><span class="finished-value" data-practice-pairs-target="finalIncorrect">0</span></div>
      </div>
      <button class="restart-btn action-btn" data-action="click->practice-pairs#restart">Restart</button>
    </div>
  </div>
</div>`,

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
        <div class="worst-header">
          <h2>Worst guesses</h2>
          <a href="#practice_pairs" class="practice-pairs-btn">Practice mix-ups</a>
        </div>
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
        <input type="text" data-stats-target="searchInput" data-action="input->stats#filterCountries" placeholder="Search countries..." class="search-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
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
    <div class="settings-section">
      <h2>Settings</h2>
      <div class="settings-list" data-stats-target="settingsList"></div>
    </div>
  </div>
</div>`
};
