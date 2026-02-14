const GAME_MODES = {
    CLASSIC: 'classic',
    CAMPAIGN: 'campaign',
    ENDLESS: 'endless',
    LEGION: 'legion',
    COOP: 'coop'
};

const AIRCRAFT_TYPES = {
    FIGHTER: {
        id: 'fighter',
        name: '战斗机',
        description: '平衡型战机，适合新手',
        stats: {
            speed: 6,
            firepower: 1,
            defense: 1,
            special: 'none'
        },
        color: '#00d4ff',
        unlockCost: { gold: 0, diamond: 0 },
        specialSkill: null
    },
    INTERCEPTOR: {
        id: 'interceptor',
        name: '拦截机',
        description: '高速战机，火力较弱',
        stats: {
            speed: 9,
            firepower: 0.7,
            defense: 0.8,
            special: 'speed'
        },
        color: '#44ff44',
        unlockCost: { gold: 5000, diamond: 0 },
        specialSkill: 'dash'
    },
    BOMBER: {
        id: 'bomber',
        name: '轰炸机',
        description: '重火力战机，移动缓慢',
        stats: {
            speed: 4,
            firepower: 1.8,
            defense: 1.2,
            special: 'power'
        },
        color: '#ff8844',
        unlockCost: { gold: 8000, diamond: 0 },
        specialSkill: 'bomb'
    },
    GUARDIAN: {
        id: 'guardian',
        name: '守护者',
        description: '防御型战机，自带护盾',
        stats: {
            speed: 5,
            firepower: 0.9,
            defense: 1.8,
            special: 'shield'
        },
        color: '#ff44ff',
        unlockCost: { gold: 0, diamond: 100 },
        specialSkill: 'shieldBurst'
    },
    STEALTH: {
        id: 'stealth',
        name: '隐形机',
        description: '可短暂隐身，暴击率高',
        stats: {
            speed: 7,
            firepower: 1.2,
            defense: 0.7,
            special: 'stealth'
        },
        color: '#888888',
        unlockCost: { gold: 0, diamond: 200 },
        specialSkill: 'cloak'
    }
};

const WINGMAN_TYPES = {
    ATTACK: {
        id: 'attack',
        name: '攻击型僚机',
        description: '提供额外火力支援',
        stats: {
            damageBonus: 0.3,
            fireRateBonus: 0.2
        },
        color: '#ff4444',
        cost: { gold: 3000, diamond: 0 }
    },
    DEFENSE: {
        id: 'defense',
        name: '防御型僚机',
        description: '提供护盾和减伤',
        stats: {
            damageReduction: 0.2,
            shieldRegen: 5
        },
        color: '#4444ff',
        cost: { gold: 4000, diamond: 0 }
    },
    SUPPORT: {
        id: 'support',
        name: '辅助型僚机',
        description: '自动收集道具和回血',
        stats: {
            healPerSecond: 2,
            pickupRange: 80
        },
        color: '#44ff44',
        cost: { gold: 0, diamond: 50 }
    }
};

const EQUIPMENT_TYPES = {
    WEAPON: {
        id: 'weapon',
        name: '武器',
        slot: 'weapon',
        stats: ['damage', 'fireRate', 'critChance']
    },
    SHIELD: {
        id: 'shield',
        name: '护盾',
        slot: 'shield',
        stats: ['maxShield', 'shieldRegen', 'damageReduction']
    },
    ENGINE: {
        id: 'engine',
        name: '引擎',
        slot: 'engine',
        stats: ['speed', 'dodge', 'acceleration']
    },
    ARMOR: {
        id: 'armor',
        name: '装甲',
        slot: 'armor',
        stats: ['maxHealth', 'defense', 'regen']
    },
    RADAR: {
        id: 'radar',
        name: '雷达',
        slot: 'radar',
        stats: ['pickupRange', 'critChance', 'enemyDetect']
    },
    REACTOR: {
        id: 'reactor',
        name: '反应堆',
        slot: 'reactor',
        stats: ['energyMax', 'energyRegen', 'skillCooldown']
    },
    MISSILE: {
        id: 'missile',
        name: '导弹系统',
        slot: 'missile',
        stats: ['missileDamage', 'missileCount', 'missileSpeed']
    },
    SPECIAL: {
        id: 'special',
        name: '特殊装备',
        slot: 'special',
        stats: ['specialDamage', 'specialDuration', 'specialCooldown']
    }
};

const EQUIPMENT_QUALITY = {
    COMMON: { id: 'common', name: '普通', color: '#ffffff', multiplier: 1 },
    UNCOMMON: { id: 'uncommon', name: '优秀', color: '#44ff44', multiplier: 1.3 },
    RARE: { id: 'rare', name: '稀有', color: '#4444ff', multiplier: 1.6 },
    EPIC: { id: 'epic', name: '史诗', color: '#aa44ff', multiplier: 2 },
    LEGENDARY: { id: 'legendary', name: '传说', color: '#ffaa00', multiplier: 2.5 }
};

const CAMPAIGN_LEVELS = [
    { level: 1, name: '新手训练场', enemyMult: 1, bossType: null, reward: { gold: 500, diamond: 0 } },
    { level: 2, name: '边境巡逻', enemyMult: 1.2, bossType: 'scout', reward: { gold: 800, diamond: 5 } },
    { level: 3, name: '敌军突袭', enemyMult: 1.4, bossType: 'assault', reward: { gold: 1200, diamond: 10 } },
    { level: 4, name: '空中堡垒', enemyMult: 1.6, bossType: 'fortress', reward: { gold: 1800, diamond: 15 } },
    { level: 5, name: '暗影行动', enemyMult: 1.8, bossType: 'stealth', reward: { gold: 2500, diamond: 20 } },
    { level: 6, name: '钢铁风暴', enemyMult: 2.0, bossType: 'storm', reward: { gold: 3500, diamond: 30 } },
    { level: 7, name: '死亡漩涡', enemyMult: 2.3, bossType: 'vortex', reward: { gold: 5000, diamond: 40 } },
    { level: 8, name: '终极审判', enemyMult: 2.6, bossType: 'judgment', reward: { gold: 7000, diamond: 50 } },
    { level: 9, name: '末日降临', enemyMult: 3.0, bossType: 'doom', reward: { gold: 10000, diamond: 75 } },
    { level: 10, name: '最终决战', enemyMult: 3.5, bossType: 'emperor', reward: { gold: 15000, diamond: 100 } }
];

const BOSS_TYPES = {
    scout: {
        name: '侦察者',
        health: 1500,
        patterns: ['spread', 'circle'],
        special: 'quickDash',
        color: '#ff6b6b'
    },
    assault: {
        name: '突击者',
        health: 2500,
        patterns: ['laser', 'spread', 'missile'],
        special: 'barrage',
        color: '#ff9f43'
    },
    fortress: {
        name: '堡垒',
        health: 4000,
        patterns: ['circle', 'spiral', 'laser'],
        special: 'shieldRegen',
        color: '#ee5a5a'
    },
    stealth: {
        name: '暗影',
        health: 2000,
        patterns: ['spiral', 'laser'],
        special: 'cloak',
        color: '#666666'
    },
    storm: {
        name: '风暴',
        health: 3500,
        patterns: ['spread', 'circle', 'spiral'],
        special: 'lightning',
        color: '#44aaff'
    },
    vortex: {
        name: '漩涡',
        health: 4500,
        patterns: ['spiral', 'circle', 'laser'],
        special: 'gravity',
        color: '#aa44ff'
    },
    judgment: {
        name: '审判者',
        health: 5500,
        patterns: ['laser', 'spread', 'missile', 'circle'],
        special: 'judgment',
        color: '#ffdd44'
    },
    doom: {
        name: '末日',
        health: 7000,
        patterns: ['spread', 'spiral', 'laser', 'circle', 'missile'],
        special: 'doom',
        color: '#ff4444'
    },
    emperor: {
        name: '帝王',
        health: 10000,
        patterns: ['spread', 'spiral', 'laser', 'circle', 'missile', 'beam'],
        special: 'emperor',
        color: '#ffd700'
    }
};

const ACHIEVEMENTS = [
    { id: 'first_blood', name: '初次击杀', description: '击杀第一架敌机', condition: { kills: 1 }, reward: { gold: 100 } },
    { id: 'killer_10', name: '新手杀手', description: '累计击杀10架敌机', condition: { kills: 10 }, reward: { gold: 300 } },
    { id: 'killer_100', name: '熟练杀手', description: '累计击杀100架敌机', condition: { kills: 100 }, reward: { gold: 1000, diamond: 10 } },
    { id: 'killer_500', name: '王牌飞行员', description: '累计击杀500架敌机', condition: { kills: 500 }, reward: { gold: 5000, diamond: 50 } },
    { id: 'killer_1000', name: '死神', description: '累计击杀1000架敌机', condition: { kills: 1000 }, reward: { gold: 10000, diamond: 100 } },
    { id: 'level_5', name: '小有所成', description: '到达第5关', condition: { level: 5 }, reward: { gold: 500 } },
    { id: 'level_10', name: '通关大师', description: '通关第10关', condition: { level: 10 }, reward: { gold: 5000, diamond: 50 } },
    { id: 'boss_slayer', name: 'BOSS杀手', description: '击败第一个BOSS', condition: { bossKills: 1 }, reward: { gold: 800, diamond: 10 } },
    { id: 'boss_master', name: 'BOSS终结者', description: '击败10个BOSS', condition: { bossKills: 10 }, reward: { gold: 5000, diamond: 50 } },
    { id: 'no_damage', name: '毫发无伤', description: '一关内不受伤害', condition: { noDamageLevel: true }, reward: { gold: 2000, diamond: 20 } },
    { id: 'speedrun', name: '速度之星', description: '60秒内通关第1关', condition: { speedrun: 60 }, reward: { gold: 1000, diamond: 15 } },
    { id: 'power_max', name: '火力全开', description: '火力达到最高等级', condition: { powerLevel: 5 }, reward: { gold: 500 } },
    { id: 'collector', name: '收藏家', description: '收集10个道具', condition: { powerups: 10 }, reward: { gold: 300 } },
    { id: 'survivor', name: '幸存者', description: '生命值低于10%存活30秒', condition: { lowHealthSurvive: true }, reward: { gold: 1500, diamond: 20 } },
    { id: 'endless_5min', name: '持久战', description: '无尽模式存活5分钟', condition: { endlessTime: 300 }, reward: { gold: 2000, diamond: 25 } },
    { id: 'endless_10min', name: '钢铁意志', description: '无尽模式存活10分钟', condition: { endlessTime: 600 }, reward: { gold: 5000, diamond: 50 } },
    { id: 'score_10k', name: '万分达人', description: '单局得分超过10000', condition: { score: 10000 }, reward: { gold: 500 } },
    { id: 'score_50k', name: '五万分大师', description: '单局得分超过50000', condition: { score: 50000 }, reward: { gold: 2000, diamond: 30 } },
    { id: 'score_100k', name: '传奇飞行员', description: '单局得分超过100000', condition: { score: 100000 }, reward: { gold: 10000, diamond: 100 } },
    { id: 'all_aircraft', name: '机库满员', description: '解锁所有战机', condition: { aircraftUnlocked: 5 }, reward: { gold: 10000, diamond: 200 } }
];

const UPGRADE_COSTS = {
    1: { gold: 1000, diamond: 0 },
    2: { gold: 3000, diamond: 0 },
    3: { gold: 8000, diamond: 10 },
    4: { gold: 20000, diamond: 30 },
    5: { gold: 50000, diamond: 50 }
};

const REVIVE_COSTS = {
    base: 500,
    multiplier: 2,
    maxCost: 10000
};
