const grammar = require('./grammar/grammar.json');
const llvm = require("llvm.js/llvm"); 
const exceptions = require('llvm.js/exceptions');
const ExtensionType = require('./types/extensionType');
const VirtualDB = require('./vdb');
const PrimitiveType = require('./types/primitiveType');

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
                
                if ([['let', 'const'].includes(name.lexem), ExtensionType.is(name.lexem), PrimitiveType.is(name.lexem)].includes(true)) {
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
                else if (this.ast[this.current].type.toLowerCase() == 'space')
                    this.current++;
                else {
                    this.exceptionInvalidToken(this.ast[this.current]);
                }
            }
        }
    }


    VariableExpression() {
        const [id, name, operator] = this.miniast;
        let valueToken = this.miniast[this.miniast.length - 1];
        valueToken.lexem = this.getValue(valueToken);

        if (operator.type.toLowerCase() == 'equal') {
            const mutable = { let: 'variable', const: 'constant' };
            let mutable_t = mutable[id.lexem];
            const message = `The value '${valueToken.lexem}' does not match the type '${id.lexem}'`;

            let condition_t = 
            ({
                [ExtensionType.is(id.lexem)]: () => !ExtensionType.check(id.lexem, valueToken) && this.exception(message, id, false),
                [PrimitiveType.is(id.lexem)]: () => !PrimitiveType.check(id.lexem, valueToken) && this.exception(message, id, false)
            }?.[true]?.());

            if (!condition_t) mutable_t = mutable.let;

            if (VirtualDB.getRecord('variable', name.lexem) || VirtualDB.getRecord('constant', name.lexem)) {
                this.exception(`Identifier '${name.lexem}' has already been declared`, name, false);
            }

            VirtualDB.newRecord(mutable_t, name.lexem, { mutable, name, value: valueToken });
        }
    }

    CallSimpleExpression() {
        const [name, ref] = [this.miniast[0], this.miniast[2]];
        let argument = ref.lexem;
        argument = this.getValue(ref);

        if (name.lexem == 'print') {
            console.log(argument);
        } else {
            this.exception(`'${name.lexem}' is not defined`, name, false);
        }
    }

    isEndCode(token) {
        return token.type.toLowerCase() == 'semicolon' || token.lexem == ';';
    }

    getValue(token) {
        if (token.type.toLowerCase() == 'identifer') {
            let record = VirtualDB.getRecord('variable', token.lexem);
            let getBuf;

            if (!record) record = VirtualDB.getRecord('constant', token.lexem);

            if (record) {
                getBuf = record;
                record = record?.value?.lexem;
            }
            
            if (getBuf?.value?.type.toLowerCase() == 'string') record = getBuf?.value?.lexem.slice(1, -1);
            if (!record) {
                if (PrimitiveType.check('bool', token)) {
                    return token.lexem;
                } else this.exception(`'${token.lexem}' is not defined`, token, false);
            }

            return record;
        } else {
            return token.lexem;
        }
    }

    handleExceptionValue(value, token) {
        if (this.isExceptionValue(value?.response)) this.exception('Invalid read value', token);
    }

    isExceptionValue(value) {
        return [undefined, null, NaN, Infinity].includes(value);
    }
}

module.exports = Interpreter;