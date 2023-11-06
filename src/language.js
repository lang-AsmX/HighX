const fs = require('fs');
const llvm = require('llvm.js/llvm');
const Interpreter = require('./interpreter');

class Language {
    run(src) {
        if (fs.existsSync(src)) {
            llvm.Config.setCommentLine('//');
            llvm.Config.setCommentBlock('/*');

            let file_c = fs.readFileSync(src).toString('utf8').split('\n');
        
            const lexer = new llvm.Lexer();
            let ast = lexer.lexer(file_c);
            let content = lexer.clearComments(ast);

            ast = new llvm.Lexer().lexer(content.split('\n'));
            ast = ast.filter(tree => !['WHITESPACE'].includes(tree.type));

            const interpreter = new Interpreter();
            interpreter.run(ast);
        }
    }
}

const language = new Language();

language.run('./src/examples/index.highX');