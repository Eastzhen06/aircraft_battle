(function() {
    class AchievementSystem {
        constructor() {
        this.achievements = {
            'first_blood': { id: 'first_blood', name: '初露锋芒', description: '击落第1架敌机', condition: (stats) => stats.kills >= 1, reward: { gold: 100 } },
            'novice_pilot': { id: 'novice_pilot', name: '新手飞行员', description: '累计击落100架敌机', condition: (stats) => stats.kills >= 100, reward: { gold: 500 } },
            'ace_pilot': { id: 'ace_pilot', name: '王牌飞行员', description: '累计击落1000架敌机', condition: (stats) => stats.kills >= 1000, reward: { gold: 2000, diamond: 10 } },
            'survivor': { id: 'survivor', name: '生存专家', description: '到达第5关', condition: (stats) => stats.maxLevel >= 5, reward: { gold: 1000 } },
            'unstoppable': { id: 'unstoppable', name: '势不可挡', description: '到达第10关', condition: (stats) => stats.maxLevel >= 10, reward: { gold: 3000, diamond: 20 } },
            'collector': { id: 'collector', name: '收藏家', description: '收集50个道具', condition: (stats) => stats.powerups >= 50, reward: { gold: 800 } },
            'boss_killer': { id: 'boss_killer', name: 'BOSS克星', description: '击败1个BOSS', condition: (stats) => stats.bossKills >= 1, reward: { gold: 1000 } },
            'rich_man': { id: 'rich_man', name: '大富翁', description: '累计获得10000金币', condition: (stats) => stats.totalGold >= 10000, reward: { diamond: 50 } }
        };
        
        this.stats = {
            kills: 0,
            maxLevel: 1,
            powerups: 0,
            bossKills: 0,
            totalGold: 0
        };
        
        this.unlocked = [];
        this.load();
    }
    
    load() {
        const saved = localStorage.getItem('planeWar_achievements');
        if (saved) {
            const data = JSON.parse(saved);
            this.stats = { ...this.stats, ...data.stats };
            this.unlocked = data.unlocked || [];
        }
    }
    
    save() {
        localStorage.setItem('planeWar_achievements', JSON.stringify({
            stats: this.stats,
            unlocked: this.unlocked
        }));
    }
    
    addProgress(type, amount = 1) {
        if (this.stats[type] !== undefined) {
            this.stats[type] += amount;
            this.checkAchievements();
            this.save();
        }
    }
    
    updateMaxLevel(level) {
        if (level > this.stats.maxLevel) {
            this.stats.maxLevel = level;
            this.checkAchievements();
            this.save();
        }
    }
    
    checkAchievements() {
        Object.values(this.achievements).forEach(achievement => {
            if (!this.unlocked.includes(achievement.id)) {
                if (achievement.condition(this.stats)) {
                    this.unlock(achievement);
                }
            }
        });
    }
    
    unlock(achievement) {
        this.unlocked.push(achievement.id);
        this.showNotification(achievement);
        
        // Grant rewards
        if (achievement.reward.gold) {
            economySystem.addGold(achievement.reward.gold);
        }
        if (achievement.reward.diamond) {
            economySystem.addDiamond(achievement.reward.diamond);
        }
        
        this.save();
    }
    
    showNotification(achievement) {
        const container = document.getElementById('notification-container') || this.createNotificationContainer();
        
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="icon">🏆</div>
            <div class="content">
                <div class="title">解锁成就: ${achievement.name}</div>
                <div class="desc">${achievement.description}</div>
            </div>
        `;
        
        container.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 3000);
    }
    
    createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notification-container';
        container.style.position = 'absolute';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '1000';
        document.body.appendChild(container);
        
        // Add styles if not present
        if (!document.getElementById('achievement-styles')) {
            const style = document.createElement('style');
            style.id = 'achievement-styles';
            style.textContent = `
                .achievement-notification {
                    background: rgba(0, 0, 0, 0.8);
                    border: 1px solid #ffd700;
                    border-radius: 5px;
                    padding: 10px;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    color: #fff;
                    transform: translateX(120%);
                    transition: transform 0.3s ease-out;
                    width: 250px;
                    pointer-events: none;
                }
                .achievement-notification.show {
                    transform: translateX(0);
                }
                .achievement-notification .icon {
                    font-size: 24px;
                    margin-right: 10px;
                }
                .achievement-notification .title {
                    font-weight: bold;
                    color: #ffd700;
                    font-size: 14px;
                }
                .achievement-notification .desc {
                    font-size: 12px;
                    color: #ccc;
                    font-size: 14px;
                }
            `;
            document.head.appendChild(style);
        }
        
        return container;
    }
}

    window.achievementSystem = new AchievementSystem();
})();
