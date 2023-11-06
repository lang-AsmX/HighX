class ExtensionType {
    static check(type, token) {
        type = type.toLowerCase();
        token.type = token.type.toLowerCase();

        if (/i[0-9]+/.test(type)) {
            return this.isIntX(+type.slice(1), +token.lexem);
        }
    }

    static isIntX(t, num) {
        return 0 < num ? (Math.pow(2, t) - 1) >= num : false;
    }
}

module.exports = ExtensionType;