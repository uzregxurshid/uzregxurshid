/* ==========================================================================
   RETRO TERMINAL OS - MODULAR CORE ENGINE
   ========================================================================== */

(function () {
  'use strict';

  // --- Core State ---
  const state = {
    user: 'guest',
    hostname: 'retro-os',
    currentPath: '~',
    history: [],
    historyIndex: -1,
    audioEnabled: true,
    theme: 'theme-green-crt',
    matrixActive: false,
    gameActive: false,
    commands: {}
  };

  // --- DOM Elements ---
  const elements = {
    body: document.body,
    crtScreen: document.getElementById('crt-screen'),
    terminalBody: document.getElementById('terminal-body'),
    outputHistory: document.getElementById('output-history'),
    cliInput: document.getElementById('cli-input'),
    fakeCursor: document.getElementById('fake-cursor'),
    promptSymbol: document.getElementById('prompt-symbol'),
    windowTitle: document.getElementById('window-title'),
    clockDisplay: document.getElementById('clock-display'),
    powerLed: document.getElementById('power-led'),
    diskLed: document.getElementById('disk-led'),
    audioLed: document.getElementById('audio-led'),
    toggleCrtBtn: document.getElementById('toggle-crt-btn'),
    toggleScanlinesBtn: document.getElementById('toggle-scanlines-btn'),
    toggleAudioBtn: document.getElementById('toggle-audio-btn'),
    themeSelect: document.getElementById('theme-select'),
    matrixCanvas: document.getElementById('matrix-canvas'),
    gameCanvas: document.getElementById('game-canvas')
  };

  // --- Web Audio Synthesizer (No external sound files required) ---
  const AudioEngine = {
    ctx: null,

    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
      }
    },

    playClick() {
      if (!state.audioEnabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450 + Math.random() * 100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.03);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.03);
      } catch (e) { /* Ignore audio context restrictions */ }
    },

    playEnter() {
      if (!state.audioEnabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.06);
      } catch (e) { }
    },

    playBeep(freq = 520, duration = 0.1) {
      if (!state.audioEnabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) { }
    }
  };

  // --- Virtual Filesystem ---
  const virtualFiles = {
    'readme.txt': `=====================================================
CYBER-TERM RETRO OS v2.4 (BUILD 8086)
=====================================================
Welcome to the interactive retro terminal profile!
Type 'help' to display available commands.
Type 'neofetch' for system metrics.
Type 'matrix' or 'snake' for interactive modules.
=====================================================`,
    'skills.json': `{
  "languages": ["TypeScript", "JavaScript", "Python", "Go", "Rust", "HTML5/CSS3"],
  "frameworks": ["React", "Next.js", "Node.js", "Express", "TailwindCSS"],
  "databases": ["PostgreSQL", "MongoDB", "Redis", "SQLite"],
  "tools": ["Git", "Docker", "Linux", "Vite", "WebAudio", "Canvas2D"]
}`,
    'contact.cfg': `[CONTACT INFOS]
GitHub: https://github.com
LinkedIn: https://linkedin.com
Email: dev@retro-os.terminal
Twitter: @retro_dev`
  };

  // --- ASCII Banners & Graphic Assets ---
  const ASCII_LOGO = `
   ____ _   _ ____  _____ ____  _____ _____ ____  __  __ 
  / ___| | | | __ )| ____|  _ \\|_   _| ____|  _ \\|  \\/  |
 | |   | | | |  _ \\|  _| | |_) | | | |  _| | |_) | |\\/| |
 | |___| |_| | |_) | |___|  _ <  | | | |___|  _ <| |  | |
  \\____|\\___/|____/|_____|_| \\_\\ |_| |_____|_| \\_\\_|  |_|
`;

  const WELCOME_BANNER = `
<span class="color-prompt">${ASCII_LOGO}</span>
<span class="color-yellow">===================================================================</span>
 <span class="color-cyan">CYBER-TERM 8086 [System Version 2.4.0-release]</span>
 <span class="color-white">Interactive Profile & Retro Shell Console</span>
 <span class="color-dim">Type <span class="color-yellow">'help'</span> to view commands or <span class="color-yellow">'neofetch'</span> for profile info.</span>
<span class="color-yellow">===================================================================</span>
`;

  // --- Helper Functions ---
  function appendOutput(htmlContent) {
    const line = document.createElement('div');
    line.className = 'term-line';
    line.innerHTML = htmlContent;
    elements.outputHistory.appendChild(line);
    scrollToBottom();
  }

  function scrollToBottom() {
    elements.terminalBody.scrollTop = elements.terminalBody.scrollHeight;
  }

  function updateClock() {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    elements.clockDisplay.textContent = timeStr;
  }

  function triggerDiskActivity() {
    elements.diskLed.classList.add('active');
    setTimeout(() => {
      elements.diskLed.classList.remove('active');
    }, 150);
  }

  function updateCursorPosition() {
    const val = elements.cliInput.value;
    const textWidth = measureTextWidth(val, elements.cliInput);
    elements.fakeCursor.style.left = `${textWidth}px`;
  }

  function measureTextWidth(text, element) {
    const canvas = measureTextWidth.canvas || (measureTextWidth.canvas = document.createElement('canvas'));
    const context = canvas.getContext('2d');
    const style = window.getComputedStyle(element);
    context.font = `${style.fontSize} ${style.fontFamily}`;
    return context.measureText(text).width;
  }

  // --- Command Handlers ---
  state.commands = {
    help: {
      description: 'Display available system commands',
      execute() {
        return `
<span class="color-yellow">=== AVAILABLE SYSTEM COMMANDS ===</span>
<table class="cmd-table">
  <tr><td class="cmd-name">help</td><td>Show this command manual</td></tr>
  <tr><td class="cmd-name">about</td><td>Display developer bio & background</td></tr>
  <tr><td class="cmd-name">skills</td><td>Show technical stack & proficiencies</td></tr>
  <tr><td class="cmd-name">projects</td><td>List featured software projects</td></tr>
  <tr><td class="cmd-name">experience</td><td>Show career timeline & education</td></tr>
  <tr><td class="cmd-name">contact</td><td>Display contact channels & social links</td></tr>
  <tr><td class="cmd-name">neofetch</td><td>Display retro system metrics card</td></tr>
  <tr><td class="cmd-name">matrix</td><td>Trigger digital rain screen saver</td></tr>
  <tr><td class="cmd-name">snake</td><td>Play retro terminal arcade game</td></tr>
  <tr><td class="cmd-name">theme</td><td>Change theme (green, amber, cyberpunk, dracula, synthwave, paper)</td></tr>
  <tr><td class="cmd-name">audio</td><td>Toggle mechanical audio click sound effects</td></tr>
  <tr><td class="cmd-name">ls</td><td>List files in current virtual directory</td></tr>
  <tr><td class="cmd-name">cat [file]</td><td>Read content of virtual file</td></tr>
  <tr><td class="cmd-name">whoami</td><td>Print active shell user session</td></tr>
  <tr><td class="cmd-name">date</td><td>Print current system timestamp</td></tr>
  <tr><td class="cmd-name">quote</td><td>Print inspirational code snippet / quote</td></tr>
  <tr><td class="cmd-name">clear</td><td>Clear terminal screen viewport</td></tr>
</table>
<span class="color-dim">Tip: Press [TAB] for command auto-completion, [UP/DOWN] for history.</span>`;
      }
    },

    about: {
      description: 'Display developer profile overview',
      execute() {
        return `
<div class="card-box">
  <span class="color-cyan"><b>DEV_PROFILE // FULL-STACK & SYSTEMS DEVELOPER</b></span><br>
  <span class="color-dim">----------------------------------------------------</span><br>
  Passionate software engineer crafting high-performance web applications, 
  sleek user interfaces, interactive systems, and retro-futuristic experiences.<br><br>
  <span class="color-yellow">Core Focus:</span> Modern Web (React/TypeScript), Systems Architecture, Clean Code & UX.<br>
  <span class="color-green">Philosophy:</span> Simple algorithms, beautiful aesthetics, zero noise.
</div>`;
      }
    },

    skills: {
      description: 'Show technical skills matrix',
      execute() {
        return `
<span class="color-yellow">=== TECHNICAL PROFICIENCY MATRIX ===</span>

<span class="color-cyan">Languages:</span>
  <span class="badge color-green">TypeScript</span> <span class="badge color-green">JavaScript (ESNext)</span> 
  <span class="badge color-green">Python</span> <span class="badge color-green">Go</span> <span class="badge color-green">HTML5 / CSS3</span>

<span class="color-cyan">Frameworks & Libraries:</span>
  <span class="badge color-yellow">React.js</span> <span class="badge color-yellow">Next.js</span> <span class="badge color-yellow">Node.js</span> 
  <span class="badge color-yellow">Express</span> <span class="badge color-yellow">Vite</span> <span class="badge color-yellow">TailwindCSS</span>

<span class="color-cyan">Databases & Infrastructure:</span>
  <span class="badge color-magenta">PostgreSQL</span> <span class="badge color-magenta">MongoDB</span> <span class="badge color-magenta">Redis</span> 
  <span class="badge color-magenta">Docker</span> <span class="badge color-magenta">Git</span> <span class="badge color-magenta">Linux / Bash</span>`;
      }
    },

    projects: {
      description: 'List featured open-source projects',
      execute() {
        return `
<span class="color-yellow">=== FEATURED PROJECTS ===</span>

<div class="timeline-item">
  <span class="color-cyan">1. RETRO-TERMINAL-OS</span> <span class="badge color-green">v2.4</span><br>
  An ultra-customizable interactive retro CRT terminal engine for GitHub READMEs and portfolios.<br>
  <span class="color-dim">Tech: HTML5, CSS3 CRT Engine, Web Audio API, Canvas2D</span>
</div>

<div class="timeline-item">
  <span class="color-cyan">2. CYBER-DASHBOARD</span> <span class="badge color-yellow">v1.8</span><br>
  High-performance real-time telemetry dashboard with dynamic charts and dark mode glassmorphism.<br>
  <span class="color-dim">Tech: React, TypeScript, WebSockets, Chart.js</span>
</div>

<div class="timeline-item">
  <span class="color-cyan">3. FAST-API-PIPELINE</span> <span class="badge color-magenta">v1.2</span><br>
  Lightweight asynchronous data transformation engine built for ultra-fast throughput.<br>
  <span class="color-dim">Tech: Python, FastAPI, Redis, PostgreSQL</span>
</div>`;
      }
    },

    experience: {
      description: 'Show career history',
      execute() {
        return `
<span class="color-yellow">=== EXPERIENCE TIMELINE ===</span>

<div class="timeline-item">
  <span class="color-green">[2023 - PRESENT] Senior Software Engineer</span><br>
  Architecting scalable web applications, optimizing frontend performance, and crafting robust backend microservices.
</div>

<div class="timeline-item">
  <span class="color-cyan">[2021 - 2023] Full Stack Developer</span><br>
  Developed responsive web interfaces, integrated GraphQL APIs, and implemented CI/CD deployment pipelines.
</div>

<div class="timeline-item">
  <span class="color-dim">[2019 - 2021] B.S. Computer Science & Engineering</span><br>
  Focused on algorithms, data structures, computer networks, and operating systems.
</div>`;
      }
    },

    contact: {
      description: 'Display social & contact channels',
      execute() {
        return `
<span class="color-yellow">=== CONTACT & SOCIAL CHANNELS ===</span>

  <span class="color-cyan">GitHub:</span>    https://github.com
  <span class="color-cyan">LinkedIn:</span>  https://linkedin.com
  <span class="color-cyan">Email:</span>     dev@retro-os.terminal
  <span class="color-cyan">Twitter:</span>   https://x.com

<span class="color-dim">Send a message or feel free to reach out for collaborations!</span>`;
      }
    },

    neofetch: {
      description: 'Display system specs & ASCII logo',
      execute() {
        return `
<span class="color-prompt">       .---.       </span>  <span class="color-cyan"><b>developer@retro-os</b></span>
<span class="color-prompt">      /     \\      </span>  ------------------
<span class="color-prompt">     | () () |     </span>  <span class="color-yellow">OS:</span> Cyber-Term Retro OS v2.4 (x86_64)
<span class="color-prompt">      \\  ^  /      </span>  <span class="color-yellow">Host:</span> GitHub README CRT Canvas
<span class="color-prompt">       '|||'       </span>  <span class="color-yellow">Kernel:</span> 5.19.0-RETRO-GENERIC
<span class="color-prompt">      '-...-'      </span>  <span class="color-yellow">Uptime:</span> 99.99% Uptime
                     <span class="color-yellow">Shell:</span> zsh 5.9 (cyber-term)
                     <span class="color-yellow">Theme:</span> CRT Green Phosphor [Phosphor 4K]
                     <span class="color-yellow">Terminal:</span> HTML5 Canvas Web Audio
                     <span class="color-yellow">CPU:</span> Cyber-Core 8086 @ 4.70GHz
                     <span class="color-yellow">Memory:</span> 64GB DDR5 / 128GB

<span class="color-green">███</span><span class="color-cyan">███</span><span class="color-yellow">███</span><span class="color-magenta">███</span><span class="color-red">███</span><span class="color-white">███</span>`;
      }
    },

    matrix: {
      description: 'Trigger digital matrix rain screen effect',
      execute() {
        startMatrixRain();
        return `<span class="color-green">Starting Matrix Digital Rain... Press ESC to exit.</span>`;
      }
    },

    snake: {
      description: 'Play retro terminal Snake game',
      execute() {
        startSnakeGame();
        return `<span class="color-yellow">Launching Snake Game... Use Arrow Keys to move, ESC to quit.</span>`;
      }
    },

    theme: {
      description: 'Change visual theme (e.g. theme amber)',
      execute(args) {
        const themeMap = {
          green: 'theme-green-crt',
          amber: 'theme-amber-vt100',
          cyberpunk: 'theme-cyberpunk',
          dracula: 'theme-dracula',
          synthwave: 'theme-synthwave',
          paper: 'theme-paper'
        };

        const target = args[0] ? args[0].toLowerCase() : '';
        if (themeMap[target]) {
          setTheme(themeMap[target]);
          return `<span class="color-green">Theme switched to: ${target}</span>`;
        } else {
          return `<span class="color-red">Invalid theme name. Options: green, amber, cyberpunk, dracula, synthwave, paper</span>`;
        }
      }
    },

    audio: {
      description: 'Toggle sound effects',
      execute() {
        state.audioEnabled = !state.audioEnabled;
        updateAudioLed();
        return `<span class="color-yellow">Audio sound effects: ${state.audioEnabled ? 'ENABLED' : 'DISABLED'}</span>`;
      }
    },

    ls: {
      description: 'List virtual directory contents',
      execute() {
        return Object.keys(virtualFiles).map(f => `<span class="color-cyan">${f}</span>`).join('   ');
      }
    },

    cat: {
      description: 'Read virtual file content',
      execute(args) {
        const filename = args[0];
        if (!filename) return `<span class="color-red">Usage: cat [filename]</span>`;
        if (virtualFiles[filename]) {
          return `<pre class="color-white">${escapeHtml(virtualFiles[filename])}</pre>`;
        }
        return `<span class="color-red">cat: ${filename}: No such file or directory</span>`;
      }
    },

    whoami: {
      description: 'Print active session user',
      execute() {
        return `<span class="color-cyan">${state.user}@${state.hostname}</span> (UID: 1000, GID: 1000)`;
      }
    },

    date: {
      description: 'Print current date',
      execute() {
        return `<span class="color-yellow">${new Date().toString()}</span>`;
      }
    },

    quote: {
      description: 'Print random code wisdom',
      execute() {
        const quotes = [
          '"First, solve the problem. Then, write the code." – John Johnson',
          '"Simplicity is prerequisite for reliability." – Edsger W. Dijkstra',
          '"Make it work, make it right, make it fast." – Kent Beck',
          '"Talk is cheap. Show me the code." – Linus Torvalds'
        ];
        return `<span class="color-magenta">${quotes[Math.floor(Math.random() * quotes.length)]}</span>`;
      }
    },

    banner: {
      description: 'Print welcome banner',
      execute() {
        return WELCOME_BANNER;
      }
    },

    sudo: {
      description: 'Run command with superuser privileges',
      execute() {
        AudioEngine.playBeep(220, 0.2);
        return `<span class="color-red">Permission denied: You are not in the sudoers file. This incident will be reported.</span>`;
      }
    },

    clear: {
      description: 'Clear terminal screen',
      execute() {
        elements.outputHistory.innerHTML = '';
        return null;
      }
    }
  };

  // --- Input & Command Parsing ---
  function handleCommand(cmdString) {
    const trimmed = cmdString.trim();
    if (!trimmed) return;

    // Push command to line history
    state.history.push(trimmed);
    state.historyIndex = state.history.length;

    // Display entered command prompt line
    appendOutput(`<span class="prompt-line">${state.user}@${state.hostname}:${state.currentPath}$</span> ${escapeHtml(trimmed)}`);
    triggerDiskActivity();

    const parts = trimmed.split(/\s+/);
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (state.commands[commandName]) {
      const output = state.commands[commandName].execute(args);
      if (output !== null) {
        appendOutput(output);
      }
    } else {
      AudioEngine.playBeep(300, 0.15);
      appendOutput(`<span class="color-red">zsh: command not found: ${escapeHtml(commandName)}. Type 'help' for manual.</span>`);
    }
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    // Keydown event on CLI input
    elements.cliInput.addEventListener('keydown', (e) => {
      AudioEngine.playClick();

      if (e.key === 'Enter') {
        AudioEngine.playEnter();
        const cmd = elements.cliInput.value;
        elements.cliInput.value = '';
        updateCursorPosition();
        handleCommand(cmd);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (state.historyIndex > 0) {
          state.historyIndex--;
          elements.cliInput.value = state.history[state.historyIndex];
          updateCursorPosition();
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (state.historyIndex < state.history.length - 1) {
          state.historyIndex++;
          elements.cliInput.value = state.history[state.historyIndex];
        } else {
          state.historyIndex = state.history.length;
          elements.cliInput.value = '';
        }
        updateCursorPosition();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        handleTabAutoComplete();
      }
    });

    elements.cliInput.addEventListener('input', updateCursorPosition);

    // Keep input focused when clicking terminal screen
    elements.crtScreen.addEventListener('click', () => {
      if (!state.matrixActive && !state.gameActive) {
        elements.cliInput.focus();
      }
    });

    // Hardware buttons
    elements.toggleCrtBtn.addEventListener('click', () => {
      elements.crtScreen.classList.toggle('crt-effect');
    });

    elements.toggleScanlinesBtn.addEventListener('click', () => {
      elements.crtScreen.classList.toggle('scanlines-on');
    });

    elements.toggleAudioBtn.addEventListener('click', () => {
      state.commands.audio.execute();
    });

    elements.themeSelect.addEventListener('change', (e) => {
      setTheme(e.target.value);
    });

    // Exit overlay canvas on Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (state.matrixActive) stopMatrixRain();
        if (state.gameActive) stopSnakeGame();
      }
    });
  }

  function handleTabAutoComplete() {
    const input = elements.cliInput.value.trim();
    if (!input) return;

    const availableCmds = Object.keys(state.commands);
    const matches = availableCmds.filter(c => c.startsWith(input));

    if (matches.length === 1) {
      elements.cliInput.value = matches[0] + ' ';
      updateCursorPosition();
    } else if (matches.length > 1) {
      appendOutput(`<span class="prompt-line">${state.user}@${state.hostname}:${state.currentPath}$</span> ${escapeHtml(input)}`);
      appendOutput(`<span class="color-dim">${matches.join('   ')}</span>`);
    }
  }

  function setTheme(themeClass) {
    state.theme = themeClass;
    elements.body.className = themeClass;
    elements.themeSelect.value = themeClass;
  }

  function updateAudioLed() {
    if (state.audioEnabled) {
      elements.audioLed.classList.add('active');
      elements.toggleAudioBtn.textContent = 'AUDIO: ON';
    } else {
      elements.audioLed.classList.remove('active');
      elements.toggleAudioBtn.textContent = 'AUDIO: OFF';
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // --- Matrix Digital Rain Canvas Effect ---
  let matrixInterval = null;
  function startMatrixRain() {
    state.matrixActive = true;
    elements.matrixCanvas.classList.remove('hidden');
    const canvas = elements.matrixCanvas;
    const ctx = canvas.getContext('2d');

    canvas.width = elements.crtScreen.clientWidth;
    canvas.height = elements.crtScreen.clientHeight;

    const chars = '0123456789ABCDEFABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*';
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops = Array(columns).fill(1);

    matrixInterval = setInterval(() => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#00ff66';
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    }, 33);
  }

  function stopMatrixRain() {
    state.matrixActive = false;
    clearInterval(matrixInterval);
    elements.matrixCanvas.classList.add('hidden');
    appendOutput(`<span class="color-dim">[Matrix Rain Stopped]</span>`);
    elements.cliInput.focus();
  }

  // --- Retro Snake Arcade Mini-Game ---
  let gameInterval = null;
  function startSnakeGame() {
    state.gameActive = true;
    elements.gameCanvas.classList.remove('hidden');
    const canvas = elements.gameCanvas;
    const ctx = canvas.getContext('2d');

    canvas.width = elements.crtScreen.clientWidth;
    canvas.height = elements.crtScreen.clientHeight - 32;

    const gridSize = 16;
    let snake = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
    let dir = { x: 1, y: 0 };
    let food = { x: 12, y: 8 };
    let score = 0;

    function placeFood() {
      food = {
        x: Math.floor(Math.random() * (canvas.width / gridSize)),
        y: Math.floor(Math.random() * (canvas.height / gridSize))
      };
    }

    function gameLoop() {
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

      // Wall collision
      if (head.x < 0 || head.x * gridSize >= canvas.width || head.y < 0 || head.y * gridSize >= canvas.height) {
        gameOver();
        return;
      }

      // Self collision
      for (let segment of snake) {
        if (segment.x === head.x && segment.y === head.y) {
          gameOver();
          return;
        }
      }

      snake.unshift(head);

      // Food collision
      if (head.x === food.x && head.y === food.y) {
        score += 10;
        AudioEngine.playBeep(880, 0.08);
        placeFood();
      } else {
        snake.pop();
      }

      // Render game frame
      ctx.fillStyle = '#050b07';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw food
      ctx.fillStyle = '#ff3300';
      ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize - 2, gridSize - 2);

      // Draw snake
      ctx.fillStyle = '#00ff66';
      snake.forEach((seg, index) => {
        ctx.fillStyle = index === 0 ? '#00e5ff' : '#00ff66';
        ctx.fillRect(seg.x * gridSize, seg.y * gridSize, gridSize - 2, gridSize - 2);
      });

      // Draw score overlay
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px "Share Tech Mono"';
      ctx.fillText(`SCORE: ${score}  |  Press ESC to Exit`, 10, 20);
    }

    function handleKey(e) {
      if (!state.gameActive) return;
      if (e.key === 'ArrowUp' && dir.y === 0) dir = { x: 0, y: -1 };
      if (e.key === 'ArrowDown' && dir.y === 0) dir = { x: 0, y: 1 };
      if (e.key === 'ArrowLeft' && dir.x === 0) dir = { x: -1, y: 0 };
      if (e.key === 'ArrowRight' && dir.x === 0) dir = { x: 1, y: 0 };
    }

    window.addEventListener('keydown', handleKey);
    gameInterval = setInterval(gameLoop, 90);

    function gameOver() {
      AudioEngine.playBeep(150, 0.3);
      clearInterval(gameInterval);
      window.removeEventListener('keydown', handleKey);
      stopSnakeGame(score);
    }
  }

  function stopSnakeGame(finalScore) {
    state.gameActive = false;
    clearInterval(gameInterval);
    elements.gameCanvas.classList.add('hidden');
    if (finalScore !== undefined) {
      appendOutput(`<span class="color-yellow">GAME OVER! Final Score: ${finalScore}</span>`);
    } else {
      appendOutput(`<span class="color-dim">[Snake Game Closed]</span>`);
    }
    elements.cliInput.focus();
  }

  // --- Initialize App ---
  function init() {
    setInterval(updateClock, 1000);
    updateClock();
    setupEventListeners();
    appendOutput(WELCOME_BANNER);
    elements.cliInput.focus();
  }

  window.addEventListener('DOMContentLoaded', init);
})();
