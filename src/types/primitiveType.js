class PrimitiveType {
    static check(type, token) {
        type = type.toLowerCase();
        token.type = token.type.toLowerCase();

        if (type == 'string') {
            return token.type == 'string';
        } else if (type == 'char') {
            return [token.type == 'string', token.lexem.length == 3].every(condition => condition == true);
        } else if (type == 'int') {
            return token.type == 'number';
        } else if (type == 'bool') {
            return [token.type == 'identifer', ['true', 'false'].includes(token.lexem)].every(condition => condition == true);
        }
    }

    static isConvert(type, token) {
        if (type == 'string' || type == 'char') {
            return true;
        } else if (type == 'int') {
            return false;
        } else if (type == 'bool') {
            return ([token.type == 'identifer', ['true', 'false'].includes(token.lexem)].every(condition => condition == true)) ? false : false;
        }
    }

    static convert(type, token) {
        if (type == 'string' || type == 'char') {
            return token.lexem.slice(1, -1);
        } else if (type == 'int') {
            return +token.lexem;
        } else if (type == 'bool') {
            if ([token.type == 'identifer', ['true', 'false'].includes(token.lexem)].every(condition => condition == true)) {
                return token.lexem == 'true' ? true : false;
            }
        }
    }

    static is(type) {
        return ['string', 'char', 'bool', 'int'].includes(type);
    }
}

module.exports = PrimitiveType;