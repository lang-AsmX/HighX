const grammar = require('./grammar/grammar.json');
const llvm = require("llvm.js/llvm"); 
const exceptions = require('llvm.js/exceptions');
const ExtensionType = require('./types/extensionType');
const VirtualDB = require('./vdb');

class Interpreter {
    current = 0;

    exit = () => process.exit();
    exception = (msg, token, view = true) => { new exceptions.TokenException(msg, token, view); this.exit(); };
    exceptionInvalidToken = (token) => { new exceptions.TokenException('Invalid token', token); this.exit(); };

    getMiniAst = () => this.miniast = this.ast.slice(...this.isGrammar.sliceSize).filter(t => t.type != 'SPACE');
    endIterator = () => { this.current = this.isGrammar.sliceSize[1]; this.isGrammar = null; };

    buildTokens(tokens) {
        let index = 0;

        while (index < tokens.length) {
            if (tokens[index].lexem == '$') {
                if (['NUMBER', 'IDENTIFER'].includes(tokens[index + 1].type)) {
                    if (tokens[index + 1]?.type == 'IDENTIFER') {
                        if (tokens[index + 2]?.type == 'NUMBER') {
                            tokens[index] = {
                                ...tokens[index],
                                type: 'IDENTIFER',
                                lexem: `${tokens[index]?.lexem}${tokens[index + 1]?.lexem}${tokens[index + 2]?.lexem}`
                            }

                            tokens[index + 1] = null;
                            tokens[index + 2] = null;
                            index += 2;
                        } else {
                            tokens[index] = {
                                ...tokens[index],
                                type: 'IDENTIFER',
                                lexem: `${tokens[index].lexem}${tokens[index + 1].lexem}`
                            }
    
                            tokens[index + 1] = null;
                            index++; 
                        }
                    } else if (tokens[index + 1].type == 'NUMBER') {
                        tokens[index] = {
                            ...tokens[index],
                            type: 'IDENTIFER',
                            lexem: `${tokens[index].lexem}${tokens[index + 1].lexem}`
                        }

                        tokens[index + 1] = null;
                        index++;
                    }
                }
            }

            else if (`${tokens[index]?.lexem}${tokens[index + 1]?.type}${tokens[index + 2]?.lexem}` == '[IDENTIFER]') {
                tokens[index] = {
                    ...tokens[index],
                    type: 'IDENTIFER',
                    lexem: `${tokens[index].lexem}${tokens[index + 1].lexem}${tokens[index + 2].lexem}`
                }

                tokens[index + 1] = null;
                tokens[index + 2] = null;
                index += 2;
            }

            index++;
        }

        return tokens.filter(t => t != null);
    }

    run(ast) {
        this.ast = ast;
        this.ast = this.buildTokens(this.ast);

        while (this.current < this.ast.length) {
            if (this.ast[this.current].type == 'EOF') break;

            else if ((this.isGrammar = llvm.Grammar.verifyGrammarNoStrict(this.current, this.ast, grammar.VariableDeclaration))) {
                this.getMiniAst();
                const name = this.miniast[0];

                if (['let', 'const'].includes(name.lexem)) {
                    this.endIterator();
                    this.VariableExpression(name);
                } else
                    this.exception('invalid name token', name);
            }

            else if ((this.isGrammar = llvm.Grammar.verifyGrammarNoStrict(this.current, this.ast, grammar.CallSimpleExpression))) {
                this.getMiniAst();
                this.endIterator();
                this.CallSimpleExpression();
            }

            else {
                if (this.ast[this.current].type == "EOF") break;
                else if (this.isEndCode(this.ast[this.current])) 
                    this.current++;
                else
                    this.exceptionInvalidToken(this.ast[this.current]);
            }
        }
    }


    VariableExpression() {
        const [id, name, operator, value] = this.miniast;
        
        if (operator.type.toLowerCase() == 'equal') {
            const mutable = { let: 'variable', const: 'constant' }[id.lexem];
            VirtualDB.newRecord(mutable, name.lexem, { mutable, name, value });
        }
    }

    CallSimpleExpression() {
        const [name, ref] = [this.miniast[0], this.miniast[2]];
        let argument = ref.lexem;

        if (ref.type.toLowerCase() == 'identifer') {
            let get = VirtualDB.getRecord('variable', ref.lexem);
            let getBuf;

            if (!get) get = VirtualDB.getRecord('constant', ref.lexem);

            if (get) {
                getBuf = get;
                get = get?.value?.lexem;
            }

            if (!get) get = ref.lexem;
            if (getBuf?.value?.type.toLowerCase() == 'string') get = getBuf?.value?.lexem.slice(1, -1);

            argument = get;
        }

        if (name.lexem == 'print') {
            console.log(argument);
        }
    }

    isEndCode(token) {
        return token.type.toLowerCase() == 'semicolon' || token.lexem == ';';
    }

    getValue(token) {
        if (token.lexem.startsWith('$')) {
            if (/\$\d+/.test(token.lexem)) return { response: token.lexem, status: 200, register: true, argument: true }
            else if (!this.isRegister(token.lexem)) this.exceptionInvalidToken(token.lexem);
            return { response: token.lexem, status: 200, register: true };
        } else if (token.lexem.startsWith('[') && token.lexem.endsWith(']')) {
            return { response: Section.read(token.lexem.slice(1, -1)), status: Section.read(token.lexem.slice(1, -1)) ? 200 : 404, section: true };
        } else if (['NUMBER', 'STRING'].includes(token.type)) {
            if (token.type == 'STRING') return { response: token.lexem.slice(1, -1), status: 200, primitive: true };
            return { response: token.lexem, status: 200, primitive: true };
        } else {
            this.exceptionInvalidToken(token);
        }
    }

    handleExceptionValue(value, token) {
        if (this.isExceptionValue(value?.response)) this.exception('Invalid read value', token);
    }

    isExceptionValue(value) {
        return [undefined, null, NaN, Infinity].includes(value);
    }

    handleValue(value, token) {
        if (value?.argument) return { response: this[value?.response] };
        else if (value?.register) return { response: this[value?.response] };
        else if (value?.section) return { response: Section.read(token?.lexem.slice(1, -1)) };
        return { response: value.response };
    }
}

module.exports = Interpreter;