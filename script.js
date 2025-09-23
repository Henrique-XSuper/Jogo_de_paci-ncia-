class Solitaire {
  constructor() {
    this.suits = ['♠', '♥', '♣', '♦'];
    this.ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    this.stock = [];
    this.waste = [];
    this.foundations = [[], [], [], []];
    this.tableau = [[], [], [], [], [], [], []];
    this.draggedCard = null;
    this.draggedFrom = null;
    this.draggedStack = [];
    this.offsetX = 0;
    this.offsetY = 0;
    this.lastX = null;
    this.lastY = null;
    this.moves = 0;
    this.score = 0;
    this.startTime = null;
    this.timer = null;
    this.isDragging = false;
    this.init();
  }

  init() {
    this.newGame();
  }

  newGame() {
    this.deck = [];
    for (let s of this.suits) {
      for (let r of this.ranks) {
        this.deck.push({
          suit: s,
          rank: r,
          color: (s === '♥' || s === '♦') ? 'red' : 'black',
          faceUp: false,
          id: `${s}${r}${Math.random().toString(36).slice(2, 8)}`
        });
      }
    }

    // Embaralhar
    for (let i = this.deck.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }

    this.stock = [...this.deck];
    this.waste = [];
    this.foundations = [[], [], [], []];
    this.tableau = [[], [], [], [], [], [], []];
    this.moves = 0;
    this.score = 0;
    this.startTime = Date.now();
    
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.updateTime(), 1000);

    // Distribuir cartas iniciais
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j <= i; j++) {
        let card = this.stock.pop();
        card.faceUp = (j === i);
        this.tableau[i].push(card);
      }
    }

    this.render();
    this.bindEvents();
  }

  render() {
    this.renderStock();
    this.renderWaste();
    this.renderFoundations();
    this.renderTableau();
    document.getElementById('moves').innerText = this.moves;
    document.getElementById('score').innerText = this.score;
  }

  renderStock() {
    const stockEl = document.getElementById('stock');
    stockEl.innerHTML = '';
    
    if (this.stock.length > 0) {
      let cardEl = document.createElement('div');
      cardEl.className = 'card face-down';
      cardEl.innerHTML = '🂠';
      stockEl.appendChild(cardEl);
    }
  }

  renderWaste() {
    const wasteEl = document.getElementById('waste');
    wasteEl.innerHTML = '';
    
    if (this.waste.length > 0) {
      const card = this.waste[this.waste.length - 1];
      const cardEl = this.createCardElement(card);
      cardEl.dataset.pile = 'waste';
      cardEl.dataset.index = this.waste.length - 1;
      wasteEl.appendChild(cardEl);
    }
  }

  renderFoundations() {
    for (let i = 0; i < 4; i++) {
      const el = document.getElementById(`foundation-${i}`);
      el.innerHTML = '';
      
      if (this.foundations[i].length > 0) {
        const top = this.foundations[i][this.foundations[i].length - 1];
        const cardEl = this.createCardElement(top);
        cardEl.dataset.pile = `foundation-${i}`;
        cardEl.dataset.index = this.foundations[i].length - 1;
        el.appendChild(cardEl);
      }
    }
  }

  renderTableau() {
    for (let i = 0; i < 7; i++) {
      const el = document.getElementById(`tableau-${i}`);
      el.innerHTML = '';
      
      this.tableau[i].forEach((card, index) => {
        const cardEl = this.createCardElement(card);
        cardEl.style.top = `${index * Math.min(25, Math.max(15, window.innerHeight / 30))}px`;
        cardEl.dataset.pile = `tableau-${i}`;
        cardEl.dataset.index = index;
        cardEl.style.zIndex = index + 1;
        el.appendChild(cardEl);
      });
    }
  }

  createCardElement(card) {
    const el = document.createElement('div');
    el.className = `card ${card.color} ${card.faceUp ? '' : 'face-down'}`;
    el.dataset.id = card.id;
    el.innerHTML = card.faceUp ? `${card.rank}<br>${card.suit}` : '🂠';

    if (card.faceUp) {
      el.addEventListener('mousedown', (e) => this.startDrag(e, card));
      el.addEventListener('touchstart', (e) => this.startDrag(e, card), { passive: false });
    }

    return el;
  }

  startDrag(e, card) {
    if (!card.faceUp || this.isDragging) return;

    e.preventDefault();
    this.isDragging = true;

    const cardEl = e.target.closest('.card');
    const pileEl = cardEl.closest('.tableau-pile, .waste, .foundation');
    
    if (!pileEl) return;

    // Não permitir arrastar das foundations
    if (pileEl.classList.contains('foundation')) {
      this.isDragging = false;
      return;
    }

    this.draggedCard = card;
    this.draggedFrom = pileEl.id;

    // Determinar quais cartas arrastar (para tableau, pode ser uma sequência)
    if (pileEl.classList.contains('tableau-pile')) {
      const colIndex = parseInt(this.draggedFrom.split('-')[1]);
      const cardIndex = parseInt(cardEl.dataset.index);
      
      // Verificar se a sequência é válida para arrastar
      if (this.isValidSequence(this.tableau[colIndex], cardIndex)) {
        this.draggedStack = this.tableau[colIndex].slice(cardIndex);
      } else {
        this.isDragging = false;
        return;
      }
    } else {
      this.draggedStack = [card];
    }

    const rect = cardEl.getBoundingClientRect();
    const clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
    const clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;
    
    this.offsetX = clientX - rect.left;
    this.offsetY = clientY - rect.top;
    this.lastX = clientX;
    this.lastY = clientY;

    // Eventos globais
    const mouseMoveHandler = (ev) => this.drag(ev);
    const mouseUpHandler = () => this.endDrag(mouseMoveHandler, mouseUpHandler);

    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
    document.addEventListener('touchmove', mouseMoveHandler, { passive: false });
    document.addEventListener('touchend', mouseUpHandler);
  }

  isValidSequence(column, startIndex) {
    for (let i = startIndex; i < column.length - 1; i++) {
      const current = column[i];
      const next = column[i + 1];
      
      const currentVal = this.ranks.indexOf(current.rank);
      const nextVal = this.ranks.indexOf(next.rank);
      
      if (current.color === next.color || currentVal !== nextVal + 1) {
        return false;
      }
    }
    return true;
  }

  drag(e) {
    if (!this.isDragging || !this.draggedCard) return;

    e.preventDefault();

    const clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
    const clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;
    
    if (clientX == null || clientY == null) return;

    this.lastX = clientX;
    this.lastY = clientY;

    // Mover todas as cartas da pilha
    this.draggedStack.forEach((card, index) => {
      const el = document.querySelector(`[data-id='${card.id}']`);
      if (el) {
        el.classList.add('dragging');
        el.style.position = 'fixed';
        el.style.left = (clientX - this.offsetX) + 'px';
        el.style.top = (clientY - this.offsetY + index * 20) + 'px';
        el.style.zIndex = 2000 + index;
      }
    });

    // Highlight de zonas de drop
    this.updateDropZones(clientX, clientY);
  }

  updateDropZones(x, y) {
    // Remover highlights anteriores
    document.querySelectorAll('.drop-zone').forEach(el => {
      el.classList.remove('drop-zone');
    });

    // Adicionar highlight na zona atual
    const elementUnder = document.elementFromPoint(x, y);
    const dropZone = elementUnder?.closest('.tableau-pile, .foundation');
    
    if (dropZone && this.canDropAt(dropZone)) {
      dropZone.classList.add('drop-zone');
    }
  }

  canDropAt(dropZone) {
    if (dropZone.classList.contains('tableau-pile')) {
      const colIndex = parseInt(dropZone.id.split('-')[1]);
      return this.canMoveToTableau(this.draggedStack[0], colIndex);
    } else if (dropZone.classList.contains('foundation')) {
      const foundIndex = parseInt(dropZone.id.split('-')[1]);
      return this.draggedStack.length === 1 && this.canMoveToFoundation(this.draggedStack[0], foundIndex);
    }
    return false;
  }

  endDrag(mouseMoveHandler, mouseUpHandler) {
    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseup', mouseUpHandler);
    document.removeEventListener('touchmove', mouseMoveHandler);
    document.removeEventListener('touchend', mouseUpHandler);

    if (!this.isDragging || !this.draggedCard) {
      this.isDragging = false;
      return;
    }

    // Remover highlights
    document.querySelectorAll('.drop-zone').forEach(el => {
      el.classList.remove('drop-zone');
    });

    let moved = false;
    const x = this.lastX || window.innerWidth / 2;
    const y = this.lastY || window.innerHeight / 2;

    // Tentar drop em tableau
    document.querySelectorAll('.tableau-pile').forEach((pile, i) => {
      const rect = pile.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        if (this.canMoveToTableau(this.draggedStack[0], i)) {
          this.moveToTableau(i);
          moved = true;
        }
      }
    });

    // Tentar drop em foundations (apenas carta única)
    if (!moved && this.draggedStack.length === 1) {
      document.querySelectorAll('.foundation').forEach((foundation, i) => {
        const rect = foundation.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          if (this.canMoveToFoundation(this.draggedStack[0], i)) {
            this.moveToFoundation(i);
            moved = true;
          }
        }
      });
    }

    // Reset visual das cartas
    this.draggedStack.forEach(card => {
      const el = document.querySelector(`[data-id='${card.id}']`);
      if (el) {
        el.classList.remove('dragging');
        el.style.position = 'absolute';
        el.style.left = '';
        el.style.top = '';
        el.style.zIndex = '';
      }
    });

    // Cleanup
    this.draggedCard = null;
    this.draggedFrom = null;
    this.draggedStack = [];
    this.isDragging = false;

    if (moved) {
      this.moves++;
      this.score += 5;
    }

    this.render();
    this.checkWin();
  }

  canMoveToTableau(card, colIndex) {
    const dest = this.tableau[colIndex];
    if (dest.length === 0) return card.rank === 'K';
    
    const top = dest[dest.length - 1];
    const cardVal = this.ranks.indexOf(card.rank);
    const topVal = this.ranks.indexOf(top.rank);
    
    return card.color !== top.color && cardVal === topVal - 1;
  }

  moveToTableau(colIndex) {
    // Remover da origem
    if (this.draggedFrom === 'waste') {
      this.waste.pop();
    } else if (this.draggedFrom.startsWith('tableau-')) {
      const fromCol = parseInt(this.draggedFrom.split('-')[1]);
      const removeCount = this.draggedStack.length;
      this.tableau[fromCol].splice(-removeCount);
      
      // Virar carta se necessário
      if (this.tableau[fromCol].length > 0) {
        const lastCard = this.tableau[fromCol][this.tableau[fromCol].length - 1];
        if (!lastCard.faceUp) {
          lastCard.faceUp = true;
          this.score += 5;
        }
      }
    }

    // Adicionar ao destino
    this.tableau[colIndex] = this.tableau[colIndex].concat(this.draggedStack);
  }

  canMoveToFoundation(card, foundIndex) {
    const pile = this.foundations[foundIndex];
    if (pile.length === 0) return card.rank === 'A';
    
    const top = pile[pile.length - 1];
    const cardVal = this.ranks.indexOf(card.rank);
    const topVal = this.ranks.indexOf(top.rank);
    
    return card.suit === top.suit && cardVal === topVal + 1;
  }

  moveToFoundation(foundIndex) {
    const card = this.draggedStack[0];
    
    // Remover da origem
    if (this.draggedFrom === 'waste') {
      this.waste.pop();
    } else if (this.draggedFrom.startsWith('tableau-')) {
      const fromCol = parseInt(this.draggedFrom.split('-')[1]);
      this.tableau[fromCol].pop();
      
      // Virar carta se necessário
      if (this.tableau[fromCol].length > 0) {
        const lastCard = this.tableau[fromCol][this.tableau[fromCol].length - 1];
        if (!lastCard.faceUp) {
          lastCard.faceUp = true;
          this.score += 5;
        }
      }
    }

    // Adicionar à foundation
    this.foundations[foundIndex].push(card);
    this.score += 10;
  }

  bindEvents() {
    document.getElementById('stock').onclick = () => this.drawCard();
  }

  drawCard() {
    if (this.stock.length === 0) {
      // Reciclar waste para stock
      if (this.waste.length === 0) return;
      
      this.stock = [...this.waste].reverse();
      this.stock.forEach(card => card.faceUp = false);
      this.waste = [];
      this.moves++;
    } else {
      const card = this.stock.pop();
      card.faceUp = true;
      this.waste.push(card);
      this.moves++;
      this.score++;
    }
    
    this.render();
  }

  updateTime() {
    const diff = Math.floor((Date.now() - this.startTime) / 1000);
    const m = Math.floor(diff / 60).toString().padStart(2, '0');
    const s = (diff % 60).toString().padStart(2, '0');
    document.getElementById('time').innerText = `${m}:${s}`;
  }

  checkWin() {
    if (this.foundations.every(f => f.length === 13)) {
      this.showWin();
    }
  }

  showWin() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    document.getElementById('winMessage').style.display = 'block';
    document.getElementById('finalTime').innerText = document.getElementById('time').innerText;
    document.getElementById('finalMoves').innerText = this.moves;
    document.getElementById('finalScore').innerText = this.score;
    this.startConfetti();
  }

  closeWinMessage() {
    document.getElementById('winMessage').style.display = 'none';
    document.getElementById('celebration').innerHTML = '';
    this.newGame();
  }

  startConfetti() {
    const celebration = document.getElementById('celebration');
    celebration.innerHTML = '';
    
    for (let i = 0; i < 100; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = Math.random() * window.innerWidth + 'px';
      confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 70%, 60%)`;
      confetti.style.animationDelay = Math.random() * 3 + 's';
      celebration.appendChild(confetti);
    }
    
    setTimeout(() => {
      celebration.innerHTML = '';
    }, 6000);
  }
}

const game = new Solitaire();
