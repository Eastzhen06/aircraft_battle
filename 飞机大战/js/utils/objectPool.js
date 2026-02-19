export default class ObjectPool {
    constructor(createFn, initialSize = 50) {
        this.createFn = createFn;
        this.pool = [];
        for (let i = 0; i < initialSize; i++) {
            const obj = this.createFn();
            obj.active = false;
            this.pool.push(obj);
        }
    }

    get() {
        let obj = this.pool.find(item => !item.active);
        if (!obj) {
            obj = this.createFn();
            this.pool.push(obj);
        }
        obj.active = true;
        return obj;
    }
}