class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.state = GAME_STATES.MENU;
        this.gameMode = GAME_MODES.CLASSIC;
        this.difficulty = 'normal';
        this.lastTime = 0;
        this.deltaTime = 0;
        
        this.player = null;
        this.player2 = null;
        this.enemies = [];
        this.boss = null;
        this.powerups = [];
        
        this.bulletPool = new BulletPool();
        this.spawnSystem = null;
        this.levelSystem = null;
        
        this.keys = {};
        this.isShooting = false;
        this.isShooting2 = false;
        
        this.stars = [];
        this.highScore = 0;
        
        this.isBossLevel = false;
        this.bossDefeated = false;
        this.levelTransitioning = false;
        
        this.selectedAircraftId = 'fighter';
        this.reviveCount = 0;
        this.levelStartTime = 0;
        this.noDamageThisLevel = true;
        
        this.init();
    }
    
    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        this.setupEventListeners();
        this.createStars();
        this.updateCurrencyDisplay();
        
        this.highScore = Storage.getHighScore();
        document.getElementById('high-score').textContent = formatNumber(this.highScore);
        
        this.gameLoop(0);
    }
    
    resizeCanvas() {
        const container = document.getElementById('game-container');
        const rect = container.getBoundingClientRect();
        
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        this.canvasWidth = this.canvas.width;
        this.canvasHeight = this.canvas.height;
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        document.getElementById('start-btn').addEventListener('click', () => this.startClassicMode());
        document.getElementById('campaign-btn').addEventListener('click', () => this.showCampaignScreen());
        document.getElementById('endless-btn').addEventListener('click', () => this.startEndlessMode());
        document.getElementById('legion-btn').addEventListener('click', () => this.showAircraftSelect('legion'));
        document.getElementById('coop-btn').addEventListener('click', () => this.showAircraftSelect('coop'));
        document.getElementById('hangar-btn').addEventListener('click', () => this.showHangarScreen());
        document.getElementById('shop-btn').addEventListener('click', () => this.showShopScreen());
        
        document.getElementById('restart-btn').addEventListener('click', () => this.restartCurrentMode());
        document.getElementById('menu-btn').addEventListener('click', () => this.showMenu());
        document.getElementById('resume-btn').addEventListener('click', () => this.resumeGame());
        document.getElementById('restart-btn-pause').addEventListener('click', () => this.restartCurrentMode());
        document.getElementById('menu-btn-pause').addEventListener('click', () => this.showMenu());
        
        document.getElementById('surrender-btn').addEventListener('click', () => this.showSurrenderConfirm());
        document.getElementById('confirm-surrender-btn').addEventListener('click', () => this.confirmSurrender());
        document.getElementById('cancel-surrender-btn').addEventListener('click', () => this.cancelSurrender());
        
        document.getElementById('revive-btn').addEventListener('click', () => this.revivePlayer());
        document.getElementById('no-revive-btn').addEventListener('click', () => this.skipRevive());
        
        document.getElementById('back-to-menu-btn').addEventListener('click', () => this.showMenu());
        document.getElementById('back-from-aircraft-btn').addEventListener('click', () => this.showMenu());
        document.getElementById('select-aircraft-btn').addEventListener('click', () => this.confirmAircraftSelection());
        document.getElementById('upgrade-aircraft-btn').addEventListener('click', () => this.upgradeSelectedAircraft());
        
        document.getElementById('start-level-btn').addEventListener('click', () => this.startCampaignLevel());
        document.getElementById('back-from-campaign-btn').addEventListener('click', () => this.showMenu());
        
        document.getElementById('next-level-btn').addEventListener('click', () => this.goToNextLevel());
        document.getElementById('retry-level-btn').addEventListener('click', () => this.retryCurrentLevel());
        document.getElementById('back-to-campaign-btn').addEventListener('click', () => this.showCampaignScreen());
        
        document.getElementById('back-from-hangar-btn').addEventListener('click', () => this.showMenu());
        document.getElementById('back-from-shop-btn').addEventListener('click', () => this.showMenu());
        
        document.querySelectorAll('.hangar-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchHangarTab(e.target.dataset.tab));
        });
        
        document.querySelectorAll('.shop-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchShopTab(e.target.dataset.tab));
        });
        
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    }
    
    handleKeyDown(e) {
        this.keys[e.code] = true;
        
        if (e.code === 'Space') {
            e.preventDefault();
            this.isShooting = true;
        }
        
        if (e.code === 'ControlLeft') {
            e.preventDefault();
            this.isShooting2 = true;
        }
        
        if (e.code === 'KeyE' && this.player && this.state === GAME_STATES.PLAYING) {
            this.player.useSpecialSkill(this.bulletPool);
        }
        
        if (e.code === 'KeyP' && this.state === GAME_STATES.PLAYING) {
            this.pauseGame();
        } else if (e.code === 'KeyP' && this.state === GAME_STATES.PAUSED) {
            this.resumeGame();
        }
        
        if (e.code === 'Escape') {
            if (this.state === GAME_STATES.PLAYING) {
                this.pauseGame();
            } else if (this.state === GAME_STATES.PAUSED) {
                document.getElementById('surrender-screen').classList.contains('hidden') 
                    ? this.resumeGame() 
                    : this.cancelSurrender();
            }
        }
    }
    
    handleKeyUp(e) {
        this.keys[e.code] = false;
        
        if (e.code === 'Space') {
            this.isShooting = false;
        }
        if (e.code === 'ControlLeft') {
            this.isShooting2 = false;
        }
    }
    
    handleTouchStart(e) {
        e.preventDefault();
        this.isShooting = true;
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        if (!this.player || this.state !== GAME_STATES.PLAYING) return;
        
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        
        this.player.x = touch.clientX - rect.left;
        this.player.y = touch.clientY - rect.top;
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        this.isShooting = false;
    }
    
    createStars() {
        this.stars = [];
        for (let i = 0; i < 100; i++) {
            this.stars.push({
                x: Math.random() * this.canvasWidth,
                y: Math.random() * this.canvasHeight,
                size: Math.random() * 2 + 1,
                speed: Math.random() * 2 + 0.5,
                brightness: Math.random()
            });
        }
    }
    
    updateCurrencyDisplay() {
        const balance = economySystem.getBalance();
        document.getElementById('gold-display').textContent = formatNumber(balance.gold);
        document.getElementById('diamond-display').textContent = formatNumber(balance.diamond);
        
        const shopGold = document.getElementById('shop-gold');
        const shopDiamond = document.getElementById('shop-diamond');
        if (shopGold) shopGold.textContent = formatNumber(balance.gold);
        if (shopDiamond) shopDiamond.textContent = formatNumber(balance.diamond);
    }
    
    showMenu() {
        this.state = GAME_STATES.MENU;
        this.hideAllScreens();
        document.getElementById('start-screen').classList.remove('hidden');
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('boss-hud').classList.add('hidden');
        soundManager.stopMusic();
        
        this.updateCurrencyDisplay();
        this.highScore = Storage.getHighScore();
        document.getElementById('high-score').textContent = formatNumber(this.highScore);
    }
    
    showCampaignScreen() {
        this.hideAllScreens();
        document.getElementById('campaign-screen').classList.remove('hidden');
        this.renderLevelGrid();
    }
    
    renderLevelGrid() {
        const grid = document.getElementById('level-grid');
        grid.innerHTML = '';
        
        CAMPAIGN_LEVELS.forEach((level, index) => {
            const card = document.createElement('div');
            card.className = 'level-card';
            
            const isUnlocked = campaignManager.isLevelUnlocked(level.level);
            if (!isUnlocked) card.classList.add('locked');
            if (campaignManager.currentLevel === level.level) card.classList.add('selected');
            
            const progress = campaignManager.levelProgress[level.level];
            
            card.innerHTML = `
                <div class="level-number">${level.level}</div>
                <div class="level-stars">
                    ${this.renderStars(progress?.stars || 0)}
                </div>
            `;
            
            card.addEventListener('click', () => {
                if (isUnlocked) {
                    campaignManager.selectLevel(level.level);
                    this.renderLevelGrid();
                    this.updateLevelInfo();
                }
            });
            
            grid.appendChild(card);
        });
        
        this.updateLevelInfo();
    }
    
    renderStars(count) {
        let html = '';
        for (let i = 0; i < 5; i++) {
            html += `<span class="star ${i < count ? 'filled' : ''}">★</span>`;
        }
        return html;
    }
    
    updateLevelInfo() {
        const levelData = campaignManager.getCurrentLevelData();
        if (!levelData) return;
        
        document.getElementById('level-name').textContent = `第${levelData.level}关`;
        document.getElementById('level-desc').textContent = levelData.name;
        
        const progress = campaignManager.levelProgress[levelData.level];
        document.getElementById('level-stars').innerHTML = this.renderStars(progress?.stars || 0);
    }
    
    showAircraftSelect(mode) {
        this.pendingGameMode = mode;
        this.hideAllScreens();
        document.getElementById('aircraft-select-screen').classList.remove('hidden');
        this.renderAircraftGrid();
    }
    
    renderAircraftGrid() {
        const grid = document.getElementById('aircraft-grid');
        grid.innerHTML = '';
        
        Object.values(AIRCRAFT_TYPES).forEach(aircraft => {
            const card = document.createElement('div');
            card.className = 'aircraft-card';
            
            const isUnlocked = aircraftManager.isUnlocked(aircraft.id);
            if (!isUnlocked) card.classList.add('locked');
            if (this.selectedAircraftId === aircraft.id) card.classList.add('selected');
            
            card.innerHTML = `
                <div class="aircraft-icon" style="color: ${aircraft.color}"></div>
                <div class="aircraft-name">${aircraft.name}</div>
            `;
            
            card.addEventListener('click', () => {
                if (isUnlocked) {
                    this.selectedAircraftId = aircraft.id;
                    this.renderAircraftGrid();
                    this.updateAircraftInfo();
                }
            });
            
            grid.appendChild(card);
        });
        
        this.updateAircraftInfo();
    }
    
    updateAircraftInfo() {
        const aircraft = AIRCRAFT_TYPES[this.selectedAircraftId.toUpperCase()];
        if (!aircraft) return;
        
        document.getElementById('aircraft-name').textContent = aircraft.name;
        document.getElementById('aircraft-desc').textContent = aircraft.description;
        
        const stats = aircraft.stats;
        document.getElementById('stat-speed').style.width = `${stats.speed / 10 * 100}%`;
        document.getElementById('stat-firepower').style.width = `${stats.firepower / 2 * 100}%`;
        document.getElementById('stat-defense').style.width = `${stats.defense / 2 * 100}%`;
        
        const level = aircraftManager.getLevel(this.selectedAircraftId);
        document.getElementById('aircraft-level').textContent = level;
        
        const upgradeBtn = document.getElementById('upgrade-aircraft-btn');
        if (level >= 5) {
            upgradeBtn.textContent = '已满级';
            upgradeBtn.disabled = true;
        } else {
            const cost = UPGRADE_COSTS[level];
            upgradeBtn.textContent = `升级 (${formatNumber(cost.gold)}金币)`;
            upgradeBtn.disabled = !economySystem.canAfford(cost);
        }
    }
    
    confirmAircraftSelection() {
        aircraftManager.select(this.selectedAircraftId);
        
        if (this.pendingGameMode === 'legion') {
            this.startLegionMode();
        } else if (this.pendingGameMode === 'coop') {
            this.startCoopMode();
        }
    }
    
    upgradeSelectedAircraft() {
        if (aircraftManager.upgrade(this.selectedAircraftId, economySystem)) {
            this.updateAircraftInfo();
            this.updateCurrencyDisplay();
        }
    }
    
    showHangarScreen() {
        this.hideAllScreens();
        document.getElementById('hangar-screen').classList.remove('hidden');
        this.renderHangarItems('wingman');
    }
    
    renderHangarItems(tab) {
        const container = document.getElementById('hangar-items');
        container.innerHTML = '';
        
        if (tab === 'wingman') {
            Object.values(WINGMAN_TYPES).forEach(wingman => {
                const isOwned = wingmanManager.owned.includes(wingman.id);
                const isEquipped = wingmanManager.equipped.includes(wingman.id);
                
                const card = document.createElement('div');
                card.className = `item-card ${isOwned ? 'owned' : ''}`;
                card.innerHTML = `
                    <div class="item-name">${wingman.name}</div>
                    <div class="item-price">${isEquipped ? '已装备' : (isOwned ? '已拥有' : `${formatNumber(wingman.cost.gold)}金币`)}</div>
                `;
                
                card.addEventListener('click', () => {
                    if (isOwned && !isEquipped) {
                        wingmanManager.equip(wingman.id);
                        this.renderHangarItems(tab);
                    } else if (isEquipped) {
                        wingmanManager.unequip(wingman.id);
                        this.renderHangarItems(tab);
                    }
                });
                
                container.appendChild(card);
            });
        } else {
            equipmentManager.inventory.forEach(equipment => {
                const quality = EQUIPMENT_QUALITY[equipment.qualityId.toUpperCase()];
                const card = document.createElement('div');
                card.className = 'item-card';
                card.style.borderColor = quality.color;
                card.innerHTML = `
                    <div class="item-name" style="color: ${quality.color}">${EQUIPMENT_TYPES[equipment.typeId.toUpperCase()].name}</div>
                    <div class="item-price">${quality.name}</div>
                `;
                
                card.addEventListener('click', () => {
                    equipmentManager.equip(equipment.id);
                    this.renderHangarItems(tab);
                });
                
                container.appendChild(card);
            });
        }
        
        this.renderEquippedSlots();
    }
    
    renderEquippedSlots() {
        const container = document.getElementById('equipped-slots');
        container.innerHTML = '';
        
        wingmanManager.getEquipped().forEach(wingman => {
            const slot = document.createElement('div');
            slot.className = 'equipped-slot';
            slot.textContent = wingman.name;
            container.appendChild(slot);
        });
        
        Object.entries(equipmentManager.equipped).forEach(([slot, equipment]) => {
            const quality = EQUIPMENT_QUALITY[equipment.qualityId.toUpperCase()];
            const el = document.createElement('div');
            el.className = 'equipped-slot';
            el.style.borderColor = quality.color;
            el.textContent = EQUIPMENT_TYPES[equipment.typeId.toUpperCase()].name;
            container.appendChild(el);
        });
    }
    
    switchHangarTab(tab) {
        document.querySelectorAll('.hangar-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.hangar-tab[data-tab="${tab}"]`).classList.add('active');
        this.renderHangarItems(tab);
    }
    
    showShopScreen() {
        this.hideAllScreens();
        document.getElementById('shop-screen').classList.remove('hidden');
        this.renderShopItems('aircraft');
    }
    
    renderShopItems(tab) {
        const container = document.getElementById('shop-items');
        container.innerHTML = '';
        
        if (tab === 'aircraft') {
            Object.values(AIRCRAFT_TYPES).forEach(aircraft => {
                const isOwned = aircraftManager.isUnlocked(aircraft.id);
                const canAfford = economySystem.canAfford(aircraft.unlockCost);
                
                const card = document.createElement('div');
                card.className = `item-card ${isOwned ? 'owned' : ''}`;
                card.innerHTML = `
                    <div class="item-name" style="color: ${aircraft.color}">${aircraft.name}</div>
                    <div class="item-price">${isOwned ? '已拥有' : `${formatNumber(aircraft.unlockCost.gold)}金币 ${aircraft.unlockCost.diamond}钻石`}</div>
                `;
                
                if (!isOwned && canAfford) {
                    card.addEventListener('click', () => {
                        if (aircraftManager.unlock(aircraft.id, economySystem)) {
                            this.updateCurrencyDisplay();
                            this.renderShopItems(tab);
                        }
                    });
                }
                
                container.appendChild(card);
            });
        } else if (tab === 'wingman') {
            Object.values(WINGMAN_TYPES).forEach(wingman => {
                const isOwned = wingmanManager.owned.includes(wingman.id);
                const canAfford = economySystem.canAfford(wingman.cost);
                
                const card = document.createElement('div');
                card.className = `item-card ${isOwned ? 'owned' : ''}`;
                card.innerHTML = `
                    <div class="item-name">${wingman.name}</div>
                    <div class="item-price">${isOwned ? '已拥有' : `${formatNumber(wingman.cost.gold)}金币`}</div>
                `;
                
                if (!isOwned && canAfford) {
                    card.addEventListener('click', () => {
                        if (wingmanManager.purchase(wingman.id, economySystem)) {
                            this.updateCurrencyDisplay();
                            this.renderShopItems(tab);
                        }
                    });
                }
                
                container.appendChild(card);
            });
        } else {
            for (let i = 0; i < 10; i++) {
                const types = Object.keys(EQUIPMENT_TYPES);
                const qualities = Object.keys(EQUIPMENT_QUALITY);
                const equipment = equipmentManager.generateEquipment(
                    types[Math.floor(Math.random() * types.length)],
                    qualities[Math.floor(Math.random() * qualities.length)]
                );
                
                if (equipment) {
                    const quality = EQUIPMENT_QUALITY[equipment.qualityId.toUpperCase()];
                    const price = Math.floor(500 * quality.multiplier);
                    
                    const card = document.createElement('div');
                    card.className = 'item-card';
                    card.style.borderColor = quality.color;
                    card.innerHTML = `
                        <div class="item-name" style="color: ${quality.color}">${EQUIPMENT_TYPES[equipment.typeId.toUpperCase()].name}</div>
                        <div class="item-price">${formatNumber(price)}金币</div>
                    `;
                    
                    card.addEventListener('click', () => {
                        if (economySystem.spendGold(price)) {
                            equipmentManager.addToInventory(equipment);
                            this.updateCurrencyDisplay();
                        }
                    });
                    
                    container.appendChild(card);
                }
            }
        }
    }
    
    switchShopTab(tab) {
        document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.shop-tab[data-tab="${tab}"]`).classList.add('active');
        this.renderShopItems(tab);
    }
    
    startClassicMode() {
        this.gameMode = GAME_MODES.CLASSIC;
        this.startGame();
    }
    
    startEndlessMode() {
        this.gameMode = GAME_MODES.ENDLESS;
        endlessMode.reset();
        this.startGame();
    }
    
    startCampaignLevel() {
        this.gameMode = GAME_MODES.CAMPAIGN;
        this.startGame();
    }
    
    startLegionMode() {
        this.gameMode = GAME_MODES.LEGION;
        legionMode.setup([this.selectedAircraftId, 'fighter', 'fighter']);
        this.startGame();
    }
    
    startCoopMode() {
        this.gameMode = GAME_MODES.COOP;
        coopMode.setup(this.selectedAircraftId, 'fighter');
        this.startGame();
    }
    
    startGame() {
        soundManager.init();
        soundManager.resume();
        
        this.state = GAME_STATES.PLAYING;
        this.reviveCount = 0;
        this.levelStartTime = Date.now();
        this.noDamageThisLevel = true;
        
        this.player = new AdvancedPlayer(
            this.canvasWidth / 2,
            this.canvasHeight - 100,
            aircraftManager.selectedAircraft
        );
        
        if (this.gameMode === GAME_MODES.COOP) {
            this.player2 = new Player2(
                this.canvasWidth / 2 - 50,
                this.canvasHeight - 100,
                'fighter'
            );
        } else {
            this.player2 = null;
        }
        
        wingmanManager.getEquipped().forEach(wingman => {
            this.player.addWingman(wingman.id);
        });
        
        this.enemies = [];
        this.boss = null;
        this.powerups = [];
        this.bulletPool.releaseAll();
        
        this.spawnSystem = new SpawnSystem(this.difficulty);
        this.levelSystem = new LevelSystem();
        this.levelSystem.setLevelUpCallback((level) => this.onLevelUp(level));
        
        this.isBossLevel = false;
        this.bossDefeated = false;
        this.levelTransitioning = false;
        
        particleSystem.clear();
        
        this.hideAllScreens();
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('boss-hud').classList.add('hidden');
        
        if (this.gameMode === GAME_MODES.ENDLESS) {
            document.getElementById('survival-time-hud').style.display = '';
        } else {
            document.getElementById('survival-time-hud').style.display = 'none';
        }
        
        soundManager.startMusic();
    }
    
    pauseGame() {
        this.state = GAME_STATES.PAUSED;
        document.getElementById('pause-screen').classList.remove('hidden');
        soundManager.stopMusic();
    }
    
    resumeGame() {
        this.state = GAME_STATES.PLAYING;
        document.getElementById('pause-screen').classList.add('hidden');
        document.getElementById('surrender-screen').classList.add('hidden');
        soundManager.startMusic();
    }
    
    showSurrenderConfirm() {
        document.getElementById('surrender-screen').classList.remove('hidden');
    }
    
    cancelSurrender() {
        document.getElementById('surrender-screen').classList.add('hidden');
    }
    
    confirmSurrender() {
        document.getElementById('surrender-screen').classList.add('hidden');
        document.getElementById('pause-screen').classList.add('hidden');
        this.gameOver(true);
    }
    
    restartCurrentMode() {
        this.startGame();
    }
    
    revivePlayer() {
        const cost = economySystem.getReviveCost(this.reviveCount);
        if (economySystem.spendGold(cost)) {
            this.reviveCount++;
            this.player.health = this.player.maxHealth;
            this.player.active = true;
            this.player.isInvincible = true;
            setTimeout(() => { this.player.isInvincible = false; }, 2000);
            
            this.hideAllScreens();
            this.state = GAME_STATES.PLAYING;
            this.updateCurrencyDisplay();
        }
    }
    
    skipRevive() {
        this.hideAllScreens();
        document.getElementById('game-over-screen').classList.remove('hidden');
    }
    
    gameOver(surrendered = false) {
        this.state = GAME_STATES.GAME_OVER;
        soundManager.stopMusic();
        soundManager.playGameOver();
        
        const score = this.levelSystem.getScore();
        const isNewRecord = Storage.setHighScore(score);
        
        achievementSystem.addProgress('kills', this.levelSystem.getKills());
        achievementSystem.addProgress('score', score);
        
        const newAchievements = achievementSystem.checkAchievements();
        newAchievements.forEach(achievement => {
            this.showAchievementPopup(achievement);
            if (achievement.reward.gold) economySystem.addGold(achievement.reward.gold);
            if (achievement.reward.diamond) economySystem.addDiamond(achievement.reward.diamond);
        });
        
        const goldEarned = Math.floor(score / 10);
        economySystem.addGold(goldEarned);
        
        document.getElementById('final-score').textContent = formatNumber(score);
        document.getElementById('final-level').textContent = this.levelSystem.getLevel();
        document.getElementById('final-kills').textContent = this.levelSystem.getKills();
        document.getElementById('final-gold').textContent = formatNumber(goldEarned);
        
        if (this.gameMode === GAME_MODES.ENDLESS) {
            document.getElementById('survival-time-row').classList.remove('hidden');
            document.getElementById('final-time').textContent = Math.floor(endlessMode.survivalTime);
        } else {
            document.getElementById('survival-time-row').classList.add('hidden');
        }
        
        const newRecordEl = document.getElementById('new-record');
        if (isNewRecord && !surrendered) {
            newRecordEl.classList.remove('hidden');
        } else {
            newRecordEl.classList.add('hidden');
        }
        
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('boss-hud').classList.add('hidden');
        document.getElementById('game-over-screen').classList.remove('hidden');
        
        const gameOverTitle = document.getElementById('game-over-title');
        gameOverTitle.textContent = surrendered ? '投降' : '游戏结束';
        
        this.updateCurrencyDisplay();
    }
    
    showLevelComplete() {
        this.state = GAME_STATES.PAUSED;
        
        const score = this.levelSystem.getScore();
        const time = (Date.now() - this.levelStartTime) / 1000;
        const result = campaignManager.completeLevel(score, time, this.noDamageThisLevel);
        
        if (result.reward.gold) economySystem.addGold(result.reward.gold);
        if (result.reward.diamond) economySystem.addDiamond(result.reward.diamond);
        
        document.getElementById('complete-score').textContent = formatNumber(score);
        document.getElementById('complete-time').textContent = Math.floor(time);
        document.getElementById('complete-gold').textContent = result.reward.gold || 0;
        document.getElementById('complete-diamond').textContent = result.reward.diamond || 0;
        document.getElementById('complete-stars').innerHTML = this.renderStars(result.stars);
        
        const nextBtn = document.getElementById('next-level-btn');
        nextBtn.style.display = result.nextLevel ? '' : 'none';
        
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('boss-hud').classList.add('hidden');
        document.getElementById('level-complete-screen').classList.remove('hidden');
        
        this.updateCurrencyDisplay();
    }
    
    goToNextLevel() {
        campaignManager.currentLevel++;
        this.startGame();
    }
    
    retryCurrentLevel() {
        this.startGame();
    }
    
    showAchievementPopup(achievement) {
        const popup = document.getElementById('achievement-popup');
        document.getElementById('achievement-text').textContent = `成就解锁: ${achievement.name}`;
        popup.classList.remove('hidden');
        
        setTimeout(() => {
            popup.classList.add('hidden');
        }, 3000);
    }
    
    onLevelUp(level) {
        if (this.gameMode === GAME_MODES.CAMPAIGN) {
            const levelData = campaignManager.getCurrentLevelData();
            if (levelData && levelData.bossType && !this.isBossLevel && !this.bossDefeated) {
                this.startBossLevel(levelData.bossType);
                return;
            }
        } else if (level === 2 && !this.isBossLevel && !this.bossDefeated && this.gameMode === GAME_MODES.CLASSIC) {
            this.startBossLevel('scout');
            return;
        }
        
        this.spawnSystem.setLevel(level);
        
        const notice = document.getElementById('level-up-notice');
        document.getElementById('new-level').textContent = level;
        notice.classList.remove('hidden');
        
        setTimeout(() => {
            notice.classList.add('hidden');
        }, 2000);
    }
    
    startBossLevel(bossType) {
        this.isBossLevel = true;
        this.levelTransitioning = true;
        
        this.enemies = [];
        
        const warning = document.getElementById('boss-warning');
        warning.classList.remove('hidden');
        
        setTimeout(() => {
            warning.classList.add('hidden');
            
            this.boss = new AdvancedBoss(this.canvasWidth / 2, -100, bossType, this.difficulty);
            this.boss.bulletPool = this.bulletPool;
            this.boss.player = this.player;
            this.levelTransitioning = false;
            
            document.getElementById('boss-hud').classList.remove('hidden');
            document.getElementById('boss-name').textContent = this.boss.name;
        }, 3000);
    }
    
    onBossDefeated() {
        this.bossDefeated = true;
        this.isBossLevel = false;
        
        particleSystem.createExplosion(this.boss.x, this.boss.y, 3);
        particleSystem.createExplosion(this.boss.x - 30, this.boss.y - 20, 2);
        particleSystem.createExplosion(this.boss.x + 30, this.boss.y + 20, 2);
        soundManager.playExplosion();
        
        this.levelSystem.addScore(this.boss.score);
        this.levelSystem.addKill();
        
        achievementSystem.addProgress('bossKills', 1);
        
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                if (this.powerups) {
                    this.powerups.push(new Powerup(
                        this.boss.x + randomRange(-50, 50),
                        this.boss.y + randomRange(-30, 30),
                        Object.values(POWERUP_TYPES)[randomInt(0, 2)]
                    ));
                }
            }, i * 200);
        }
        
        this.boss = null;
        document.getElementById('boss-hud').classList.add('hidden');
        
        if (this.gameMode === GAME_MODES.CAMPAIGN) {
            this.showLevelComplete();
            return;
        }
        
        this.spawnSystem.setLevel(this.levelSystem.getLevel() + 1);
        
        const notice = document.getElementById('level-up-notice');
        document.getElementById('new-level').textContent = this.levelSystem.getLevel() + 1;
        notice.classList.remove('hidden');
        
        setTimeout(() => {
            notice.classList.add('hidden');
        }, 2000);
    }
    
    hideAllScreens() {
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('pause-screen').classList.add('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('surrender-screen').classList.add('hidden');
        document.getElementById('revive-screen').classList.add('hidden');
        document.getElementById('level-complete-screen').classList.add('hidden');
        document.getElementById('campaign-screen').classList.add('hidden');
        document.getElementById('aircraft-select-screen').classList.add('hidden');
        document.getElementById('hangar-screen').classList.add('hidden');
        document.getElementById('shop-screen').classList.add('hidden');
        document.getElementById('mode-select-screen').classList.add('hidden');
        document.getElementById('achievement-screen').classList.add('hidden');
    }
    
    gameLoop(currentTime) {
        this.deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        if (this.deltaTime > 100) {
            this.deltaTime = 16.67;
        }
        
        this.update();
        this.render();
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    update() {
        this.updateStars();
        
        if (this.state !== GAME_STATES.PLAYING) return;
        
        if (this.gameMode === GAME_MODES.ENDLESS) {
            endlessMode.update(this.deltaTime);
        }
        
        this.updatePlayer();
        this.updatePlayer2();
        this.updateEnemies();
        this.updateBoss();
        this.updateBullets();
        this.updatePowerups();
        this.updateSpawning();
        this.updateCollisions();
        this.updateHUD();
        
        if (this.player && this.player.health <= 0) {
            if (this.gameMode === GAME_MODES.ENDLESS) {
                const result = endlessMode.end(this.levelSystem.getScore());
                document.getElementById('final-time').textContent = Math.floor(result.survivalTime);
            }
            
            const reviveCost = economySystem.getReviveCost(this.reviveCount);
            if (economySystem.canRevive(this.reviveCount)) {
                document.getElementById('revive-cost').textContent = formatNumber(reviveCost);
                document.getElementById('revive-screen').classList.remove('hidden');
                this.state = GAME_STATES.PAUSED;
            } else {
                this.gameOver();
            }
        }
    }
    
    updateStars() {
        for (const star of this.stars) {
            star.y += star.speed;
            if (star.y > this.canvasHeight) {
                star.y = 0;
                star.x = Math.random() * this.canvasWidth;
            }
        }
    }
    
    updatePlayer() {
        if (!this.player) return;
        
        let dx = 0;
        let dy = 0;
        
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) dx -= 1;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) dx += 1;
        if (this.keys['ArrowUp'] || this.keys['KeyW']) dy -= 1;
        if (this.keys['ArrowDown'] || this.keys['KeyS']) dy += 1;
        
        if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
        }
        
        this.player.move(dx, dy, this.canvasWidth, this.canvasHeight);
        this.player.update(this.deltaTime);
        
        if (this.isShooting) {
            this.player.shoot(this.bulletPool);
        }
        
        if (Math.random() < 0.3) {
            particleSystem.createTrail(
                this.player.x + randomRange(-5, 5),
                this.player.y + this.player.height / 2,
                this.player.color
            );
        }
    }
    
    updatePlayer2() {
        if (!this.player2) return;
        
        let dx = 0;
        let dy = 0;
        
        if (this.keys['KeyJ']) dx -= 1;
        if (this.keys['KeyL']) dx += 1;
        if (this.keys['KeyI']) dy -= 1;
        if (this.keys['KeyK']) dy += 1;
        
        if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
        }
        
        this.player2.move(dx, dy, this.canvasWidth, this.canvasHeight);
        this.player2.update(this.deltaTime);
        
        if (this.isShooting2) {
            this.player2.shoot(this.bulletPool);
        }
    }
    
    updateEnemies() {
        if (this.isBossLevel) return;
        
        let spawnMult = 1;
        let healthMult = 1;
        let speedMult = 1;
        
        if (this.gameMode === GAME_MODES.ENDLESS) {
            const diff = endlessMode.getDifficulty();
            spawnMult = diff.spawnRateMultiplier;
            healthMult = diff.enemyHealthMultiplier;
            speedMult = diff.enemySpeedMultiplier;
        } else if (this.gameMode === GAME_MODES.CAMPAIGN) {
            const levelData = campaignManager.getCurrentLevelData();
            if (levelData) {
                healthMult = levelData.enemyMult;
                speedMult = levelData.enemyMult;
            }
        }
        
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(this.deltaTime, this.canvasWidth, this.canvasHeight);
            
            if (enemy.shouldShoot()) {
                enemy.shoot(this.bulletPool);
            }
            
            if (!enemy.active) {
                this.enemies.splice(i, 1);
            }
        }
    }
    
    updateBoss() {
        if (!this.boss) return;
        
        this.boss.update(this.deltaTime, this.canvasWidth, this.canvasHeight, this.player);
        
        if (this.boss.shouldShoot()) {
            this.boss.shoot(this.bulletPool, this.player.x, this.player.y);
        }
        
        if (!this.boss.active) {
            this.onBossDefeated();
        }
    }
    
    updateBullets() {
        this.bulletPool.update(this.canvasHeight);
    }
    
    updatePowerups() {
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const powerup = this.powerups[i];
            powerup.update(this.deltaTime, this.canvasHeight);
            
            if (!powerup.active) {
                this.powerups.splice(i, 1);
            }
        }
    }
    
    updateSpawning() {
        if (this.isBossLevel || this.levelTransitioning) return;
        
        let spawnInterval = GAME_CONFIG.LEVEL.ENEMY_SPAWN_INTERVAL;
        
        if (this.gameMode === GAME_MODES.ENDLESS) {
            spawnInterval = endlessMode.getSpawnInterval();
        }
        
        this.spawnSystem.update(this.deltaTime, this.enemies, this.canvasWidth);
    }
    
    updateCollisions() {
        const collisions = collisionSystem.processAllCollisions(this);
        
        for (const collision of collisions) {
            switch (collision.type) {
                case 'bullet-enemy':
                    this.handleBulletEnemyCollision(collision);
                    break;
                case 'bullet-boss':
                    this.handleBulletBossCollision(collision);
                    break;
                case 'enemyBullet-player':
                    this.handleEnemyBulletPlayerCollision(collision);
                    break;
                case 'player-enemy':
                    this.handlePlayerEnemyCollision(collision);
                    break;
                case 'player-boss':
                    this.handlePlayerBossCollision(collision);
                    break;
                case 'powerup-player':
                    this.handlePowerupPlayerCollision(collision);
                    break;
            }
        }
    }
    
    handleBulletEnemyCollision(collision) {
        const { bullet, enemy } = collision;
        
        if (enemy.takeDamage(bullet.damage)) {
            particleSystem.createExplosion(enemy.x, enemy.y, enemy.type === ENEMY_TYPES.LARGE ? 1.5 : 1);
            soundManager.playExplosion();
            
            this.levelSystem.addScore(enemy.score);
            this.levelSystem.addKill();
            
            achievementSystem.addProgress('kills', 1);
            
            this.spawnSystem.spawnPowerup(enemy.x, enemy.y, this.powerups);
        }
        
        bullet.active = false;
        this.bulletPool.release(bullet);
    }
    
    handleBulletBossCollision(collision) {
        const { bullet, boss } = collision;
        
        if (boss.takeDamage(bullet.damage)) {
            this.onBossDefeated();
        }
        
        bullet.active = false;
        this.bulletPool.release(bullet);
    }
    
    handleEnemyBulletPlayerCollision(collision) {
        const { bullet, player } = collision;
        
        if (player.takeDamage(GAME_CONFIG.BULLET.ENEMY.DAMAGE)) {
            particleSystem.createExplosion(player.x, player.y, 1.5);
            this.noDamageThisLevel = false;
        }
        
        bullet.active = false;
        this.bulletPool.release(bullet);
    }
    
    handlePlayerEnemyCollision(collision) {
        const { player, enemy } = collision;
        
        enemy.active = false;
        particleSystem.createExplosion(enemy.x, enemy.y, 1);
        soundManager.playExplosion();
        
        if (player.takeDamage(30)) {
            particleSystem.createExplosion(player.x, player.y, 1.5);
            this.noDamageThisLevel = false;
        }
    }
    
    handlePlayerBossCollision(collision) {
        const { player, boss } = collision;
        
        if (player.takeDamage(50)) {
            particleSystem.createExplosion(player.x, player.y, 1.5);
            this.noDamageThisLevel = false;
        }
    }
    
    handlePowerupPlayerCollision(collision) {
        const { powerup, player } = collision;
        
        powerup.applyTo(player);
        powerup.active = false;
        
        achievementSystem.addProgress('powerups', 1);
        
        const index = this.powerups.indexOf(powerup);
        if (index !== -1) {
            this.powerups.splice(index, 1);
        }
    }
    
    updateHUD() {
        document.getElementById('score').textContent = formatNumber(this.levelSystem.getScore());
        
        if (this.gameMode === GAME_MODES.ENDLESS) {
            document.getElementById('level').textContent = '无尽';
            const time = Math.floor(endlessMode.survivalTime);
            const mins = Math.floor(time / 60);
            const secs = time % 60;
            document.getElementById('survival-time').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        } else if (this.gameMode === GAME_MODES.CAMPAIGN) {
            document.getElementById('level').textContent = campaignManager.currentLevel;
        } else {
            document.getElementById('level').textContent = this.isBossLevel ? 'BOSS' : this.levelSystem.getLevel();
        }
        
        if (this.player) {
            document.getElementById('power-level').textContent = this.player.powerLevel;
            
            const healthPercent = (this.player.health / this.player.maxHealth) * 100;
            document.getElementById('health-fill').style.width = healthPercent + '%';
            
            const skillCooldown = document.getElementById('skill-cooldown');
            if (this.player.skillCooldown <= 0) {
                skillCooldown.classList.add('ready');
            } else {
                skillCooldown.classList.remove('ready');
            }
        }
        
        if (this.boss) {
            const bossHealthPercent = (this.boss.health / this.boss.maxHealth) * 100;
            document.getElementById('boss-health-fill').style.width = bossHealthPercent + '%';
        }
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        this.renderBackground();
        
        if (this.state === GAME_STATES.PLAYING || this.state === GAME_STATES.PAUSED) {
            this.renderGame();
        }
    }
    
    renderBackground() {
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
        gradient.addColorStop(0, '#0a0a1a');
        gradient.addColorStop(1, '#1a1a3e');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        this.ctx.fillStyle = '#ffffff';
        for (const star of this.stars) {
            this.ctx.globalAlpha = 0.3 + star.brightness * 0.7;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;
    }
    
    renderGame() {
        this.bulletPool.draw(this.ctx);
        
        for (const powerup of this.powerups) {
            powerup.draw(this.ctx);
        }
        
        for (const enemy of this.enemies) {
            enemy.draw(this.ctx);
        }
        
        if (this.boss) {
            this.boss.draw(this.ctx);
        }
        
        if (this.player) {
            this.player.draw(this.ctx);
        }
        
        if (this.player2) {
            this.player2.draw(this.ctx);
        }
        
        particleSystem.update();
        particleSystem.draw(this.ctx);
    }
}

const game = new Game();
