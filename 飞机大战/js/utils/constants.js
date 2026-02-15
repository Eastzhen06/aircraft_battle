const GAME_CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 900,
    TARGET_FPS: 60,
    
    PLAYER: {
        WIDTH: 80,
        HEIGHT: 96,
        SPEED: 0.6,
        MAX_HEALTH: 100,
        SHOOT_COOLDOWN: 150,
        INVINCIBLE_TIME: 2000,
        INITIAL_LIVES: 3
    },
    
    BULLET: {
        PLAYER: {
            WIDTH: 6,
            HEIGHT: 15,
            SPEED: 12,
            DAMAGE: 25
        },
        ENEMY: {
            WIDTH: 6,
            HEIGHT: 12,
            SPEED: 5,
            DAMAGE: 15
        }
    },
    
    ENEMY: {
        SMALL: {
            WIDTH: 35,
            HEIGHT: 30,
            HEALTH: 30,
            SPEED: 3,
            SCORE: 100,
            SHOOT_CHANCE: 0.005
        },
        MEDIUM: {
            WIDTH: 50,
            HEIGHT: 45,
            HEALTH: 80,
            SPEED: 2,
            SCORE: 250,
            SHOOT_CHANCE: 0.01
        },
        LARGE: {
            WIDTH: 70,
            HEIGHT: 65,
            HEALTH: 200,
            SPEED: 1.5,
            SCORE: 500,
            SHOOT_CHANCE: 0.015
        }
    },
    
    POWERUP: {
        WIDTH: 30,
        HEIGHT: 30,
        SPEED: 2,
        DROP_CHANCE: 0.15,
        TYPES: {
            HEALTH: { color: '#44ff44', heal: 30 },
            POWER: { color: '#ffff44', powerBoost: 1 },
            SHIELD: { color: '#44ffff', duration: 5000 }
        }
    },
    
    DIFFICULTY: {
        easy: {
            enemySpeedMult: 0.7,
            enemyHealthMult: 0.7,
            enemyShootMult: 0.5,
            spawnRateMult: 0.7,
            powerupDropMult: 1.5
        },
        normal: {
            enemySpeedMult: 1,
            enemyHealthMult: 1,
            enemyShootMult: 1,
            spawnRateMult: 1,
            powerupDropMult: 1
        },
        hard: {
            enemySpeedMult: 1.3,
            enemyHealthMult: 1.5,
            enemyShootMult: 1.5,
            spawnRateMult: 1.5,
            powerupDropMult: 0.7
        }
    },
    
    LEVEL: {
        SCORE_PER_LEVEL: 2000,
        ENEMY_SPAWN_INTERVAL: 1500,
        MIN_SPAWN_INTERVAL: 400
    },
    
    COLORS: {
        PLAYER: '#00d4ff',
        PLAYER_ACCENT: '#0099cc',
        ENEMY_SMALL: '#ff6b6b',
        ENEMY_MEDIUM: '#ff9f43',
        ENEMY_LARGE: '#ee5a5a',
        BULLET_PLAYER: '#00ffff',
        BULLET_ENEMY: '#ff4444',
        SHIELD: 'rgba(0, 212, 255, 0.3)',
        EXPLOSION: ['#ff4444', '#ff6b6b', '#ffaa44', '#ffff44', '#ffffff']
    }
};

const GAME_STATES = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameOver'
};

const POWERUP_TYPES = {
    HEALTH: 'health',
    POWER: 'power',
    SHIELD: 'shield'
};

const ENEMY_TYPES = {
    SMALL: 'small',
    MEDIUM: 'medium',
    LARGE: 'large'
};
