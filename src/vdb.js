class VirtualDB {
    static db = { };

    static newRecord(collection, name, data) {
        if (this.db[collection] == undefined) this.db[collection] = {};
        if (this.db[collection][name] == undefined) this.db[collection][name] = {};
        this.db[collection][name] = data;
    }

    static getRecord(collection, name) {
        return name ? this.db[collection]?.[name] : this.db[collection];
    }

    static clearRecord(collection, name) {
        if (name) this.db[collection][name] = {};
        else this.db[collection] = {};
    }
}

module.exports = VirtualDB;